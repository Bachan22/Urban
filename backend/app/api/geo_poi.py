"""
UrbanIQ — Geocoding & POI API Endpoints (Stage A + B)
======================================================
/api/geocode         — Forward geocode with city-biased Nominatim
/api/reverse-geocode — Reverse geocode lat/lon
/api/pois            — Real Overpass POI fetch with mirror failover
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from backend.app.services.geocoding import (
    geocode_location,
    reverse_geocode,
    CITY_BBOXES,
)
from backend.app.services.overpass_proxy import fetch_pois

router = APIRouter(prefix="/api", tags=["Geocoding & POI Data"])


# ── Schemas ──────────────────────────────────────────────────────────

class GeocodeRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Location search string")
    city: str = Field("pune", description="City key: pune, mumbai, nashik")


class GeocodeResponse(BaseModel):
    latitude: float
    longitude: float
    display_name: str
    locality: Optional[str] = None
    is_outside_city: Optional[bool] = False
    source: Optional[str] = "osm"


class ReverseGeocodeResponse(BaseModel):
    display_name: str
    name: str
    road: str
    suburb: str
    city: str


class POIPlace(BaseModel):
    id: int
    lat: float
    lon: float
    name: str
    category: str
    place_id: Optional[str] = None
    address: Optional[str] = None
    distance_meters: Optional[float] = None
    source: Optional[str] = None


class DataQualityInfo(BaseModel):
    overall_status: str = "complete"  # "complete" | "partial" | "degraded"
    category_statuses: Dict[str, str] = {}
    feature_statuses: Dict[str, str] = {}
    warnings: List[str] = []


class POIResponse(BaseModel):
    businesses: List[POIPlace]
    hospitals: List[POIPlace]
    schools: List[POIPlace]
    colleges: List[POIPlace]
    offices: List[POIPlace]
    bus_stops: List[POIPlace]
    railway_stations: List[POIPlace]
    timestamp: str
    mirror: str
    from_cache: bool
    poi_counts: Dict[str, int]
    data_source: Optional[str] = "osm"
    results_capped: Optional[bool] = False
    calls_made: Optional[int] = 0
    feature_statuses: Optional[Dict[str, str]] = None
    data_quality: Optional[DataQualityInfo] = None


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/geocode", response_model=GeocodeResponse)
def api_geocode(req: GeocodeRequest):
    """
    Forward geocode a location string, biased to the selected city.
    Uses bounded viewbox first, then retries unbounded.
    """
    result = geocode_location(req.query, req.city)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Could not geocode '{req.query}' in {req.city}. Try a more specific name or click on the map.",
        )
    return GeocodeResponse(**result)


@router.get("/reverse-geocode", response_model=ReverseGeocodeResponse)
def api_reverse_geocode(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """Reverse geocode a lat/lon point to a place name."""
    result = reverse_geocode(lat, lon)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Could not reverse geocode this location.",
        )
    return ReverseGeocodeResponse(**result)


@router.get("/pois", response_model=POIResponse)
def api_get_pois(
    business_type: str = Query(..., description="Business type to search for"),
    lat: float = Query(..., description="Center latitude"),
    lon: float = Query(..., description="Center longitude"),
    radius: int = Query(2000, ge=500, le=10000, description="Search radius in meters"),
    debug: bool = Query(False, description="If true, log extra debug info"),
):
    """
    Fetch real POIs from Overpass API within the given radius.
    Uses multi-mirror failover and caching. No mock/fake data.
    Raises HTTP 503 if all mirrors fail.
    """
    import logging
    import hashlib
    from backend.app.database.sqlite_cache import get_cached_entry, set_cached_entry

    logger = logging.getLogger("urbaniq.pois")

    if debug:
        logger.setLevel(logging.DEBUG)
        logger.info(
            "DEBUG POI request: business_type=%s lat=%.5f lon=%.5f radius=%d",
            business_type, lat, lon, radius,
        )

    # 0. Check combined SQLite cache for fast sub-millisecond response
    ck = f"combined_poi_{business_type}_{round(lat, 3)}_{round(lon, 3)}_{radius}"
    ck_hash = hashlib.md5(ck.encode()).hexdigest()
    cached = get_cached_entry(ck_hash)
    if cached is not None:
        cached["from_cache"] = True
        if debug:
            logger.info("Serving combined POI response from SQLite cache for %s", ck)
        return POIResponse(**cached)

    # 1. Query Google Places (New) for competitors
    import datetime
    result = {
        "businesses": [],
        "hospitals": [],
        "schools": [],
        "colleges": [],
        "offices": [],
        "bus_stops": [],
        "railway_stations": [],
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "mirror": "none",
        "from_cache": False,
        "poi_counts": {
            "businesses": 0, "hospitals": 0, "schools": 0,
            "colleges": 0, "offices": 0, "bus_stops": 0, "railway_stations": 0,
        },
    }

    data_source = "osm"
    results_capped = False
    calls_made = 0

    category_statuses: Dict[str, str] = {
        "businesses": "unavailable",
        "hospitals": "unavailable",
        "schools": "unavailable",
        "colleges": "unavailable",
        "offices": "unavailable",
        "bus_stops": "unavailable",
        "railway_stations": "unavailable",
    }
    warnings: List[str] = []

    try:
        from backend.app.services.google_places import fetch_google_competitors
        google_res = fetch_google_competitors(
            business_type=business_type,
            center_lat=lat,
            center_lon=lon,
            radius_meters=radius,
            debug=debug,
        )
        if google_res and "businesses" in google_res:
            result["businesses"] = google_res["businesses"]
            data_source = "google_places"
            results_capped = google_res.get("results_capped", False)
            calls_made = google_res.get("calls_made", 0)
            result["poi_counts"]["businesses"] = len(google_res["businesses"])
            category_statuses["businesses"] = "observed" if len(google_res["businesses"]) > 0 else "confirmed_zero"
            if debug:
                logger.info(
                    "Competitor search: used Google Places, found %d competitors with %d calls",
                    len(google_res["businesses"]), calls_made,
                )
    except Exception as e:
        logger.warning("Google Places competitor search failed: %s", e)
        warnings.append("Competitor search via Google Places failed; using fallback if available.")
        category_statuses["businesses"] = "unavailable"

    # 2. Fetch supplementary POIs (hospitals, schools, colleges, transit) from Overpass
    try:
        osm_res = fetch_pois(
            business_type=business_type,
            latitude=lat,
            longitude=lon,
            radius_meters=radius,
        )
        if osm_res:
            osm_status = osm_res.get("source_status", "observed")
            osm_cats = osm_res.get("category_statuses", {})
            for k in ["hospitals", "schools", "colleges", "offices", "bus_stops", "railway_stations"]:
                if k in osm_res and osm_res[k]:
                    result[k] = osm_res[k]
                    result["poi_counts"][k] = len(osm_res[k])
                category_statuses[k] = osm_cats.get(k, "unavailable" if osm_status == "unavailable" else ("observed" if len(result.get(k, [])) > 0 else "confirmed_zero"))

            if data_source == "osm":
                if "businesses" in osm_res and osm_res["businesses"]:
                    result["businesses"] = osm_res["businesses"]
                    result["poi_counts"]["businesses"] = len(osm_res["businesses"])
                    category_statuses["businesses"] = "observed"
                elif osm_status != "unavailable":
                    category_statuses["businesses"] = "confirmed_zero"

            if osm_status == "unavailable":
                warnings.append("Civic, transit, and demand anchors unavailable: Overpass API timed out or failed.")
            result["mirror"] = osm_res.get("mirror", "none")
    except Exception as e:
        logger.warning("Supplementary Overpass POI fetch failed: %s", e)
        warnings.append("Supplementary spatial data queries failed.")
        for k in ["hospitals", "schools", "colleges", "offices", "bus_stops", "railway_stations"]:
            category_statuses[k] = "unavailable"

    # Aggregate feature-level statuses
    transit_observed = (len(result.get("bus_stops", [])) + len(result.get("railway_stations", []))) > 0
    transit_unavail = category_statuses["bus_stops"] == "unavailable" and category_statuses["railway_stations"] == "unavailable"
    transit_status = "observed" if transit_observed else ("unavailable" if transit_unavail else "confirmed_zero")

    civic_observed = (len(result.get("hospitals", [])) + len(result.get("schools", []))) > 0
    civic_unavail = category_statuses["hospitals"] == "unavailable" and category_statuses["schools"] == "unavailable"
    civic_status = "observed" if civic_observed else ("unavailable" if civic_unavail else "confirmed_zero")

    demand_observed = (len(result.get("offices", [])) + len(result.get("colleges", [])) + (1 if transit_observed else 0)) > 0
    demand_unavail = category_statuses["offices"] == "unavailable" and category_statuses["colleges"] == "unavailable"
    demand_status = "observed" if demand_observed else ("unavailable" if demand_unavail else "confirmed_zero")

    feature_statuses = {
        "competitors": category_statuses.get("businesses", "unavailable"),
        "transit": transit_status,
        "civic": civic_status,
        "demand": demand_status,
        "offices": category_statuses.get("offices", "unavailable"),
        "colleges": category_statuses.get("colleges", "unavailable"),
        "hospitals": category_statuses.get("hospitals", "unavailable"),
    }

    # Overall quality
    if all(s in ("observed", "confirmed_zero") for s in feature_statuses.values()):
        overall_status = "complete"
    elif any(s == "observed" for s in feature_statuses.values()):
        overall_status = "partial"
    else:
        overall_status = "degraded"

    result["data_source"] = data_source
    result["results_capped"] = results_capped
    result["calls_made"] = calls_made
    result["feature_statuses"] = feature_statuses
    result["data_quality"] = {
        "overall_status": overall_status,
        "category_statuses": category_statuses,
        "feature_statuses": feature_statuses,
        "warnings": warnings,
    }

    # Recalculate exact poi_counts to match actual returned arrays
    result["poi_counts"] = {
        "businesses": len(result.get("businesses", [])),
        "hospitals": len(result.get("hospitals", [])),
        "schools": len(result.get("schools", [])),
        "colleges": len(result.get("colleges", [])),
        "offices": len(result.get("offices", [])),
        "bus_stops": len(result.get("bus_stops", [])),
        "railway_stations": len(result.get("railway_stations", [])),
    }

    # Only persist in SQLite if purely OSM and query was not unavailable
    if data_source == "osm" and overall_status != "degraded":
        try:
            set_cached_entry(ck_hash, "poi", result, 86400)
        except Exception as e:
            logger.warning("Could not cache combined POI response: %s", e)

    if debug:
        logger.info(
            "DEBUG POI result: source=%s quality=%s counts=%s",
            data_source, overall_status, result.get("poi_counts"),
        )

    return POIResponse(**result)


# ── Candidate Site Recommendation (Stage C) ──────────────────────────

class RecommendRequest(BaseModel):
    business_type: str = Field("Cafe")
    latitude: float
    longitude: float
    radius_meters: int = Field(2000, ge=500, le=10000)
    city_name: str = Field("Mumbai")


@router.post("/recommend-sites")
def api_recommend_sites(req: RecommendRequest):
    """
    Candidate Site Recommendation Engine (TCS Grid + Land Mask + Fuzzy + AI/ML)
    """
    from backend.app.services.recommendation import recommend_candidate_sites
    try:
        return recommend_candidate_sites(
            business_type=req.business_type,
            center_lat=req.latitude,
            center_lon=req.longitude,
            radius_meters=req.radius_meters,
            city_name=req.city_name,
        )
    except Exception as e:
        import logging
        logging.getLogger("urbaniq.recommend").exception("Recommendation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

