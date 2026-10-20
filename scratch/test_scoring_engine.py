"""
Focused Test for Phase 2 Location Scoring Engine & Opportunity Engine
"""
import sys
import os

# Add repo root to path
repo_root = r"c:\Users\Gurubachan Singh\Downloads\urbanIq (1)\urbanIq"
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.app.services.scoring_engine import ScoringEngine, LocationScoringInput

def test_determinism():
    inp1 = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2856,
        longitude=72.8691,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=12,
        offices_count=8,
        colleges_count=3,
        bus_stops_count=6,
        data_source="google_places",
    )
    res1 = ScoringEngine.calculate_score(inp1)
    res2 = ScoringEngine.calculate_score(inp1)
    assert res1.overall_score == res2.overall_score, "Determinism failed: scores differ!"
    assert res1.fuzzy_suitability_score == res2.fuzzy_suitability_score, "Fuzzy scores differ!"
    assert len(res1.factors) == 6, f"Expected 6 factors, got {len(res1.factors)}"
    print(f"[PASS] Determinism: identical input produced exact score {res1.overall_score}/100")

def test_category_sensitivity():
    # Same location & counts for Cafe vs Pharmacy
    cafe_inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2856,
        longitude=72.8691,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=10,
        hospitals_count=5,
        offices_count=10,
        bus_stops_count=5,
    )
    pharm_inp = LocationScoringInput(
        business_type="Pharmacy",
        latitude=19.2856,
        longitude=72.8691,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=10,
        hospitals_count=5,
        offices_count=10,
        bus_stops_count=5,
    )
    res_cafe = ScoringEngine.calculate_score(cafe_inp)
    res_pharm = ScoringEngine.calculate_score(pharm_inp)
    
    # Cafe benefits from 10 competitors + 10 offices (commercial cluster),
    # while Pharmacy suffers from 10 competing pharmacies (cannibalization)
    assert res_cafe.factors[0].score != res_pharm.factors[0].score, "Competitor score should differ between Cafe and Pharmacy!"
    print(f"[PASS] Category Sensitivity: Cafe Score={res_cafe.overall_score} (Comp Score={res_cafe.factors[0].score}), Pharmacy Score={res_pharm.overall_score} (Comp Score={res_pharm.factors[0].score})")

def test_competitor_density_impact():
    # 2 competitors vs 35 competitors
    low_comp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2856,
        longitude=72.8691,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=2,
        offices_count=8,
        bus_stops_count=4,
    )
    high_comp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2856,
        longitude=72.8691,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=35,
        offices_count=8,
        bus_stops_count=4,
    )
    res_low = ScoringEngine.calculate_score(low_comp)
    res_high = ScoringEngine.calculate_score(high_comp)
    assert res_low.factors[0].score > res_high.factors[0].score, "Lower competitor count should yield higher competitor score!"
    print(f"[PASS] Competitor Density Impact: 2 competitors -> {res_low.factors[0].score}/100 vs 35 competitors -> {res_high.factors[0].score}/100")

def test_missing_data_and_provisional():
    sparse_inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.1000,
        longitude=72.9000,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=0,
        offices_count=0,
        bus_stops_count=0,
        data_source="osm",
    )
    res = ScoringEngine.calculate_score(sparse_inp)
    assert res.confidence_level == "Low" or res.is_provisional, "Sparse data should be flagged as Low confidence or provisional!"
    assert len(res.missing_data_warnings) > 0, "Missing data warnings should be populated!"
    print(f"[PASS] Missing Data: Confidence={res.confidence_level}, Provisional={res.is_provisional}, Warnings={res.missing_data_warnings}")

if __name__ == "__main__":
    test_determinism()
    test_category_sensitivity()
    test_competitor_density_impact()
    test_missing_data_and_provisional()
    print("\nALL FOCUSED TESTS PASSED SUCCESSFULLY!")
