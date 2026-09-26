import math
from typing import List, Dict, Any, Optional, Tuple
from backend.app.schemas.spatial import CompetitorSummary, CompetitionAnalysisResult

EARTH_RADIUS_METERS = 6371000.0


def haversine_distance_meters(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great-circle distance between two geographic coordinates on Earth in meters
    using the Haversine formula.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_METERS * c


def filter_and_sort_pois_by_distance(
    center_lat: float,
    center_lon: float,
    pois: List[Dict[str, Any]],
    radius_meters: float,
) -> List[Tuple[Dict[str, Any], float]]:
    """
    Filter POIs that fall strictly within the radius buffer, returning tuples of (POI, distance_in_meters),
    sorted ascending by distance.
    """
    within_radius: List[Tuple[Dict[str, Any], float]] = []

    for poi in pois:
        poi_lat = float(poi["latitude"])
        poi_lon = float(poi["longitude"])
        dist = haversine_distance_meters(center_lat, center_lon, poi_lat, poi_lon)

        if dist <= radius_meters:
            within_radius.append((poi, dist))

    # Sort nearest first
    within_radius.sort(key=lambda item: item[1])
    return within_radius


def analyze_competition(
    category_id: str,
    center_lat: float,
    center_lon: float,
    candidate_pois: List[Dict[str, Any]],
    radius_meters: float = 2000.0,
) -> CompetitionAnalysisResult:
    """
    Compute competition metrics within the given catchment radius.
    Fewer competitors and greater nearest distance yield a higher competition opportunity score.
    """
    filtered_with_dist = filter_and_sort_pois_by_distance(
        center_lat, center_lon, candidate_pois, radius_meters
    )

    competitor_count = len(filtered_with_dist)
    nearest_dist: Optional[float] = (
        round(filtered_with_dist[0][1], 1) if filtered_with_dist else None
    )

    # Area in square kilometers = pi * (radius_in_km)^2
    radius_km = radius_meters / 1000.0
    area_sq_km = math.pi * (radius_km**2)
    density = round(competitor_count / area_sq_km, 2) if area_sq_km > 0 else 0.0

    # Compute a normalized 0-100 Competition Opportunity Score:
    # 0 competitors -> 100 (complete blue ocean)
    # 1-2 competitors -> 80-90
    # 5 competitors -> 50
    # 10+ competitors -> saturated (< 30)
    raw_opportunity = max(10.0, 100.0 - (competitor_count * 6.5))
    competition_opportunity_score = round(min(100.0, raw_opportunity), 1)

    summaries = [
        CompetitorSummary(
            id=poi.get("id"),
            name=poi.get("name", "Unnamed Facility"),
            amenity=poi.get("amenity", category_id),
            latitude=float(poi["latitude"]),
            longitude=float(poi["longitude"]),
            distance_meters=round(dist, 1),
        )
        for poi, dist in filtered_with_dist
    ]

    return CompetitionAnalysisResult(
        category_id=category_id,
        center_latitude=center_lat,
        center_longitude=center_lon,
        radius_meters=radius_meters,
        competitor_count=competitor_count,
        nearest_competitor_distance_meters=nearest_dist,
        competitor_density_per_sq_km=density,
        competition_opportunity_score=competition_opportunity_score,
        competitors=summaries,
    )
