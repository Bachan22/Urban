import urllib.request
import json

url = 'http://127.0.0.1:8000/api/recommend-sites'
for btype in ['Cafe', 'Gym', 'Education Institute']:
    req = urllib.request.Request(
        url,
        data=json.dumps({
            'business_type': btype,
            'latitude': 19.2812,
            'longitude': 72.8561,
            'radius_meters': 2000,
            'city_name': 'Mumbai'
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    res = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    sites = res.get('recommended_sites', [])
    print(f'=== {btype} in Mira Road (2000m) ===')
    for s in sites:
        print(f"#{s['rank']}: {s['landmark']} | Score: {s['score']} | Comp500: {s['competitors_500m']} | Dist: {s['distance_from_center_m']}m | Transit: {s['nearest_transit_dist_m']}m")
        print(f"  Why: {s['why_here'][:2]}")
