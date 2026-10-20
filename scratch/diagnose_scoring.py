import sys
import os
sys.path.insert(0, os.path.abspath("."))

from backend.app.api.geo_poi import api_get_pois
from backend.app.services.scoring_engine import ScoringEngine, LocationScoringInput
from backend.app.services.recommendation import haversine_distance

locations = [
    ("Mira Road East", 19.2856, 72.8691, "Mumbai"),
    ("Palghar Commercial", 19.6967, 72.7655, "Palghar"),
    ("Pune FC Road", 18.5196, 73.8415, "Pune"),
    ("Peripheral Palghar (Rural/Sparse)", 19.7400, 72.8100, "Palghar"),
]

print("=" * 80)
print("LOCATION SCORING PIPELINE DIAGNOSTIC REPORT")
print("=" * 80)

results = []

for name, lat, lon, city in locations:
    res_obj = api_get_pois(business_type="Cafe", lat=lat, lon=lon, radius=2000, debug=False)
    pdata = res_obj.model_dump()
    b = pdata.get("businesses", [])
    h = pdata.get("hospitals", [])
    s = pdata.get("schools", [])
    c = pdata.get("colleges", [])
    o = pdata.get("offices", [])
    bus = pdata.get("bus_stops", [])
    rail = pdata.get("railway_stations", [])
    transit = bus + rail
    nearest_d = 800.0
    if transit:
        nearest_d = min(haversine_distance(lat, lon, t["lat"], t["lon"]) for t in transit)
    
    inp = LocationScoringInput(
        business_type="Cafe",
        latitude=lat,
        longitude=lon,
        radius_meters=2000,
        city_name=city,
        competitors_count=len(b),
        hospitals_count=len(h),
        schools_count=len(s),
        colleges_count=len(c),
        offices_count=len(o),
        bus_stops_count=len(bus),
        railway_stations_count=len(rail),
        nearest_transit_dist_m=nearest_d,
        data_source=pdata.get("data_source", "osm"),
    )
    res = ScoringEngine.calculate_score(inp)
    results.append((name, city, inp, res, pdata))
    
    print(f"\n### {name} ({city})")
    print(f"Coordinates: ({lat}, {lon}) | Radius: 2000m | Data Source: {pdata.get('data_source')}")
    print(f"Raw POI Counts: Comp={len(b)}, Hosp={len(h)}, Schools={len(s)}, Colleges={len(c)}, Offices={len(o)}, BusStops={len(bus)}, Railway={len(rail)}")
    print(f"Nearest Transit Distance: {nearest_d:.1f} m")
    print("-" * 60)
    print(f"{'Factor Name':<30} | {'Raw Score':<10} | {'Weight':<8} | {'Contrib'}")
    print("-" * 60)
    for f in res.factors:
        print(f"{f.name:<30} | {f.score:<10.1f} | {f.weight_percent:<7.1f}% | +{f.weighted_contribution:.1f}")
    print("-" * 60)
    print(f"MCDA Weighted Base Score: {res.weighted_base_score:.1f}/100 (Weight: 70% -> {0.70*res.weighted_base_score:.1f} pts)")
    print(f"Mamdani Fuzzy Suitability: {res.fuzzy_suitability_score:.1f}/100 (Weight: 30% -> {0.30*res.fuzzy_suitability_score:.1f} pts)")
    print(f"Raw Combined: {0.70 * res.weighted_base_score + 0.30 * res.fuzzy_suitability_score:.2f}")
    print(f"Authoritative Final Score: {res.overall_score}/100 [{res.suitability_label}]")
    print(f"Data Confidence Level: {res.confidence_level} (Provisional: {res.is_provisional})")
    print(f"Missing Data Warnings: {res.missing_data_warnings}")
    print(f"Positive Drivers: {res.positive_drivers}")
    print(f"Risks / Trade-offs: {res.negative_risks}")

print("\n" + "=" * 80)
