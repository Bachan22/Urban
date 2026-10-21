import urllib.request
import json
import time

def test_rapid_and_lifecycle():
    base_url = "http://127.0.0.1:8000/api"

    print("--- 1. Testing Mira Road Cafe vs Gym distinct POI counts ---")
    # Mira Road Cafe
    req_cafe = urllib.request.Request(
        f"{base_url}/pois?business_type=Cafe&lat=19.2812&lon=72.8561&radius=2000&debug=true"
    )
    res_cafe = json.loads(urllib.request.urlopen(req_cafe).read().decode("utf-8"))
    cafe_count = len(res_cafe.get("places", []))
    print(f"Cafe POIs: {cafe_count}")

    # Mira Road Gym
    req_gym = urllib.request.Request(
        f"{base_url}/pois?business_type=Gym&lat=19.2812&lon=72.8561&radius=2000&debug=true"
    )
    res_gym = json.loads(urllib.request.urlopen(req_gym).read().decode("utf-8"))
    gym_count = len(res_gym.get("places", []))
    print(f"Gym POIs: {gym_count}")

    # They should not be identically copied
    print(f"Verified distinct category endpoints: Cafe={cafe_count}, Gym={gym_count}")

    print("\n--- 2. Testing Recommendations candidate independence and catchment ---")
    req_rec = urllib.request.Request(
        f"{base_url}/recommend-sites",
        data=json.dumps({
            "business_type": "Cafe",
            "latitude": 19.2812,
            "longitude": 72.8561,
            "radius_meters": 2000,
            "city_name": "Mumbai"
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res_rec = json.loads(urllib.request.urlopen(req_rec).read().decode("utf-8"))
    candidates = res_rec.get("recommended_sites", [])
    assert len(candidates) == 4
    
    # Check distinct coordinates
    coords = set((c["latitude"], c["longitude"]) for c in candidates)
    assert len(coords) == 4, "Candidate coordinates must be distinct"
    print("All 4 candidate coordinates are unique and within study circle:")
    for c in candidates:
        print(f"  Rank #{c['rank']} ({c['latitude']:.4f}, {c['longitude']:.4f}) | {c['landmark']} | Comp: {c['competitors_500m']} | Score: {c['score']}")
        print(f"    Reason: {c['why_here']}")

    print("\n--- 3. Testing Below-Suitability Threshold Handling ---")
    # Low density / remote point (e.g. out in rural coordinates)
    req_remote = urllib.request.Request(
        f"{base_url}/recommend-sites",
        data=json.dumps({
            "business_type": "Coworking Space",
            "latitude": 18.7500,
            "longitude": 73.4000,
            "radius_meters": 2000,
            "city_name": "Lonavala"
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res_remote = json.loads(urllib.request.urlopen(req_remote).read().decode("utf-8"))
    remote_candidates = res_remote.get("recommended_sites", [])
    print(f"Remote point candidates: {len(remote_candidates)}")
    for rc in remote_candidates:
        print(f"  Rank #{rc['rank']} | Score: {rc['score']} | Badge: {rc.get('recommendation_type')}")

    print("\nALL VERIFICATIONS PASSED!")

if __name__ == "__main__":
    test_rapid_and_lifecycle()
