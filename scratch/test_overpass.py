import httpx

query = """[out:json][timeout:25];
(
  node["amenity"="hospital"](around:2000,19.2856,72.8691);
  node["amenity"="school"](around:2000,19.2856,72.8691);
  node["amenity"="college"](around:2000,19.2856,72.8691);
  node["highway"="bus_stop"](around:2000,19.2856,72.8691);
  node["railway"="station"](around:2000,19.2856,72.8691);
);
out center;"""

for mirror in [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]:
    try:
        print(f"Trying {mirror}...")
        resp = httpx.post(mirror, data={"data": query}, timeout=8.0)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            elements = data.get("elements", [])
            print(f"Success! {len(elements)} POIs found.")
            for el in elements[:5]:
                tags = el.get("tags", {})
                print(" -", tags.get("name"), tags.get("amenity") or tags.get("highway") or tags.get("railway"))
            break
    except Exception as e:
        print("Failed:", e)
