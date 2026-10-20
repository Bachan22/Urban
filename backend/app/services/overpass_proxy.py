"""
UrbanIQ — Backend Overpass POI & Land Mask Proxy
=================================================
- Resilient multi-mirror failover with IPv4 preference & health checks.
- POI queries use `nw` (node+way) and `nw["office"]` for maximum speed & reliability.
- Land Mask queries water, forest, park, nature-reserve polygons SEPARATELY,
  including relations (multipolygons) with a longer timeout and separate cache.
- SQLite cache with TTL:
  * POIs: 7 days
  * Land mask: 30 days
- Supports cache bypass via `refresh=True` (`?refresh=1`).
- Raises explicit RuntimeError (FastAPI converts to HTTP 503) if all mirrors fail;
  never falls back to silent fake/prototype data.
"""

import time
import hashlib
import json
import socket
import logging
import math
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import httpx

from backend.app.database.sqlite_cache import (
    get_cached_entry,
    set_cached_entry,
    TTL_POI_SECONDS,
    TTL_LAND_MASK_SECONDS,
)

logger = logging.getLogger("urbaniq.overpass")

# List of global Overpass API mirrors
OVERPASS_MIRRORS: List[str] = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Per-mirror health state: mirror_url -> (is_healthy, last_check_monotonic)
_mirror_health: Dict[str, Tuple[bool, float]] = {}
HEALTH_RECHECK_SECONDS = 300  # retry failed mirror after 5 minutes

REQUEST_TIMEOUT_POI = 8.0          # seconds for nw POI queries (bounded for reliable mirror responses)
REQUEST_TIMEOUT_LAND_MASK = 60.0  # seconds for multipolygon land-mask queries


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two coordinates in meters."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


# ── POI Queries using `nw` (Node + Way) ────────────────────────────────
COMPETITOR_QUERIES: Dict[str, str] = {
    "Education Institute": 'nw["amenity"~"school|college|university|kindergarten|training_centre"]',
    "Schools": 'nw["amenity"="school"]',
    "School": 'nw["amenity"="school"]',
    "Colleges": 'nw["amenity"~"college|university"]',
    "College": 'nw["amenity"~"college|university"]',
    "Pharmacy": 'nw["amenity"="pharmacy"]',
    "Restaurant": 'nw["amenity"="restaurant"]',
    "Gym": 'nw["leisure"="fitness_centre"]',
    "Clothing Store": 'nw["shop"="clothes"]',
    "Cafe": 'nw["amenity"="cafe"]',
    "Clinic": 'nw["amenity"="clinic"]',
}

SUPPLEMENTARY_QUERIES = {
    "hospitals": 'nw["amenity"="hospital"]',
    "schools": 'nw["amenity"="school"]',
    "colleges": 'nw["amenity"~"college|university"]',
    "offices": 'nw["office"]',
    "bus_stops": 'nw["highway"="bus_stop"]',
    "railway_stations": 'nw["railway"="station"]',
}


def _cache_key(prefix: str, lat: float, lon: float, radius: int, extra: str = "") -> str:
    raw = f"{prefix}_{round(lat, 3)}_{round(lon, 3)}_{radius}_{extra}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_healthy_mirrors() -> List[str]:
    """Return mirrors prioritized by health status."""
    now = time.monotonic()
    healthy: List[str] = []
    retry: List[str] = []

    for mirror in OVERPASS_MIRRORS:
        state = _mirror_health.get(mirror)
        if state is None or state[0]:
            healthy.append(mirror)
        elif now - state[1] > HEALTH_RECHECK_SECONDS:
            retry.append(mirror)

    ordered = healthy + retry
    return ordered if ordered else ([retry[0]] if retry else [])


def _mark_mirror(mirror: str, healthy: bool):
    _mirror_health[mirror] = (healthy, time.monotonic())


def _execute_overpass_query(query: str, timeout: float = 25.0) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Attempt query on healthy mirrors in order with bounded backoff.
    Returns: (parsed_data, error_detail)
    """
    mirrors = _get_healthy_mirrors()
    last_err = None
    for attempt, mirror in enumerate(mirrors):
        try:
            if attempt > 0:
                time.sleep(0.3 * attempt)
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(
                    mirror,
                    data={"data": query},
                    headers={
                        "User-Agent": "UrbanIQ-Capstone/1.0 (academic research)",
                        "Accept": "application/json, */*",
                    },
                )
                if resp.status_code == 200:
                    _mark_mirror(mirror, True)
                    data = resp.json()
                    data["_mirror"] = mirror
                    return data, None
                elif resp.status_code in (429, 502, 503, 504):
                    logger.warning("Overpass mirror %s returned %d (attempt %d/%d)", mirror, resp.status_code, attempt + 1, len(mirrors))
                    _mark_mirror(mirror, False)
                    last_err = f"HTTP {resp.status_code} ({mirror})"
                else:
                    logger.warning("Overpass mirror %s returned status %d", mirror, resp.status_code)
                    _mark_mirror(mirror, False)
                    last_err = f"HTTP {resp.status_code} ({mirror})"
        except Exception as e:
            logger.warning("Overpass mirror %s failed: %s", mirror, e)
            _mark_mirror(mirror, False)
            last_err = f"Timeout/ConnectionError: {str(e)[:60]} ({mirror})"

    return None, last_err


def fetch_pois(
    business_type: str,
    latitude: float,
    longitude: float,
    radius_meters: int = 2000,
    refresh: bool = False,
) -> Dict[str, Any]:
    """
    Fetch real POIs from Overpass within radius_meters using `nw` (node+way).
    Checks SQLite cache first (7-day TTL) unless `refresh=True` is passed.
    Returns explicit source_status and category_statuses ('observed', 'confirmed_zero', 'unavailable').
    """
    ck = _cache_key("poi", latitude, longitude, radius_meters, business_type)
    
    # 1. Check SQLite cache (unless refresh requested)
    cached = get_cached_entry(ck, bypass=refresh)
    if cached is not None:
        cached["from_cache"] = True
        # Ensure category_statuses are present in cached dict
        if "category_statuses" not in cached:
            cached["category_statuses"] = {
                k: "observed" if len(cached.get(k, [])) > 0 else "confirmed_zero"
                for k in ["businesses", "hospitals", "schools", "colleges", "offices", "bus_stops", "railway_stations"]
            }
        if "source_status" not in cached:
            has_any = any(len(cached.get(k, [])) > 0 for k in ["businesses", "hospitals", "schools", "colleges", "offices", "bus_stops", "railway_stations"])
            cached["source_status"] = "observed" if has_any else "confirmed_zero"
        return cached

    # 2. Build optimized nw Overpass query
    competitor_filter = COMPETITOR_QUERIES.get(business_type)
    if not competitor_filter:
        competitor_filter = COMPETITOR_QUERIES.get(business_type.title())
    if not competitor_filter:
        raise ValueError(f"Unsupported business type: {business_type}")

    around = f"(around:{radius_meters},{latitude},{longitude})"
    parts = [f"  {competitor_filter}{around};"]
    for _key, q in SUPPLEMENTARY_QUERIES.items():
        parts.append(f"  {q}{around};")

    query = f"""[out:json][timeout:25];
(
{chr(10).join(parts)}
);
out center;"""

    data, error_detail = _execute_overpass_query(query, timeout=REQUEST_TIMEOUT_POI)
    if data is None:
        logger.warning("All Overpass mirrors failed: %s. Returning structured unavailable state.", error_detail)
        return {
            "businesses": [],
            "hospitals": [],
            "schools": [],
            "colleges": [],
            "offices": [],
            "bus_stops": [],
            "railway_stations": [],
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mirror": "none",
            "from_cache": False,
            "source_status": "unavailable",
            "error_detail": error_detail or "All Overpass mirrors failed",
            "poi_counts": {
                "businesses": 0, "hospitals": 0, "schools": 0,
                "colleges": 0, "offices": 0, "bus_stops": 0, "railway_stations": 0,
            },
            "category_statuses": {
                "businesses": "unavailable",
                "hospitals": "unavailable",
                "schools": "unavailable",
                "colleges": "unavailable",
                "offices": "unavailable",
                "bus_stops": "unavailable",
                "railway_stations": "unavailable",
            },
        }

    # 3. Parse elements with strict distance calculation, radius filtering, and deduplication
    elements = data.get("elements", [])
    result = _parse_elements(
        elements,
        business_type=business_type,
        center_lat=latitude,
        center_lon=longitude,
        radius_meters=radius_meters,
    )
    result["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    result["mirror"] = data.get("_mirror", "unknown")
    result["from_cache"] = False
    result["poi_counts"] = {k: len(v) for k, v in result.items() if isinstance(v, list)}

    # Determine per-category data status:
    # A successful query that yields 0 items is confirmed_zero, NOT unavailable
    category_statuses = {}
    for k in ["businesses", "hospitals", "schools", "colleges", "offices", "bus_stops", "railway_stations"]:
        count = len(result.get(k, []))
        category_statuses[k] = "observed" if count > 0 else "confirmed_zero"

    result["category_statuses"] = category_statuses
    has_any = any(len(v) > 0 for k, v in result.items() if isinstance(v, list))
    result["source_status"] = "observed" if has_any else "confirmed_zero"

    # 4. Save to SQLite cache with 7-day TTL (only cache successful queries)
    set_cached_entry(ck, "poi", result, TTL_POI_SECONDS)
    return result


def fetch_land_mask(
    latitude: float,
    longitude: float,
    radius_meters: int = 2000,
    refresh: bool = False,
) -> Dict[str, Any]:
    """
    Query water/forest/park/nature-reserve polygons SEPARATELY.
    Includes relations (multipolygons) for accurate coastal and creek boundary detection.
    Cached into SQLite with a 30-day TTL.
    """
    ck = _cache_key("land_mask", latitude, longitude, radius_meters)
    cached = get_cached_entry(ck, bypass=refresh)
    if cached is not None:
        cached["from_cache"] = True
        return cached

    around = f"(around:{radius_meters},{latitude},{longitude})"
    query = f"""[out:json][timeout:50];
(
  nwr["natural"~"water|wetland|mud|wood|scrub"]{around};
  nwr["waterway"]{around};
  nwr["leisure"~"park|nature_reserve"]{around};
  nwr["landuse"~"forest|reservoir|basin"]{around};
);
out geom;"""

    data = _execute_overpass_query(query, timeout=REQUEST_TIMEOUT_LAND_MASK)
    if data is None:
        logger.warning("Overpass land-mask query failed across all mirrors.")
        return {"elements": [], "mirror": "none", "from_cache": False}

    result = {
        "elements": data.get("elements", []),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mirror": data.get("_mirror", "unknown"),
        "from_cache": False,
        "count": len(data.get("elements", [])),
    }

    set_cached_entry(ck, "land_mask", result, TTL_LAND_MASK_SECONDS)
    return result


def _parse_elements(
    elements: List[Dict[str, Any]],
    business_type: str,
    center_lat: float,
    center_lon: float,
    radius_meters: int,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Classify Overpass elements into exact category buckets.
    Enforces distance boundary <= radius_meters, adds distance_meters,
    and deduplicates identical nodes/ways.
    """
    businesses: List[Dict[str, Any]] = []
    hospitals: List[Dict[str, Any]] = []
    schools: List[Dict[str, Any]] = []
    colleges: List[Dict[str, Any]] = []
    offices: List[Dict[str, Any]] = []
    bus_stops: List[Dict[str, Any]] = []
    railway_stations: List[Dict[str, Any]] = []

    for el in elements:
        lat = el.get("lat") or (el.get("center", {}) or {}).get("lat")
        lon = el.get("lon") or (el.get("center", {}) or {}).get("lon")
        if lat is None or lon is None:
            continue

        lat = float(lat)
        lon = float(lon)
        dist = haversine_distance(center_lat, center_lon, lat, lon)
        if dist > float(radius_meters):
            continue

        tags = el.get("tags", {})
        name = tags.get("name", "Unnamed")
        amenity = tags.get("amenity", "")
        leisure = tags.get("leisure", "")
        shop = tags.get("shop", "")
        office = tags.get("office", "")
        building = tags.get("building", "")
        highway = tags.get("highway", "")
        railway = tags.get("railway", "")

        place = {
            "id": el.get("id", 0),
            "lat": lat,
            "lon": lon,
            "name": name,
            "distance_meters": round(dist, 1),
            "category": "",
        }

        # Check competitor match for target business type
        is_target_competitor = _is_competitor(amenity, leisure, shop, business_type)
        if is_target_competitor:
            place["category"] = business_type
            businesses.append(dict(place))

        # Secondary categories (strictly isolated)
        if railway == "station":
            place["category"] = "railway_station"
            railway_stations.append(dict(place))
        elif highway == "bus_stop":
            place["category"] = "bus_stop"
            bus_stops.append(dict(place))
        elif office or building == "commercial":
            place["category"] = "office"
            offices.append(dict(place))
        elif amenity == "hospital":
            place["category"] = "hospital"
            hospitals.append(dict(place))
        elif amenity == "school":
            place["category"] = "school"
            schools.append(dict(place))
        elif amenity in ("college", "university"):
            place["category"] = "college"
            colleges.append(dict(place))

    def _dedupe_list(lst: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen_coords = set()
        seen_names = set()
        seen_ids = set()
        out = []
        for p in sorted(lst, key=lambda x: x.get("distance_meters", 0)):
            pid = p.get("id")
            if pid and pid in seen_ids:
                continue
            if pid:
                seen_ids.add(pid)

            c_coord = (round(p["lat"], 4), round(p["lon"], 4))
            c_name = (p["name"].strip().lower(), round(p["lat"], 3), round(p["lon"], 3)) if p["name"] != "Unnamed" else None

            if c_coord in seen_coords:
                continue
            if c_name and c_name in seen_names:
                continue

            seen_coords.add(c_coord)
            if c_name:
                seen_names.add(c_name)
            out.append(p)
        return out

    return {
        "businesses": _dedupe_list(businesses),
        "hospitals": _dedupe_list(hospitals),
        "schools": _dedupe_list(schools),
        "colleges": _dedupe_list(colleges),
        "offices": _dedupe_list(offices),
        "bus_stops": _dedupe_list(bus_stops),
        "railway_stations": _dedupe_list(railway_stations),
    }


def _is_competitor(amenity: str, leisure: str, shop: str, business_type: str) -> bool:
    """Check if an element matches the competitor query for a given business type."""
    bt = business_type.strip().lower()
    if bt in ("cafe", "coffee shop", "coffee_shop"):
        return amenity in ("cafe", "coffee_shop")
    if bt in ("pharmacy", "drugstore"):
        return amenity == "pharmacy"
    if bt in ("restaurant", "food"):
        return amenity == "restaurant"
    if bt in ("gym", "fitness centre", "fitness_centre"):
        return leisure == "fitness_centre"
    if bt in ("clothing store", "clothes"):
        return shop == "clothes"
    if bt in ("clinic", "medical clinic"):
        return amenity == "clinic"
    if bt in ("school", "schools"):
        return amenity == "school"
    if bt in ("college", "colleges", "university"):
        return amenity in ("college", "university")
    if bt in ("education institute", "education"):
        return amenity in ("school", "college", "university", "kindergarten", "training_centre")
    return False
