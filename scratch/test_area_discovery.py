import sys
sys.path.insert(0, ".")
from backend.app.services.recommendation import recommend_candidate_sites

print("=== TEST CASE A: Mira Road-Bhayandar (Cafe, 2000m) ===")
res_mira = recommend_candidate_sites("Cafe", 19.2856, 72.8691, 2000, "Mumbai")
print("Status:", res_mira["status"])
print("Advisory:", res_mira["suitability_advisory"])
print("Total candidates returned:", len(res_mira["recommended_sites"]))
for s in res_mira["recommended_sites"]:
    print(
        f"#{s['rank']} Locality: {s['locality']} | "
        f"Landmark: {s['landmark']} | "
        f"Coords: ({s['latitude']}, {s['longitude']}) | "
        f"Score: {s['score']}/100 | "
        f"Badge: {s['badge']} | "
        f"StreetVerified: {s['has_verified_street']} | "
        f"Comp500m: {s['competitors_500m']}"
    )

print("\n=== TEST CASE B: Pune (Education Institute, 2000m) ===")
res_pune = recommend_candidate_sites("Education Institute", 18.5204, 73.8567, 2000, "Pune")
print("Status:", res_pune["status"])
print("Advisory:", res_pune["suitability_advisory"])
print("Total candidates returned:", len(res_pune["recommended_sites"]))
for s in res_pune["recommended_sites"]:
    print(
        f"#{s['rank']} Locality: {s['locality']} | "
        f"Landmark: {s['landmark']} | "
        f"Coords: ({s['latitude']}, {s['longitude']}) | "
        f"Score: {s['score']}/100 | "
        f"Badge: {s['badge']} | "
        f"StreetVerified: {s['has_verified_street']} | "
        f"DemandAnchors500m: {s['demand_anchors_500m']}"
    )
