import sys
import os
sys.path.insert(0, os.path.abspath("."))

from backend.app.services.recommendation import recommend_candidate_sites

print("=" * 80)
print("TEST B: CANDIDATE-AREA SENSITIVITY TEST (Mira Road East)")
print("=" * 80)

res1 = recommend_candidate_sites("Cafe", 19.2856, 72.8691, radius_meters=2000, city_name="Mumbai")
candidates1 = res1.get("recommended_sites", [])

print(f"Generated {len(candidates1)} candidate sites:")
coords = []
for c in candidates1:
    print(f"\nCandidate #{c['rank']}: {c.get('landmark')}")
    print(f"  Coords: ({c['latitude']}, {c['longitude']}) | Dist from center: {c['distance_from_center_m']}m")
    print(f"  Score: {c['score']}/100 [{c['suitability_label']}] | Badge: {c['badge']}")
    print(f"  Competitors (500m): {c['competitors_500m']} | Demand Anchors: {c['demand_anchors_500m']}")
    print(f"  Transit Dist: {c['nearest_transit_dist_m']}m | Street: {c['road']} (Verified: {c['has_verified_street']})")
    print(f"  Factors: {c['factors']}")
    coords.append((c['latitude'], c['longitude']))

# Check distinct coordinates
all_distinct = len(set(coords)) == len(coords)
print(f"\nAll candidate coordinates distinct? {all_distinct}")

# Check distances between all pairs are >= 350m (Spatial NMS)
from backend.app.services.recommendation import haversine_distance
min_sep = 99999.0
for i in range(len(coords)):
    for j in range(i + 1, len(coords)):
        d = haversine_distance(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
        if d < min_sep:
            min_sep = d
print(f"Minimum separation between any 2 candidates: {min_sep:.1f} m (NMS requirement: >= 350m -> {min_sep >= 349.0})")

# Run repeated run for determinism
res2 = recommend_candidate_sites("Cafe", 19.2856, 72.8691, radius_meters=2000, city_name="Mumbai")
candidates2 = res2.get("recommended_sites", [])
scores_match = [c1['score'] == c2['score'] for c1, c2 in zip(candidates1, candidates2)]
print(f"Deterministic across runs? {all(scores_match)}")

print("=" * 80)
