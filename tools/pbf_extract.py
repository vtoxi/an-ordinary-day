"""Cut Rawalpindi + Islamabad out of a Geofabrik Pakistan extract (offline alternative to the Overpass tiles).
Download: https://download.geofabrik.de/asia/pakistan-latest.osm.pbf
Run: pip install osmium; python tools/pbf_extract.py path/to/pakistan-latest.osm.pbf; then python tools/bake_osm.py
Writes tools/raw/t_pbf.json in the same shape Overpass returns, so bake_osm.py needs no changes."""
import json, os, sys
import osmium

S, W, N, E = 33.50, 72.86, 33.80, 73.26
HW = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "motorway_link", "trunk_link", "primary_link", "secondary_link", "living_street"}
inside = lambda lat, lon: S <= lat <= N and W <= lon <= E

def keep_way(t):
    return (t.get("highway") in HW or "building" in t or t.get("natural") in ("water", "wood") or t.get("waterway") in ("river", "stream", "canal")
            or t.get("leisure") in ("park", "pitch", "golf_course") or t.get("landuse") in ("forest", "grass", "cemetery", "recreation_ground", "residential", "commercial", "industrial", "retail", "farmland", "military", "construction"))

def keep_node(t):
    return "name" in t and (t.get("amenity") in ("hospital", "university", "place_of_worship", "restaurant", "cafe") or "tourism" in t or t.get("place") in ("suburb", "neighbourhood", "town", "city"))

out = []
fp = osmium.FileProcessor(sys.argv[1]).with_locations().with_filter(osmium.filter.KeyFilter("highway", "building", "natural", "leisure", "landuse", "waterway", "amenity", "tourism", "place"))
for o in fp:
    t = {k: v for k, v in o.tags}
    if o.is_node():
        if o.location.valid() and inside(o.location.lat, o.location.lon) and keep_node(t):
            out.append({"type": "node", "id": o.id, "lat": o.location.lat, "lon": o.location.lon, "tags": t})
    elif o.is_way() and keep_way(t):
        try:
            g = [{"lat": n.lat, "lon": n.lon} for n in o.nodes]
        except osmium.InvalidLocationError:
            continue
        if g and any(inside(q["lat"], q["lon"]) for q in g[:: max(1, len(g) // 4)]):
            out.append({"type": "way", "id": o.id, "tags": t, "geometry": g})
os.makedirs(os.path.join(os.path.dirname(__file__), "raw"), exist_ok=True)
json.dump({"elements": out}, open(os.path.join(os.path.dirname(__file__), "raw", "t_pbf.json"), "w"), separators=(",", ":"))
print(len(out), "elements")
