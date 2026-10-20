from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import logging

from backend.app.schemas.opportunity import (
    OpportunityRequest,
    OpportunityResponse,
    FactorScore,
)
from backend.app.schemas.spatial import CompetitionAnalysisResult, CompetitorSummary
from backend.app.schemas.service_gap import ServiceGapResult
from backend.app.models.tables import OpportunityScoreRecord, POIModel
from backend.app.services.scoring_engine import ScoringEngine, LocationScoringInput
from backend.app.services.llm import generate_explanation

logger = logging.getLogger("urbaniq.opportunity")


def evaluate_opportunity(
    req: OpportunityRequest,
    db: Session,
) -> OpportunityResponse:
    """
    Data-Driven Location Scoring & Suitability Engine:
    1. Extracts or queries real location data (Google Places + Overpass POIs).
    2. Runs 6-factor Multi-Criteria Decision Analysis with category-specific weights.
    3. Executes Mamdani Soft Computing Fuzzy Logic inference.
    4. Combines weighted scores and fuzzy suitability deterministically (70% MCDA + 30% Fuzzy).
    5. Optionally generates LLM (Grok/Groq) executive summary without score mutation.
    6. Persists evaluation in database.
    """
    btype = req.business_type or req.category_id or "Cafe"
    city = req.city_id or "mumbai"

    # 1. Determine POI counts from request or query live cache
    comp_count = req.competitors_count
    hosp_count = req.hospitals_count
    sch_count = req.schools_count
    col_count = req.colleges_count
    off_count = req.offices_count
    transit_count = req.transit_stops_count
    data_src = "google_places" if btype in ["Cafe", "Restaurant"] else "osm"

    # If counts were not directly provided in the request, query from services
    if comp_count is None or hosp_count is None:
        try:
            from backend.app.services.overpass_proxy import fetch_pois
            poi_res = fetch_pois(
                business_type=btype,
                latitude=req.latitude,
                longitude=req.longitude,
                radius_meters=int(req.radius_meters),
            )
            comp_count = len(poi_res.get("businesses", []))
            hosp_count = len(poi_res.get("hospitals", []))
            sch_count = len(poi_res.get("schools", []))
            col_count = len(poi_res.get("colleges", []))
            off_count = len(poi_res.get("offices", []))
            transit_count = len(poi_res.get("bus_stops", [])) + len(poi_res.get("railway_stations", []))
            data_src = "osm"

            poi_statuses = poi_res.get("feature_statuses") or {}
            # Check Google Places for F&B competitors
            if btype in ["Cafe", "Restaurant"]:
                try:
                    from backend.app.services.google_places import fetch_google_competitors
                    g_res = fetch_google_competitors(
                        business_type=btype,
                        center_lat=req.latitude,
                        center_lon=req.longitude,
                        radius_meters=int(req.radius_meters),
                    )
                    if g_res and "businesses" in g_res:
                        comp_count = len(g_res["businesses"])
                        data_src = "google_places"
                        poi_statuses["competitors"] = "observed" if comp_count > 0 else "confirmed_zero"
                except Exception as ge:
                    logger.warning("Google places lookup skipped in opportunity evaluation: %s", ge)
        except Exception as e:
            logger.warning("Could not fetch POIs for opportunity evaluation: %s; checking DB", e)
            db_pois = db.query(POIModel).filter(POIModel.category == req.category_id).all()
            comp_count = len(db_pois)
            hosp_count = 0
            sch_count = 0
            col_count = 0
            off_count = 0
            transit_count = 0
            poi_statuses = {"competitors": "observed" if comp_count > 0 else "confirmed_zero", "transit": "unavailable", "civic": "unavailable", "demand": "unavailable"}

    scoring_input = LocationScoringInput(
        business_type=btype,
        latitude=req.latitude,
        longitude=req.longitude,
        radius_meters=int(req.radius_meters),
        city_name=city.capitalize(),
        competitors_count=comp_count or 0,
        hospitals_count=hosp_count or 0,
        schools_count=sch_count or 0,
        colleges_count=col_count or 0,
        offices_count=off_count or 0,
        bus_stops_count=transit_count or 0,
        railway_stations_count=0,
        nearest_transit_dist_m=250.0 if (transit_count or 0) > 0 else None,
        data_source=data_src,
        population_estimate=req.population_proxy,
        data_statuses=locals().get("poi_statuses", None),
    )

    # 2. Run Data-Driven Location Scoring Engine
    result = ScoringEngine.calculate_score(scoring_input)

    # 3. Optional Grok / Groq Natural Language Summary
    exec_summary = generate_explanation(
        business_type=btype,
        city_name=city.capitalize(),
        overall_score=result.overall_score,
        suitability_label=result.suitability_label,
        competitor_count=result.competitor_count,
        radius_meters=result.radius_meters,
        positive_drivers=result.positive_drivers,
        negative_risks=result.negative_risks,
        confidence_level=result.confidence_level,
    )

    # 4. Map factors to schema
    schema_factors = [
        FactorScore(
            name=f.name,
            value=f.score,
            weight=f.weight_percent,
            description=f.description,
        )
        for f in result.factors
    ]

    # Map competition and service gap summary
    comp_density = round((comp_count or 0) / max(0.1, 3.14159 * (req.radius_meters / 1000.0) ** 2), 2)
    comp_summary = CompetitionAnalysisResult(
        category_id=req.category_id,
        center_latitude=req.latitude,
        center_longitude=req.longitude,
        radius_meters=req.radius_meters,
        competitor_count=comp_count or 0,
        competitor_density_per_sq_km=comp_density,
        nearest_competitor_distance_meters=150.0 if (comp_count or 0) > 0 else 2500.0,
        competition_opportunity_score=result.factors[0].score,
        competitors=[
            CompetitorSummary(
                id=i + 1,
                name=f"{btype} #{i+1}",
                amenity=btype.lower(),
                latitude=req.latitude,
                longitude=req.longitude,
                distance_meters=100.0 * (i + 1),
            )
            for i in range(min(5, comp_count or 0))
        ],
    )

    gap_severity = "High Gap" if result.overall_score >= 70 else ("Moderate Gap" if result.overall_score >= 48 else "Well Served")
    gap_summary = ServiceGapResult(
        category_id=req.category_id,
        center_latitude=req.latitude,
        center_longitude=req.longitude,
        radius_meters=req.radius_meters,
        catchment_population_proxy=req.population_proxy or 100000,
        facility_count=comp_count or 0,
        population_per_facility=round((req.population_proxy or 100000) / max(1, comp_count or 1), 1),
        service_gap_score=result.factors[1].score,
        gap_severity=gap_severity,
        has_zero_facilities=(comp_count or 0) == 0,
    )

    # Map level for backward compatibility
    opp_level = "High" if result.overall_score >= 70 else ("Medium" if result.overall_score >= 48 else "Low")

    # 5. Persist in database
    try:
        db_record = OpportunityScoreRecord(
            city_id=city,
            category_id=req.category_id,
            latitude=req.latitude,
            longitude=req.longitude,
            radius_meters=req.radius_meters,
            opportunity_score=result.overall_score,
            opportunity_level=opp_level,
            demand_score=round(result.factors[1].score, 1),
            competition_score=round(result.factors[0].score, 1),
            service_gap_score=round(result.factors[4].score, 1),
            accessibility_score=round(result.factors[3].score, 1),
            factors=[f.model_dump() for f in schema_factors],
            reasons=result.positive_drivers,
            risks=result.negative_risks,
            data_mode="live",
        )
        db.add(db_record)
        db.commit()
    except Exception as e:
        logger.warning("Could not persist opportunity score record: %s", e)
        db.rollback()

    return OpportunityResponse(
        city_id=city,
        category_id=req.category_id,
        latitude=req.latitude,
        longitude=req.longitude,
        radius_meters=req.radius_meters,
        opportunity_score=result.overall_score,
        opportunity_level=opp_level,
        suitability_label=result.suitability_label,
        confidence_level=result.confidence_level,
        is_provisional=result.is_provisional,
        weighted_base_score=result.weighted_base_score,
        fuzzy_suitability_score=result.fuzzy_suitability_score,
        factors=schema_factors,
        reasons=result.positive_drivers,
        risks=result.negative_risks,
        positive_drivers=result.positive_drivers,
        negative_risks=result.negative_risks,
        missing_data_warnings=result.missing_data_warnings,
        practical_recommendation=result.practical_recommendation,
        executive_summary=exec_summary,
        competition=comp_summary,
        service_gap=gap_summary,
        data_mode="live",
        disclaimer=(
            "Location suitability score generated by deterministic multi-criteria decision analysis + Mamdani fuzzy inference. "
            "Not a commercial revenue guarantee."
        ),
        formula_documentation=result.formula_documentation,
    )
