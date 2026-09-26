from typing import List
from fastapi import APIRouter
from backend.app.schemas.category import Category, CategoryListResponse
from backend.app.schemas.city import City, Coordinates, CityListResponse

router = APIRouter(prefix="/api", tags=["Metadata & Configuration"])

# Initial curated categories (Phase 1-3 scope)
CATEGORIES_DATA: List[Category] = [
    Category(
        id="healthcare",
        name="Healthcare",
        description="Hospitals, diagnostic centers, clinics, and pharmacies.",
        icon="activity",
        target_amenities=["hospital", "clinic", "pharmacy", "doctors"],
        is_active=True,
    ),
    Category(
        id="food-restaurant",
        name="Food & Restaurant",
        description="Restaurants, cafes, food courts, and quick service dining.",
        icon="utensils",
        target_amenities=["restaurant", "cafe", "fast_food", "food_court"],
        is_active=True,
    ),
    Category(
        id="education",
        name="Education",
        description="Schools, coaching centers, colleges, and training institutes.",
        icon="book-open",
        target_amenities=["school", "college", "university", "kindergarten"],
        is_active=True,
    ),
]

# Initial cities data (preserving Pune source citations)
CITIES_DATA: List[City] = [
    City(
        id="pune",
        name="Pune",
        state="Maharashtra",
        center=Coordinates(latitude=18.5204, longitude=73.8567),
        study_radius_km=20.0,
        observed_population=3556000,
        data_source="Pune Municipal Corporation ESR 2021-22",
        data_confidence="Estimated / Proxy (PMC 2021-22)",
    ),
    City(
        id="mumbai",
        name="Mumbai",
        state="Maharashtra",
        center=Coordinates(latitude=19.0760, longitude=72.8777),
        study_radius_km=25.0,
        observed_population=12442373,
        data_source="Census of India 2011 (Proxy Baseline)",
        data_confidence="Historical Census Proxy",
    ),
    City(
        id="nashik",
        name="Nashik",
        state="Maharashtra",
        center=Coordinates(latitude=19.9975, longitude=73.7898),
        study_radius_km=15.0,
        observed_population=1486053,
        data_source="Census of India 2011 (Proxy Baseline)",
        data_confidence="Historical Census Proxy",
    ),
]


@router.get("/categories", response_model=CategoryListResponse)
def get_categories():
    """Retrieve list of supported business & service opportunity categories."""
    return CategoryListResponse(total=len(CATEGORIES_DATA), data=CATEGORIES_DATA)


@router.get("/cities", response_model=CityListResponse)
def get_cities():
    """Retrieve available cities with geographic bounds and demographic sources."""
    return CityListResponse(total=len(CITIES_DATA), data=CITIES_DATA)
