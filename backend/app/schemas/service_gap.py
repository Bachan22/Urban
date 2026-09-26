from typing import Optional
from pydantic import BaseModel, Field


class ServiceGapResult(BaseModel):
    category_id: str
    center_latitude: float
    center_longitude: float
    radius_meters: float
    facility_count: int
    catchment_population_proxy: int
    population_per_facility: float
    has_zero_facilities: bool = Field(
        ...,
        description="True if no facilities exist within the catchment area (critical service void)",
    )
    nearest_facility_distance_meters: Optional[float] = None
    service_gap_score: float = Field(
        ...,
        description="0-100 score where higher means LARGER gap / higher unmet public demand",
    )
    gap_severity: str = Field(..., description="'High Gap', 'Moderate Gap', or 'Well Served'")
    data_label: str = "Demographic Proxy (Not proof of commercial revenue)"
