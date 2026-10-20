"""
UrbanIQ Validation Suite: Missing Data Recovery & Reliable Scoring
==================================================================
Tests:
- Test A: API Failure (Overpass timeout/failure handling, status 'unavailable', no fake 800m transit distance)
- Test B: Successful Empty Response (status 'confirmed_zero', distinguishable from failure, proper low score)
- Test C: Partial Response (some categories succeeded, others unavailable; only affected factors flagged)
- Test D: Successful Populated Response (fixture matches exact counts and distances, empirical scoring)
- Test E: Regression & Determinism (identical inputs produce identical scores, candidate engine independence)
"""

import sys
import os
import math
from typing import Dict, Any

# Ensure urbanIq root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.scoring_engine import (
    ScoringEngine,
    LocationScoringInput,
    LocationScoringResult,
)
from backend.app.services.recommendation import (
    compute_fixed_fuzzy_score,
    haversine_distance,
)


def run_test_a():
    """Test A — API failure: simulate Overpass failure/timeout."""
    print("\n" + "=" * 60)
    print("RUNNING TEST A: API Failure (Simulated Timeout)")
    print("=" * 60)

    # In an API failure, counts are 0 because no data was received,
    # but the explicit data_statuses indicate "unavailable".
    inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2812,
        longitude=72.8561,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=0,
        hospitals_count=0,
        schools_count=0,
        colleges_count=0,
        offices_count=0,
        bus_stops_count=0,
        railway_stations_count=0,
        nearest_transit_dist_m=None,
        data_source="osm",
        data_statuses={
            "competitors": "unavailable",
            "transit": "unavailable",
            "civic": "unavailable",
            "demand": "unavailable",
        },
    )

    result: LocationScoringResult = ScoringEngine.calculate_score(inp)

    # Verifications:
    # 1. Status is unavailable, not confirmed zero
    factors_by_key = {f.key: f for f in result.factors}
    acc_factor = factors_by_key["accessibility"]
    dem_factor = factors_by_key["business_demand"]
    comp_factor = factors_by_key["competitor_density"]

    print(f"Overall Score: {result.overall_score}/100, Label: {result.suitability_label}, Confidence: {result.confidence_level}")
    print(f"Is Provisional: {result.is_provisional}")
    print(f"Accessibility Data State: {acc_factor.data_state}, Is Estimated: {acc_factor.is_estimated}, Score: {acc_factor.score}")
    print(f"Demand Data State: {dem_factor.data_state}, Is Estimated: {dem_factor.is_estimated}, Score: {dem_factor.score}")
    print(f"Transit Description: {acc_factor.description}")
    print(f"Missing Data Warnings: {result.missing_data_warnings}")

    assert acc_factor.data_state == "unavailable", f"Expected 'unavailable', got {acc_factor.data_state}"
    assert acc_factor.is_estimated is True, "Expected accessibility to be marked estimated"
    assert "800m" not in acc_factor.description, "Defect: Fake 800m distance was reported in description!"
    assert "900m" not in acc_factor.description, "Defect: Fake 900m distance was reported in description!"
    assert result.is_provisional is True, "Expected result to be provisional due to API failure"
    assert len(result.missing_data_warnings) > 0, "Expected missing data warnings"
    assert any("could not be verified" in w for w in result.missing_data_warnings), "Expected unverified warning"

    # Score should be evaluated at neutral baseline prior (~50-52/100, Fair), NOT collapsed to 38-43/100
    assert 48 <= result.overall_score <= 54, f"Expected neutral score 48-54, got {result.overall_score}"

    print(">>> TEST A PASSED: API failure correctly handled as 'unavailable' with neutral prior and no fake distances.")


def run_test_b():
    """Test B — Successful empty response: successful query returned 0 features."""
    print("\n" + "=" * 60)
    print("RUNNING TEST B: Successful Empty Response (Confirmed Zero)")
    print("=" * 60)

    inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2812,
        longitude=72.8561,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=0,
        hospitals_count=0,
        schools_count=0,
        colleges_count=0,
        offices_count=0,
        bus_stops_count=0,
        railway_stations_count=0,
        nearest_transit_dist_m=None,
        data_source="osm",
        data_statuses={
            "competitors": "confirmed_zero",
            "transit": "confirmed_zero",
            "civic": "confirmed_zero",
            "demand": "confirmed_zero",
        },
    )

    result: LocationScoringResult = ScoringEngine.calculate_score(inp)

    factors_by_key = {f.key: f for f in result.factors}
    acc_factor = factors_by_key["accessibility"]
    dem_factor = factors_by_key["business_demand"]
    comp_factor = factors_by_key["competitor_density"]

    print(f"Overall Score: {result.overall_score}/100, Label: {result.suitability_label}, Confidence: {result.confidence_level}")
    print(f"Accessibility Data State: {acc_factor.data_state}, Score: {acc_factor.score}")
    print(f"Demand Data State: {dem_factor.data_state}, Score: {dem_factor.score}")
    print(f"Transit Description: {acc_factor.description}")
    print(f"Negative Risks: {result.negative_risks}")

    assert acc_factor.data_state == "confirmed_zero", f"Expected 'confirmed_zero', got {acc_factor.data_state}"
    assert dem_factor.data_state == "confirmed_zero", f"Expected 'confirmed_zero', got {dem_factor.data_state}"
    assert acc_factor.score == 30.0, f"Expected confirmed zero transit score 30.0, got {acc_factor.score}"
    assert dem_factor.score == 30.0, f"Expected confirmed zero demand score 30.0, got {dem_factor.score}"
    # Confirmed zero absence is penalised legitimately as Poor (score < 50)
    assert result.overall_score < 50, f"Expected confirmed empty area to score < 50 (Poor), got {result.overall_score}"

    print(">>> TEST B PASSED: Confirmed zero correctly penalises genuine absence without conflating with API failure.")


def run_test_c():
    """Test C — Partial response: competitors and civic observed, but transit query timed out."""
    print("\n" + "=" * 60)
    print("RUNNING TEST C: Partial Response (Transit Failed, Competitors Observed)")
    print("=" * 60)

    inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2812,
        longitude=72.8561,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=3,
        hospitals_count=2,
        schools_count=4,
        colleges_count=2,
        offices_count=3,
        bus_stops_count=0,
        railway_stations_count=0,
        nearest_transit_dist_m=None,
        data_source="osm",
        data_statuses={
            "competitors": "observed",
            "transit": "unavailable",  # Only transit failed!
            "civic": "observed",
            "demand": "observed",
        },
    )

    result: LocationScoringResult = ScoringEngine.calculate_score(inp)

    factors_by_key = {f.key: f for f in result.factors}
    acc_factor = factors_by_key["accessibility"]
    dem_factor = factors_by_key["business_demand"]
    comp_factor = factors_by_key["competitor_density"]

    print(f"Overall Score: {result.overall_score}/100, Label: {result.suitability_label}, Confidence: {result.confidence_level}")
    print(f"Competitor Factor: {comp_factor.data_state}, Score: {comp_factor.score}")
    print(f"Demand Factor: {dem_factor.data_state}, Score: {dem_factor.score}")
    print(f"Accessibility Factor: {acc_factor.data_state}, Score: {acc_factor.score}")
    print(f"Warnings: {result.missing_data_warnings}")

    assert comp_factor.data_state == "observed", "Competitors should be observed"
    assert dem_factor.data_state == "observed", "Demand should be observed"
    assert acc_factor.data_state == "unavailable", "Transit should be unavailable"
    assert acc_factor.is_estimated is True, "Transit should be estimated"
    assert any("Transit infrastructure could not be verified" in w for w in result.missing_data_warnings)

    print(">>> TEST C PASSED: Partial response preserves observed categories and flags only the failed one.")


def run_test_d():
    """Test D — Successful populated response with rich anchors fixture."""
    print("\n" + "=" * 60)
    print("RUNNING TEST D: Successful Populated Response (Fixture Validation)")
    print("=" * 60)

    # High footfall commercial hub fixture
    inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2812,
        longitude=72.8561,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=4,
        hospitals_count=3,
        schools_count=5,
        colleges_count=3,
        offices_count=6,
        bus_stops_count=8,
        railway_stations_count=1,
        nearest_transit_dist_m=180.0,
        data_source="google_places",
        data_statuses={
            "competitors": "observed",
            "transit": "observed",
            "civic": "observed",
            "demand": "observed",
        },
    )

    result: LocationScoringResult = ScoringEngine.calculate_score(inp)

    factors_by_key = {f.key: f for f in result.factors}
    acc_factor = factors_by_key["accessibility"]
    dem_factor = factors_by_key["business_demand"]
    comp_factor = factors_by_key["competitor_density"]

    print(f"Overall Score: {result.overall_score}/100, Label: {result.suitability_label}, Confidence: {result.confidence_level}")
    print(f"Accessibility Score: {acc_factor.score} ({acc_factor.description})")
    print(f"Demand Score: {dem_factor.score} ({dem_factor.description})")
    print(f"Competitor Score: {comp_factor.score} ({comp_factor.description})")

    assert acc_factor.score >= 90.0, f"Expected accessibility score >= 90 (<=200m), got {acc_factor.score}"
    assert dem_factor.score >= 80.0, f"Expected high demand score >= 80, got {dem_factor.score}"
    assert result.confidence_level == "High", f"Expected High confidence, got {result.confidence_level}"
    assert result.overall_score >= 75, f"Expected score >= 75 (Good/Excellent), got {result.overall_score}"

    print(">>> TEST D PASSED: Populated fixture scores accurately with high confidence.")


def run_test_e():
    """Test E — Regression & Determinism: repeat identical inputs and verify candidate zone independence."""
    print("\n" + "=" * 60)
    print("RUNNING TEST E: Regression & Determinism Verification")
    print("=" * 60)

    inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2812,
        longitude=72.8561,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=5,
        hospitals_count=2,
        schools_count=3,
        colleges_count=1,
        offices_count=4,
        bus_stops_count=4,
        railway_stations_count=0,
        nearest_transit_dist_m=350.0,
        data_source="osm",
        data_statuses={
            "competitors": "observed",
            "transit": "observed",
            "civic": "observed",
            "demand": "observed",
        },
    )

    run1 = ScoringEngine.calculate_score(inp)
    run2 = ScoringEngine.calculate_score(inp)

    assert run1.overall_score == run2.overall_score, "Determinism failure: overall scores differ!"
    assert run1.weighted_base_score == run2.weighted_base_score, "Determinism failure: weighted base differs!"
    assert run1.fuzzy_suitability_score == run2.fuzzy_suitability_score, "Determinism failure: fuzzy score differs!"

    # Candidate zone independence test: evaluate two distinct coordinates with different local anchor counts
    cand1 = compute_fixed_fuzzy_score(
        competitors_500m=1,
        anchors_500m=6,
        nearest_transit_dist_m=200.0,
        business_type="Cafe",
        cell_lat=19.2810,
        cell_lon=72.8560,
        offices_count=3,
        colleges_count=2,
        transit_count=3,
    )

    cand2 = compute_fixed_fuzzy_score(
        competitors_500m=12,
        anchors_500m=1,
        nearest_transit_dist_m=950.0,
        business_type="Cafe",
        cell_lat=19.2950,
        cell_lon=72.8700,
        offices_count=0,
        colleges_count=0,
        transit_count=0,
    )

    print(f"Candidate 1 (Strong Hub): Score={cand1['score']}, Level={cand1['level']}, TransitDist={cand1['factors'][3]['value']}")
    print(f"Candidate 2 (Saturated / Poor Transit): Score={cand2['score']}, Level={cand2['level']}, TransitDist={cand2['factors'][3]['value']}")

    assert cand1["score"] > cand2["score"], f"Expected cand1 > cand2, got {cand1['score']} vs {cand2['score']}"
    assert cand1["score"] >= 65, f"Expected cand1 >= 65, got {cand1['score']}"
    assert cand2["score"] < 50, f"Expected cand2 < 50, got {cand2['score']}"

    print(">>> TEST E PASSED: Identical inputs produce identical scores; candidate zones evaluate independently.")


if __name__ == "__main__":
    run_test_a()
    run_test_b()
    run_test_c()
    run_test_d()
    run_test_e()
    print("\n" + "=" * 60)
    print("ALL 5 FOCUSED VALIDATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)
