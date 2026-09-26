from typing import List, Optional
from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    latitude: float
    longitude: float


class City(BaseModel):
    id: str = Field(..., description="Slug identifier, e.g., 'pune'")
    name: str = Field(..., description="City name")
    state: str = Field(..., description="State name")
    center: Coordinates
    study_radius_km: float = Field(default=20.0, description="Default analysis radius in km")
    observed_population: Optional[int] = Field(
        default=None,
        description="Official observed census / municipal population estimate",
    )
    data_source: str = Field(..., description="Citation of data source for transparency")
    data_confidence: str = Field(
        default="Estimated / Proxy",
        description="Honesty label (e.g., 'Verified Census', 'Estimated / Proxy', 'Simulated')",
    )


class CityListResponse(BaseModel):
    total: int
    data: List[City]
