"""
UrbanIQ — Backend Nominatim Geocoding Proxy
============================================
- Calls Nominatim from the server with proper User-Agent.
- 1 request/second throttle.
- SQLite persistent cache with 14-day TTL.
- City bounding-box biasing with MMR viewbox support.
- Query normalization and candidate priority (stations/suburbs/roads before POIs).
- Viewbox format: left,top,right,bottom = (lon_min, lat_max, lon_max, lat_min).
"""

import time
import hashlib
import json
import re
import logging
from typing import Optional, Dict, Any, List

import httpx

from backend.app.database.sqlite_cache import (
    get_cached_entry,
    set_cached_entry,
    TTL_GEOCODE_SECONDS,
)

logger = logging.getLogger("urbaniq.geocoding")

USER_AGENT = "UrbanIQ-Capstone/1.0 (BTech Final Year Project; contact: team@urbaniq.local)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"

# Nominatim viewbox format: left, top, right, bottom = lon_min, lat_max, lon_max, lat_min
CITY_BBOXES: Dict[str, Dict[str, Any]] = {
    "pune": {
        "name": "Pune",
        "state": "Maharashtra",
        # Covers Pune, Pimpri-Chinchwad, Hinjewadi, Hadapsar
        "viewbox": "73.65,18.78,74.05,18.35",
        "center": {"latitude": 18.5204, "longitude": 73.8567},
    },
    "mumbai": {
        "name": "Mumbai",
        "state": "Maharashtra",
        # Mumbai covers MMR: lat 18.88-19.50, lon 72.75-73.25
        "viewbox": "72.75,19.50,73.25,18.88",
        "center": {"latitude": 19.0760, "longitude": 72.8777},
    },
    "nashik": {
        "name": "Nashik",
        "state": "Maharashtra",
        # Covers Nashik city and Nashik Road
        "viewbox": "73.65,20.10,73.92,19.88",
        "center": {"latitude": 19.9975, "longitude": 73.7898},
    },
}


class NominatimThrottle:
    """Ensures at most 1 request per second to Nominatim per OSM policy."""

    def __init__(self):
        self._last_request_time: float = 0.0

    def wait(self):
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        self._last_request_time = time.monotonic()


_throttle = NominatimThrottle()


def _cache_key(prefix: str, **kwargs) -> str:
    raw = prefix + "_" + json.dumps(kwargs, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def _is_inside_bbox(lat: float, lon: float, viewbox_str: str) -> bool:
    """Check if lat/lon is inside viewbox: lon_min,lat_max,lon_max,lat_min"""
    try:
        parts = [float(p) for p in viewbox_str.split(",")]
        lon_min, lat_max, lon_max, lat_min = parts
        return (lat_min <= lat <= lat_max) and (lon_min <= lon <= lon_max)
    except Exception:
        return True


def _google_geocode(
    query: str,
    city_info: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Geocode using Google Geocoding API.
    Uses components=country:IN and soft bounds biasing to city box.
    Returns latitude, longitude, display_name, locality, is_outside_city, source="google"
    """
    from backend.app.core.config import settings
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        return None

    _throttle.wait()
    try:
        # Convert viewbox (lon_min,lat_max,lon_max,lat_min) to Google bounds format: "south,west|north,east"
        parts = [float(p) for p in city_info["viewbox"].split(",")]
        lon_min, lat_max, lon_max, lat_min = parts
        bounds_str = f"{lat_min},{lon_min}|{lat_max},{lon_max}"

        # Try clean query first with soft bounds bias (allows outside places like Palghar to resolve cleanly)
        clean_q = re.sub(r',\s*' + re.escape(city_info['name']) + r'.*$', '', query, flags=re.IGNORECASE).strip()
        address_to_use = f"{clean_q}, Maharashtra, India" if clean_q.lower() in ["palghar", "thane", "alibaug", "vasai", "virar", "raigad"] else f"{query}, {city_info['name']}"

        params = {
            "address": address_to_use,
            "components": "country:IN",
            "bounds": bounds_str,
            "key": api_key,
        }
        with httpx.Client(timeout=10.0) as client:
            resp = client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
            if resp.status_code != 200:
                logger.warning("Google geocode HTTP status %d", resp.status_code)
                return None
            data = resp.json()
            if data.get("status") != "OK" or not data.get("results"):
                # Fallback to appending city
                if address_to_use != f"{query}, {city_info['name']}":
                    params["address"] = f"{query}, {city_info['name']}"
                    resp = client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
                    data = resp.json() if resp.status_code == 200 else {}
                if data.get("status") != "OK" or not data.get("results"):
                    logger.warning("Google geocode returned status: %s", data.get("status"))
                    return None

            top = data["results"][0]
            lat = float(top["geometry"]["location"]["lat"])
            lon = float(top["geometry"]["location"]["lng"])
            formatted_addr = top.get("formatted_address", "")

            # Extract locality or administrative_area
            locality = ""
            for comp in top.get("address_components", []):
                types = comp.get("types", [])
                if "locality" in types or "sublocality" in types or "administrative_area_level_2" in types:
                    locality = comp.get("long_name", "")
                    break

            inside_box = _is_inside_bbox(lat, lon, city_info["viewbox"])

            return {
                "latitude": lat,
                "longitude": lon,
                "display_name": formatted_addr,
                "locality": locality or city_info["name"],
                "is_outside_city": not inside_box,
                "source": "google",
            }
    except Exception as e:
        logger.warning("Google geocode exception: %s", e)
        return None


def geocode_location(
    query: str,
    city_key: str = "pune",
) -> Optional[Dict[str, Any]]:
    """
    Forward geocode a location string.
    First tries Google Geocoding API (with soft bounds bias).
    Falls back to city-biased Nominatim if Google fails or key is missing.
    """
    city_key = city_key.lower().strip()
    city_info = CITY_BBOXES.get(city_key, CITY_BBOXES["pune"])

    normalized_query = query.strip()
    cache_k = _cache_key("fwd", query=normalized_query.lower(), city=city_key)

    cached = get_cached_entry(cache_k)
    if cached is not None:
        return cached if cached.get("__none__") is not True else None

    # 1. Try Google Geocoding API first
    google_res = _google_geocode(normalized_query, city_info)
    if google_res:
        set_cached_entry(cache_k, "geocode", google_res, TTL_GEOCODE_SECONDS)
        return google_res

    # 2. Fallback: Nominatim geocoding
    clean_query = re.sub(
        r',\s*' + re.escape(city_info['name']) + r'.*$',
        '',
        normalized_query,
        flags=re.IGNORECASE
    ).strip()

    search_query = f"{clean_query}, {city_info['name']}, India"

    # Try bounded=1 first
    result = _nominatim_search(search_query, viewbox=city_info["viewbox"], bounded=True)
    if not result and clean_query != normalized_query:
        result = _nominatim_search(f"{normalized_query}, India", viewbox=city_info["viewbox"], bounded=True)

    # Retry unbounded with city name appended
    if not result:
        result = _nominatim_search(search_query, viewbox=city_info["viewbox"], bounded=False)

    if result:
        result["source"] = "osm"
        result["locality"] = city_info["name"]
        result["is_outside_city"] = False
        set_cached_entry(cache_k, "geocode", result, TTL_GEOCODE_SECONDS)
        return result

    # Never silently fall back to city centre; return None
    set_cached_entry(cache_k, "geocode", {"__none__": True}, 3600.0)
    return None


def _google_reverse_geocode(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """
    Reverse geocode using Google Geocoding API with sublocality and road extraction.
    Only called for shortlisted candidate zones to strictly conserve API calls and respect quotas.
    """
    from backend.app.core.config import settings
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        return None

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"latlng": f"{lat},{lon}", "key": api_key},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("status") != "OK" or not data.get("results"):
                return None

            results = data["results"]
            road = ""
            suburb = ""
            locality = ""
            name = ""

            for res in results:
                comps = res.get("address_components", [])
                types = res.get("types", [])
                for c in comps:
                    c_types = c.get("types", [])
                    if not road and "route" in c_types:
                        road = c.get("long_name", "")
                    if not suburb and ("sublocality_level_1" in c_types or "sublocality" in c_types or "neighborhood" in c_types):
                        suburb = c.get("long_name", "")
                    if not locality and ("locality" in c_types or "administrative_area_level_2" in c_types):
                        locality = c.get("long_name", "")
                if "point_of_interest" in types or "premise" in types:
                    if not name and comps:
                        name = comps[0].get("long_name", "")
                if road and suburb:
                    break

            top = results[0]
            display_name = top.get("formatted_address", "")
            if not name:
                name = road or suburb or locality or (display_name.split(",")[0] if display_name else "")

            has_road = bool(road and len(road.strip()) > 1 and not road.lower().startswith("unnamed"))

            return {
                "display_name": display_name,
                "name": name,
                "road": road if has_road else "",
                "suburb": suburb,
                "locality": locality or suburb,
                "city": locality,
                "has_verified_street": has_road,
                "source": "google",
            }
    except Exception as e:
        logger.warning("Google reverse geocode failed: %s", e)
        return None


def reverse_geocode(latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
    """
    Reverse geocode lat/lon to a place name.
    Checks cache first, then Google API, then Nominatim as fallback.
    Returns {"display_name": str, "name": str, "road": str, "suburb": str, "city": str, "has_verified_street": bool} or None.
    """
    rlat = round(latitude, 5)
    rlon = round(longitude, 5)

    cache_k = _cache_key("rev", lat=rlat, lon=rlon)
    cached = get_cached_entry(cache_k)
    if cached is not None:
        return cached if cached.get("__none__") is not True else None

    # 1. Try Google Reverse Geocoding first (if key configured)
    g_res = _google_reverse_geocode(rlat, rlon)
    if g_res:
        set_cached_entry(cache_k, "geocode", g_res, TTL_GEOCODE_SECONDS)
        return g_res

    # 2. Fallback to Nominatim
    _throttle.wait()
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                f"{NOMINATIM_URL}/reverse",
                params={
                    "lat": str(rlat),
                    "lon": str(rlon),
                    "format": "jsonv2",
                    "zoom": "16",
                },
                headers={
                    "User-Agent": USER_AGENT,
                    "Referer": "https://urbaniq.app",
                },
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            road = data.get("address", {}).get("road", "")
            has_road = bool(road and len(road.strip()) > 1 and not road.lower().startswith("unnamed"))
            result = {
                "display_name": data.get("display_name", ""),
                "name": data.get("name", data.get("display_name", "").split(",")[0]),
                "road": road if has_road else "",
                "suburb": data.get("address", {}).get("suburb", data.get("address", {}).get("neighbourhood", "")),
                "locality": data.get("address", {}).get("suburb", data.get("address", {}).get("city", "")),
                "city": data.get("address", {}).get("city", data.get("address", {}).get("town", "")),
                "has_verified_street": has_road,
                "source": "osm",
            }
            set_cached_entry(cache_k, "geocode", result, TTL_GEOCODE_SECONDS)
            return result
    except Exception as e:
        logger.warning("Reverse geocoding failed: %s", e)
        return None


def _nominatim_search(
    query: str,
    viewbox: str,
    bounded: bool,
) -> Optional[Dict[str, Any]]:
    """Execute Nominatim search request and prioritize locality/transit/road nodes."""
    _throttle.wait()
    try:
        params: Dict[str, str] = {
            "q": query,
            "format": "jsonv2",
            "limit": "5",
            "countrycodes": "in",
            "viewbox": viewbox,
        }
        if bounded:
            params["bounded"] = "1"

        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                f"{NOMINATIM_URL}/search",
                params=params,
                headers={
                    "User-Agent": USER_AGENT,
                    "Referer": "https://urbaniq.app",
                },
            )
            if resp.status_code != 200:
                return None
            results = resp.json()
            if not results:
                return None

            # Priority ranking: stations, suburbs, neighbourhoods, roads > single commercial shops
            preferred = None
            for hit in results:
                hit_type = hit.get("type", "")
                hit_class = hit.get("class", "")
                if hit_type in ("station", "suburb", "neighbourhood", "administrative", "locality", "residential") or hit_class in ("railway", "boundary", "place", "highway"):
                    preferred = hit
                    break

            selected = preferred or results[0]
            return {
                "latitude": float(selected["lat"]),
                "longitude": float(selected["lon"]),
                "display_name": selected.get("display_name", ""),
            }
    except Exception as e:
        logger.warning("Nominatim forward search failed: %s", e)
        return None
