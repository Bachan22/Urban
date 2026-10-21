"""
UrbanIQ — Google Places (New) Nearby Search Integration
=======================================================
- Places API (New): POST https://places.googleapis.com/v1/places:searchNearby
- Minimal Field Mask (places.id, places.displayName, places.location, places.primaryType, places.types, places.formattedAddress)
- Adaptive circle subdivision if saturated (20 results): 1 center + 6 hexagonal sub-circles
- Max recursion depth 2, max 15 API calls per analysis run
- In-memory cache only (~30 mins) to comply with Google Maps Platform terms
- Daily call counter adhering to GOOGLE_DAILY_CALL_CAP
- Gracefully falls back to OpenStreetMap / Overpass on missing key or failure
"""

import math
import time
import hashlib
import logging
from typing import Dict, Any, List, Optional, Tuple
import httpx

from backend.app.core.config import settings

logger = logging.getLogger("urbaniq.google_places")

GOOGLE_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
MINIMAL_FIELD_MASK = (
    "places.id,places.displayName,places.location,places.primaryType,places.types,places.formattedAddress"
)

# Business type to Google Places (New) includedTypes mapping
GOOGLE_TYPE_MAP: Dict[str, List[str]] = {
    "Cafe": ["cafe", "coffee_shop"],
    "Pharmacy": ["pharmacy", "drugstore"],
    "Restaurant": ["restaurant"],
    "Gym": ["gym", "fitness_center"],
    "Clothing Store": ["clothing_store"],
    "Education Institute": ["school", "university"],
    "Schools": ["school"],
    "School": ["school"],
    "Colleges": ["university"],
    "College": ["university"],
    "Clinic": ["medical_clinic"],
}

# In-memory cache: key -> (timestamp, data)
_in_memory_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 1800.0  # 30 minutes

# Daily call counter: day_str (YYYY-MM-DD) -> count
_daily_counter: Dict[str, int] = {}


def _get_daily_key() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def _check_and_increment_daily_cap(count_to_add: int = 1) -> bool:
    """Return True if within daily cap, False if cap exceeded."""
    day_key = _get_daily_key()
    current = _daily_counter.get(day_key, 0)
    cap = settings.GOOGLE_DAILY_CALL_CAP
    if current + count_to_add > cap:
        logger.warning("Google Places daily call cap reached (%d / %d)", current, cap)
        return False
    _daily_counter[day_key] = current + count_to_add
    return True


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two coordinates in meters."""
    r = 6371000.0  # Earth radius in meters
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


def _generate_sub_circles(center_lat: float, center_lon: float, parent_radius: float) -> List[Tuple[float, float, float]]:
    """
    Subdivide circle into 1 center + 6 surrounding sub-circles.
    Sub-circle radius is roughly half parent radius (~0.55 for coverage overlap).
    Offset distance ~ 0.55 * parent_radius.
    """
    sub_r = parent_radius * 0.55
    offset_m = parent_radius * 0.55
    circles = [(center_lat, center_lon, sub_r)]

    # 6 points around hexagon
    lat_deg_per_m = 1.0 / 111139.0
    lon_deg_per_m = 1.0 / (111139.0 * math.cos(math.radians(center_lat)))

    for i in range(6):
        angle = math.radians(i * 60)
        d_lat = offset_m * math.cos(angle) * lat_deg_per_m
        d_lon = offset_m * math.sin(angle) * lon_deg_per_m
        circles.append((center_lat + d_lat, center_lon + d_lon, sub_r))

    return circles


def _search_single_circle(
    lat: float,
    lon: float,
    radius: float,
    included_types: List[str],
    api_key: str,
) -> Tuple[Optional[List[Dict[str, Any]]], bool]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": MINIMAL_FIELD_MASK,
    }
    payload = {
        "includedTypes": included_types,
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": float(radius),
            }
        },
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(GOOGLE_NEARBY_URL, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.warning("Google Places Nearby Search returned status %d: %s", resp.status_code, resp.text[:200])
                return None, False
            data = resp.json()
            places = data.get("places", [])
            is_saturated = len(places) >= 20
            return places, is_saturated
    except Exception as e:
        logger.warning("Google Places Nearby Search exception: %s", e)
        return None, False


def fetch_google_competitors(
    business_type: str,
    center_lat: float,
    center_lon: float,
    radius_meters: int,
    debug: bool = False,
) -> Optional[Dict[str, Any]]:
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        if debug:
            logger.info("No GOOGLE_MAPS_API_KEY configured; skipping Google Places.")
        return None

    # Check in-memory cache (~30 min)
    cache_k = f"{business_type}_{round(center_lat, 3)}_{round(center_lon, 3)}_{radius_meters}"
    now = time.time()
    if cache_k in _in_memory_cache:
        timestamp, cached_data = _in_memory_cache[cache_k]
        if now - timestamp < CACHE_TTL_SECONDS:
            if debug:
                logger.info("Google Places result served from in-memory cache (key=%s)", cache_k)
            res = dict(cached_data)
            res["from_cache"] = True
            return res

    included_types = GOOGLE_TYPE_MAP.get(business_type, [business_type.lower().replace(" ", "_")])

    if not _check_and_increment_daily_cap(1):
        return None

    calls_made = 0
    max_calls = 15
    results_capped = False
    all_places_by_id: Dict[str, Dict[str, Any]] = {}

    calls_made += 1
    root_places, root_saturated = _search_single_circle(
        center_lat, center_lon, radius_meters, included_types, api_key
    )

    if root_places is None:
        return None

    for p in root_places:
        pid = p.get("id")
        if pid:
            all_places_by_id[pid] = p

    if debug:
        logger.info(
            "[Google Places] Root query center=(%.4f, %.4f) radius=%dm: found %d places (saturated=%s)",
            center_lat, center_lon, radius_meters, len(root_places), root_saturated,
        )

    # Adaptive subdivision: if saturated, split into 7 sub-circles (Depth 1)
    if root_saturated:
        sub_circles = _generate_sub_circles(center_lat, center_lon, radius_meters)
        for s_lat, s_lon, s_rad in sub_circles:
            if calls_made >= max_calls:
                results_capped = True
                break
            if not _check_and_increment_daily_cap(1):
                results_capped = True
                break

            calls_made += 1
            places, saturated = _search_single_circle(s_lat, s_lon, s_rad, included_types, api_key)
            if places:
                for p in places:
                    pid = p.get("id")
                    if pid:
                        all_places_by_id[pid] = p

            # Recurse if sub-circle is also saturated (Depth 2)
            if saturated and calls_made < max_calls:
                depth2_circles = _generate_sub_circles(s_lat, s_lon, s_rad)
                for d2_lat, d2_lon, d2_rad in depth2_circles:
                    if calls_made >= max_calls:
                        results_capped = True
                        break
                    if not _check_and_increment_daily_cap(1):
                        results_capped = True
                        break
                    calls_made += 1
                    d2_places, _ = _search_single_circle(d2_lat, d2_lon, d2_rad, included_types, api_key)
                    if d2_places:
                        for p in d2_places:
                            pid = p.get("id")
                            if pid:
                                all_places_by_id[pid] = p

    # Drop places outside radius & compute distance
    formatted_businesses: List[Dict[str, Any]] = []
    for pid, p in all_places_by_id.items():
        loc = p.get("location", {})
        plat = loc.get("latitude")
        plon = loc.get("longitude")
        if plat is None or plon is None:
            continue

        dist = haversine_distance(center_lat, center_lon, plat, plon)
        if dist > radius_meters:
            continue

        # Validate category integrity: avoid showing hospitals/schools as cafes, etc.
        p_types = set(p.get("types", []))
        primary_t = p.get("primaryType")
        if primary_t:
            p_types.add(primary_t)

        bt_lower = business_type.lower()
        if bt_lower in ("cafe", "coffee_shop", "coffee shop"):
            if any(bad in p_types for bad in ("hospital", "school", "doctor", "dentist", "car_repair")):
                continue
        elif bt_lower in ("pharmacy", "drugstore"):
            if any(bad in p_types for bad in ("school", "cafe", "restaurant", "bar")):
                continue

        d_name = p.get("displayName", {}).get("text", "Unnamed Business")
        f_addr = p.get("formattedAddress", "")
        numeric_id = int(hashlib.md5(pid.encode()).hexdigest()[:8], 16)

        formatted_businesses.append({
            "id": numeric_id,
            "place_id": pid,
            "lat": plat,
            "lon": plon,
            "name": d_name,
            "address": f_addr,
            "distance_meters": round(dist, 1),
            "category": business_type,
            "source": "google_places",
        })

    # Deduplicate by coordinates and name
    seen_coords = set()
    seen_names = set()
    deduped_businesses: List[Dict[str, Any]] = []
    for b in sorted(formatted_businesses, key=lambda x: x["distance_meters"]):
        c_coord = (round(b["lat"], 4), round(b["lon"], 4))
        c_name = (b["name"].strip().lower(), round(b["lat"], 3), round(b["lon"], 3))
        if c_coord in seen_coords or c_name in seen_names:
            continue
        seen_coords.add(c_coord)
        seen_names.add(c_name)
        deduped_businesses.append(b)

    result_payload = {
        "businesses": deduped_businesses,
        "results_capped": results_capped,
        "calls_made": calls_made,
        "data_source": "google_places",
        "from_cache": False,
    }

    _in_memory_cache[cache_k] = (now, result_payload)

    return result_payload


def fetch_google_supplementary_pois(
    center_lat: float,
    center_lon: float,
    radius_meters: int,
    debug: bool = False,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fallback when Overpass fails:
    Queries Google Places for civic, transit, and demand anchors using a single root call per category.
    Respects daily cap and in-memory cache to conserve quota.
    Categories queried:
      - hospitals: ["hospital", "medical_clinic"]
      - schools: ["school", "secondary_school"]
      - colleges: ["university"]
      - transit (bus & rail): ["transit_station", "bus_stop", "subway_station", "train_station"]
    """
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        return {}

    cache_k = f"google_supp_{round(center_lat, 3)}_{round(center_lon, 3)}_{radius_meters}"
    now = time.time()
    if cache_k in _in_memory_cache:
        timestamp, cached_data = _in_memory_cache[cache_k]
        if now - timestamp < CACHE_TTL_SECONDS:
            return cached_data

    # Map category to Google Places (New) includedTypes
    category_types = {
        "hospitals": ["hospital", "medical_clinic"],
        "schools": ["school"],
        "colleges": ["university"],
        "bus_stops": ["bus_stop"],
        "railway_stations": ["transit_station", "train_station", "subway_station"],
    }

    result: Dict[str, List[Dict[str, Any]]] = {
        "hospitals": [],
        "schools": [],
        "colleges": [],
        "offices": [],
        "bus_stops": [],
        "railway_stations": [],
    }

    for cat_name, types in category_types.items():
        if not _check_and_increment_daily_cap(1):
            break
        places, _ = _search_single_circle(center_lat, center_lon, radius_meters, types, api_key)
        if not places:
            continue
        for p in places:
            loc = p.get("location", {})
            plat = loc.get("latitude")
            plon = loc.get("longitude")
            if plat is None or plon is None:
                continue
            dist = haversine_distance(center_lat, center_lon, plat, plon)
            if dist > radius_meters:
                continue
            d_name = p.get("displayName", {}).get("text", f"Unnamed {cat_name}")
            pid = p.get("id") or f"{cat_name}_{plat}_{plon}"
            numeric_id = int(hashlib.md5(pid.encode()).hexdigest()[:8], 16)
            result[cat_name].append({
                "id": numeric_id,
                "place_id": pid,
                "name": d_name,
                "lat": plat,
                "lon": plon,
                "distance_meters": round(dist, 1),
                "category": cat_name,
                "source": "google_places",
            })

    _in_memory_cache[cache_k] = (now, result)
    return result

