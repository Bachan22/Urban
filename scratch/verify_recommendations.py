import urllib.request
import json

def run_tests():
    url = "http://127.0.0.1:8000/api/recommend-sites"
    
    # Test A: Mira Road Cafe 2000m
    payload_a = {
        "business_type": "Cafe",
        "latitude": 19.2812,
        "longitude": 72.8561,
        "radius_meters": 2000,
        "city_name": "Mumbai"
    }
    req_a = urllib.request.Request(url, data=json.dumps(payload_a).encode("utf-8"), headers={"Content-Type": "application/json"})
    res_a = urllib.request.urlopen(req_a)
    data_a = json.loads(res_a.read().decode("utf-8"))
    sites_a = data_a.get("recommended_sites", [])
    
    print(f"=== TEST A: Mira Road Cafe (2000m) ===")
    print(f"Count: {len(sites_a)}")
    assert len(sites_a) == 4, f"Expected 4 sites, got {len(sites_a)}"
    for s in sites_a:
        print(f"#{s['rank']}: {s['landmark']} | Score: {s['score']} | Dist: {s['distance_from_center_m']}m | Comp: {s['competitors_500m']} | Transit: {s['nearest_transit_dist_m']}m")
        print(f"  Reason: {s['why_here'][0]}")
        assert s["distance_from_center_m"] <= 2000, f"Candidate {s['landmark']} outside radius"
        assert "Pune" not in s["landmark"] and "Palghar" not in s["landmark"], "Foreign city detected in candidate"
    print(">>> Test A PASSED!\n")

    # Test B: Change search to Pune Pharmacy (2000m)
    payload_b = {
        "business_type": "Pharmacy",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "radius_meters": 2000,
        "city_name": "Pune"
    }
    req_b = urllib.request.Request(url, data=json.dumps(payload_b).encode("utf-8"), headers={"Content-Type": "application/json"})
    res_b = urllib.request.urlopen(req_b)
    data_b = json.loads(res_b.read().decode("utf-8"))
    sites_b = data_b.get("recommended_sites", [])
    
    print(f"=== TEST B: Search Changed to Pune Pharmacy (2000m) ===")
    print(f"Count: {len(sites_b)}")
    assert len(sites_b) == 4, f"Expected 4 sites, got {len(sites_b)}"
    for s in sites_b:
        print(f"#{s['rank']}: {s['landmark']} | Score: {s['score']} | Dist: {s['distance_from_center_m']}m | Comp: {s['competitors_500m']}")
        assert s["distance_from_center_m"] <= 2000, f"Candidate outside radius"
        assert "Mira Road" not in s["landmark"] and "Mumbai" not in s["landmark"], "Old search leaked into new result"
    print(">>> Test B PASSED!\n")

if __name__ == "__main__":
    run_tests()
