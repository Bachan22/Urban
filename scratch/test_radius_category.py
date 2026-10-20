import sys
import os
sys.path.insert(0, os.path.abspath("."))

from backend.app.api.geo_poi import api_get_pois
from backend.app.services.scoring_engine import ScoringEngine, LocationScoringInput
from backend.app.services.recommendation import haversine_distance

lat, lon = 19.2856, 72.8691  # Mira Road East

print("=" * 80)
print("TEST D: RADIUS AND CATEGORY INTEGRITY TEST")
print("=" * 80)

# 1. Mira Road East 1km vs 2km for Cafe
for r in [1000, 2000]:
    res = api_get_pois("Cafe", lat, lon, radius=r)
    data = res.model_dump()
    businesses = data.get("businesses", [])
    max_d = 0.0
    within_radius = True
    for b in businesses:
        d = haversine_distance(lat, lon, b["lat"], b["lon"])
        if d > max_d: max_d = d
        if d > (r + 50.0): # 50m tolerance for GPS boundary
            within_radius = False
    print(f"Radius: {r}m | Competitors returned: {len(businesses)} | Max Distance: {max_d:.1f}m | All within radius? {within_radius}")

# 2. Mira Road East Cafe vs Pharmacy (same 2000m radius)
for cat in ["Cafe", "Pharmacy"]:
    res = api_get_pois(cat, lat, lon, radius=2000)
    data = res.model_dump()
    businesses = data.get("businesses", [])
    print(f"Category: {cat:<10} | Competitors found: {len(businesses)} | Source: {data.get('data_source')}")
    if businesses:
        print(f"  Sample 3 venues: {[b['name'] for b in businesses[:3]]}")

print("=" * 80)
