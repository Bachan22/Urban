from typing import List, Optional
from pydantic import BaseModel, Field


class Category(BaseModel):
    id: str = Field(..., description="Unique slug for the category, e.g., 'healthcare'")
    name: str = Field(..., description="Human-readable category name")
    description: str = Field(..., description="Brief description of the domain")
    icon: str = Field(..., description="Icon identifier for frontend rendering")
    target_amenities: List[str] = Field(
        default_factory=list,
        description="Relevant OpenStreetMap amenities / tags associated with this category",
    )
    is_active: bool = Field(default=True, description="Whether category is currently supported")


class CategoryListResponse(BaseModel):
    total: int
    data: List[Category]
