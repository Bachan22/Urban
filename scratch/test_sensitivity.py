import sys
import os
sys.path.insert(0, os.path.abspath("."))

from backend.app.services.scoring_engine import ScoringEngine, LocationScoringInput
from backend.app.services.recommendation import recommend_candidate_sites

def test_controlled_sensitivity():
    print("=" * 80)
    print("TEST C: CONTROLLED SENSITIVITY UNIT TESTS")
    print("=" * 80)
    
    # 1. Competitor Saturation Directional Test (Cafe)
    print("\n--- 1. Competitor Density Sensitivity (Cafe, 2000m radius = ~12.57 km²) ---")
    densities = [0, 4, 15, 45, 120]
    prev_comp_score = 999.0
    for comp in densities:
        inp = LocationScoringInput(
            business_type="Cafe",
            latitude=19.2856,
            longitude=72.8691,
            radius_meters=2000,
            city_name="Mumbai",
            competitors_count=comp,
            offices_count=5,
            colleges_count=2,
            bus_stops_count=4,
            railway_stations_count=1,
            nearest_transit_dist_m=250.0,
            data_source="google_places",
        )
        res = ScoringEngine.calculate_score(inp)
        comp_factor = next(f for f in res.factors if f.key == "competitor_density")
        print(f"Competitors={comp:3d} | Comp Factor Score={comp_factor.score:5.1f} | Final Score={res.overall_score:2d} | Label={res.suitability_label}")
    
    # 2. Transit Accessibility Sensitivity
    print("\n--- 2. Transit Distance Sensitivity ---")
    distances = [100.0, 300.0, 600.0, 1200.0]
    for d in distances:
        inp = LocationScoringInput(
            business_type="Cafe",
            latitude=19.2856,
            longitude=72.8691,
            radius_meters=2000,
            city_name="Mumbai",
            competitors_count=5,
            offices_count=4,
            colleges_count=1,
            bus_stops_count=2,
            railway_stations_count=0,
            nearest_transit_dist_m=d,
            data_source="google_places",
        )
        res = ScoringEngine.calculate_score(inp)
        acc_factor = next(f for f in res.factors if f.key == "accessibility")
        print(f"Nearest Transit={d:6.1f}m | Accessibility Score={acc_factor.score:5.1f} | Final Score={res.overall_score:2d}")
        
    # 3. Missing Transit Data Penalty Test
    print("\n--- 3. Missing Transit Data & Multi-Category Completeness ---")
    inp_missing = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2856,
        longitude=72.8691,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=2,
        offices_count=0,
        colleges_count=0,
        bus_stops_count=0,
        railway_stations_count=0,
        nearest_transit_dist_m=None, # Missing transit data
        data_source="osm",
    )
    res_missing = ScoringEngine.calculate_score(inp_missing)
    risk_factor = next(f for f in res_missing.factors if f.key == "risk_and_confidence")
    acc_factor = next(f for f in res_missing.factors if f.key == "accessibility")
    print(f"Missing Transit Input -> Transit Dist Default={acc_factor.description} | Score={acc_factor.score}")
    print(f"Confidence Factor Score={risk_factor.score} | Level={res_missing.confidence_level} | Provisional={res_missing.is_provisional}")
    print(f"Warnings: {res_missing.missing_data_warnings}")
    
    # 4. Category-Specific Feature Sensitivity on Identical POI Set
    print("\n--- 4. Category-Specific Sensitivity (Same POI counts: 6 Hospitals, 1 College, 0 Offices) ---")
    for bcat in ["Cafe", "Pharmacy", "Education Institute"]:
        inp = LocationScoringInput(
            business_type=bcat,
            latitude=19.2856,
            longitude=72.8691,
            radius_meters=2000,
            city_name="Mumbai",
            competitors_count=3,
            hospitals_count=6,
            schools_count=1,
            colleges_count=1,
            offices_count=0,
            bus_stops_count=3,
            railway_stations_count=1,
            nearest_transit_dist_m=200.0,
            data_source="google_places",
        )
        res = ScoringEngine.calculate_score(inp)
        demand_factor = next(f for f in res.factors if f.key == "business_demand")
        print(f"Category={bcat:<20} | Demand Factor Score={demand_factor.score:5.1f} | Final Score={res.overall_score:2d} | Driver={res.positive_drivers[0] if res.positive_drivers else 'None'}")

    # 5. Determinism Check
    print("\n--- 5. Determinism Check: Identical inputs repeated 5 times ---")
    test_inp = LocationScoringInput(
        business_type="Cafe",
        latitude=19.2856,
        longitude=72.8691,
        radius_meters=2000,
        city_name="Mumbai",
        competitors_count=8,
        hospitals_count=2,
        schools_count=3,
        colleges_count=2,
        offices_count=4,
        bus_stops_count=5,
        railway_stations_count=1,
        nearest_transit_dist_m=180.0,
        data_source="google_places",
    )
    first_res = ScoringEngine.calculate_score(test_inp)
    all_match = True
    for _ in range(4):
        r = ScoringEngine.calculate_score(test_inp)
        if r.overall_score != first_res.overall_score or r.fuzzy_suitability_score != first_res.fuzzy_suitability_score:
            all_match = False
    print(f"Deterministic across runs? {all_match} (Score consistently = {first_res.overall_score}/100, MCDA={first_res.weighted_base_score}, Fuzzy={first_res.fuzzy_suitability_score})")

if __name__ == "__main__":
    test_controlled_sensitivity()
