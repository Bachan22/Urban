from typing import List, Optional
from pydantic import BaseModel, Field


class CompetitorSummary(BaseModel):
    id: Optional[int] = None
    name: str
    amenity: str
    latitude: float
    longitude: float
    distance_meters: float


class CompetitionAnalysisResult(BaseModel):
    category_id: str
    center_latitude: float
    center_longitude: float
    radius_meters: float
    competitor_count: int
    nearest_competitor_distance_meters: Optional[float] = None
    competitor_density_per_sq_km: float
    competition_opportunity_score: float = Field(
        ...,
        description="Normalized 0-100 score where higher means LESS competition (better market gap)",
    )
    competitors: List[CompetitorSummary]
    data_source: str = "OpenStreetMap / Overpass (Proxy Analysis)"
