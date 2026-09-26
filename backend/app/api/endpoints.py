from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.tables import POIModel
from backend.app.schemas.category import Category, CategoryListResponse
from backend.app.schemas.city import City, Coordinates, CityListResponse
from backend.app.schemas.spatial import CompetitionAnalysisResult
from backend.app.schemas.service_gap import ServiceGapResult
from backend.app.schemas.opportunity import OpportunityRequest, OpportunityResponse
from backend.app.services.spatial import analyze_competition
from backend.app.services.service_gap import calculate_service_gap
from backend.app.services.opportunity import evaluate_opportunity

router = APIRouter(prefix="/api", tags=["UrbanIQ Core Analytics"])

# Curated categories (Phase 1-3 scope)
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

# Cities metadata
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


@router.get("/competition", response_model=CompetitionAnalysisResult)
def get_competition_analysis(
    category_id: str = Query("healthcare", description="Business category slug"),
    latitude: float = Query(18.5074, description="Target location latitude"),
    longitude: float = Query(73.8077, description="Target location longitude"),
    radius_meters: float = Query(2000.0, ge=100.0, le=20000.0, description="Buffer radius in meters"),
    db: Session = Depends(get_db),
):
    """
    Compute competition metrics (count, density, nearest competitor distance) around a coordinate.
    """
    db_pois = db.query(POIModel).filter(POIModel.category == category_id).all()
    pois_list = [
        {
            "id": p.id,
            "name": p.name,
            "amenity": p.amenity,
            "latitude": p.latitude,
            "longitude": p.longitude,
        }
        for p in db_pois
    ]

    if not pois_list:
        pois_list = [
            {"id": 1, "name": "Kothrud Care Clinic", "amenity": "clinic", "latitude": 18.5095, "longitude": 73.8090},
            {"id": 2, "name": "Sahyadri Hospital", "amenity": "hospital", "latitude": 18.5030, "longitude": 73.8180},
            {"id": 3, "name": "City Medical Center", "amenity": "clinic", "latitude": 18.5200, "longitude": 73.8300},
        ]

    return analyze_competition(
        category_id=category_id,
        center_lat=latitude,
        center_lon=longitude,
        candidate_pois=pois_list,
        radius_meters=radius_meters,
    )


@router.get("/service-gap", response_model=ServiceGapResult)
def get_service_gap_analysis(
    category_id: str = Query("healthcare", description="Service category slug"),
    latitude: float = Query(18.5074, description="Target location latitude"),
    longitude: float = Query(73.8077, description="Target location longitude"),
    radius_meters: float = Query(2000.0, ge=100.0, le=20000.0, description="Buffer radius in meters"),
    population_proxy: int = Query(120000, description="Estimated catchment population proxy"),
    db: Session = Depends(get_db),
):
    """
    Compute service gap metrics (population per facility, service void detection, gap severity).
    """
    db_pois = db.query(POIModel).filter(POIModel.category == category_id).all()
    pois_list = [
        {
            "id": p.id,
            "name": p.name,
            "amenity": p.amenity,
            "latitude": p.latitude,
            "longitude": p.longitude,
        }
        for p in db_pois
    ]

    if not pois_list:
        pois_list = [
            {"id": 1, "name": "Kothrud Care Clinic", "amenity": "clinic", "latitude": 18.5095, "longitude": 73.8090},
            {"id": 2, "name": "Sahyadri Hospital", "amenity": "hospital", "latitude": 18.5030, "longitude": 73.8180},
        ]

    return calculate_service_gap(
        category_id=category_id,
        center_lat=latitude,
        center_lon=longitude,
        existing_facilities=pois_list,
        population_proxy=population_proxy,
        radius_meters=radius_meters,
    )


@router.post("/opportunity", response_model=OpportunityResponse)
def post_calculate_opportunity(
    req: OpportunityRequest,
    db: Session = Depends(get_db),
):
    """
    Primary UrbanIQ Opportunity Engine.
    Executes Spatial Analysis + Service Gap + Fuzzy Logic Inference.
    Saves the computed evaluation in PostgreSQL and returns explainable reasons & risks.
    """
    return evaluate_opportunity(req, db)
