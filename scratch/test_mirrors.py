import httpx

query = """[out:json][timeout:15];
(
  node["amenity"="hospital"](around:2000,19.2856,72.8691);
  node["highway"="bus_stop"](around:2000,19.2856,72.8691);
);
out center;"""

mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

for m in mirrors:
    try:
        r = httpx.post(m, data={"data": query}, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) UrbanIQ/1.0"}, timeout=10.0)
        print(m, r.status_code, len(r.json().get("elements", [])) if r.status_code == 200 else r.text[:80])
    except Exception as e:
        print(m, "ERROR:", e)
