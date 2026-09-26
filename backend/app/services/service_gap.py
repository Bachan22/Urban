from typing import List, Dict, Any, Optional
from backend.app.schemas.service_gap import ServiceGapResult
from backend.app.services.spatial import filter_and_sort_pois_by_distance


def calculate_service_gap(
    category_id: str,
    center_lat: float,
    center_lon: float,
    existing_facilities: List[Dict[str, Any]],
    population_proxy: int = 100000,
    radius_meters: float = 2000.0,
) -> ServiceGapResult:
    """
    Evaluate service gap based on population-to-facility density and distance to closest facility.
    Fewer facilities per capita -> Larger Service Gap -> Higher Opportunity Score.
    """
    filtered_facilities = filter_and_sort_pois_by_distance(
        center_lat, center_lon, existing_facilities, radius_meters
    )

    facility_count = len(filtered_facilities)
    has_zero = facility_count == 0

    nearest_distance: Optional[float] = (
        round(filtered_facilities[0][1], 1) if filtered_facilities else None
    )

    # Population per facility (if 0 facilities, entire population has 0 local access)
    pop_per_facility = (
        float(population_proxy)
        if has_zero
        else round(population_proxy / facility_count, 1)
    )

    # Service Gap Scoring Logic (0 - 100):
    # 0 facilities -> Gap is severe (85 - 95 score depending on distance/population)
    # 1 facility serving 100k -> High gap (~75 score)
    # 3-5 facilities -> Moderate gap (40-60 score)
    # 8+ facilities -> Well served (< 30 score)
    if has_zero:
        gap_score = 90.0
        severity = "High Gap"
    elif pop_per_facility > 50000:
        gap_score = min(85.0, 60.0 + (pop_per_facility / 5000.0))
        severity = "High Gap"
    elif pop_per_facility > 20000:
        gap_score = 55.0
        severity = "Moderate Gap"
    else:
        gap_score = max(15.0, 40.0 - (facility_count * 3.0))
        severity = "Well Served"

    return ServiceGapResult(
        category_id=category_id,
        center_latitude=center_lat,
        center_longitude=center_lon,
        radius_meters=radius_meters,
        facility_count=facility_count,
        catchment_population_proxy=population_proxy,
        population_per_facility=pop_per_facility,
        has_zero_facilities=has_zero,
        nearest_facility_distance_meters=nearest_distance,
        service_gap_score=round(gap_score, 1),
        gap_severity=severity,
    )
