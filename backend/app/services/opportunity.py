from typing import List, Dict, Any
from sqlalchemy.orm import Session

from backend.app.schemas.opportunity import (
    OpportunityRequest,
    OpportunityResponse,
    FactorScore,
)
from backend.app.services.spatial import analyze_competition
from backend.app.services.service_gap import calculate_service_gap
from backend.app.models.tables import OpportunityScoreRecord, POIModel
from fuzzy.engine import FuzzyOpportunityEngine


def evaluate_opportunity(
    req: OpportunityRequest,
    db: Session,
) -> OpportunityResponse:
    """
    Core Opportunity Engine combining:
    1. Spatial Competition Analysis
    2. Service Gap Analysis
    3. Accessibility Indicator
    4. Fuzzy Logic Soft Computing Inference
    5. Explainable Justification & Risk Generation
    6. PostgreSQL Persistence
    """
    # 1. Fetch matching POIs from DB or seed fallback
    db_pois = db.query(POIModel).filter(POIModel.category == req.category_id).all()
    pois_list: List[Dict[str, Any]] = [
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
        # Default baseline seed POIs for demonstration
        pois_list = [
            {"id": 1, "name": f"{req.city_id.capitalize()} Care Clinic", "amenity": "clinic", "latitude": req.latitude + 0.002, "longitude": req.longitude + 0.002},
            {"id": 2, "name": f"{req.city_id.capitalize()} General Hospital", "amenity": "hospital", "latitude": req.latitude - 0.005, "longitude": req.longitude + 0.004},
        ]

    # 2. Run Spatial & Service Gap Sub-Engines
    comp_result = analyze_competition(
        category_id=req.category_id,
        center_lat=req.latitude,
        center_lon=req.longitude,
        candidate_pois=pois_list,
        radius_meters=req.radius_meters,
    )

    gap_result = calculate_service_gap(
        category_id=req.category_id,
        center_lat=req.latitude,
        center_lon=req.longitude,
        existing_facilities=pois_list,
        population_proxy=req.population_proxy or 100000,
        radius_meters=req.radius_meters,
    )

    # 3. Normalized factor scores (0 - 100)
    # Demand indicator normalized around 100k population baseline
    pop = req.population_proxy or 100000
    demand_score = min(95.0, max(20.0, (pop / 150000.0) * 100.0))
    service_gap_score = gap_result.service_gap_score
    competition_score = comp_result.competition_opportunity_score
    accessibility_score = req.accessibility_proxy or 75.0

    # 4. Soft Computing / Fuzzy Logic Evaluation
    opp_score, opp_level, reasons = FuzzyOpportunityEngine.evaluate(
        demand=demand_score,
        service_gap=service_gap_score,
        competition_opportunity=competition_score,
        accessibility=accessibility_score,
    )

    # 5. Compile Traceable Factor Breakdown
    factors: List[FactorScore] = [
        FactorScore(
            name="Population Demand",
            value=round(demand_score, 1),
            weight=30.0,
            description="Concentration of residential and commercial population in zone.",
        ),
        FactorScore(
            name="Service Gap Index",
            value=round(service_gap_score, 1),
            weight=30.0,
            description="Ratio of population to available facilities (unmet demand indicator).",
        ),
        FactorScore(
            name="Competition Room",
            value=round(competition_score, 1),
            weight=20.0,
            description="Higher score indicates less competitor saturation.",
        ),
        FactorScore(
            name="Transit Accessibility",
            value=round(accessibility_score, 1),
            weight=20.0,
            description="Proximity to primary transit arterials and transport points.",
        ),
    ]

    # 6. Generate Data Honesty Risks
    risks: List[str] = [
        "Population density is based on municipal census proxies, not real-time census counts.",
        "Footfall and purchasing power proxy data has moderate confidence without proprietary card-swipe telemetry.",
    ]
    if comp_result.competitor_count > 3:
        risks.append("Competitor density is moderately clustered within the immediate 1 km sub-radius.")

    # 7. Persist Evaluation in PostgreSQL
    db_record = OpportunityScoreRecord(
        city_id=req.city_id,
        category_id=req.category_id,
        latitude=req.latitude,
        longitude=req.longitude,
        radius_meters=req.radius_meters,
        opportunity_score=opp_score,
        opportunity_level=opp_level,
        demand_score=round(demand_score, 1),
        competition_score=round(competition_score, 1),
        service_gap_score=round(service_gap_score, 1),
        accessibility_score=round(accessibility_score, 1),
        factors=[f.model_dump() for f in factors],
        reasons=reasons,
        risks=risks,
        data_mode="prototype",
    )
    db.add(db_record)
    db.commit()

    return OpportunityResponse(
        city_id=req.city_id,
        category_id=req.category_id,
        latitude=req.latitude,
        longitude=req.longitude,
        radius_meters=req.radius_meters,
        opportunity_score=opp_score,
        opportunity_level=opp_level,
        factors=factors,
        reasons=reasons,
        risks=risks,
        competition=comp_result,
        service_gap=gap_result,
    )
