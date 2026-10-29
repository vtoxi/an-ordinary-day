"""Download Rawalpindi + Islamabad OSM data tile by tile (raw/*.json), politely, resumable.
Dense tiles that time out are split into 2x2 sub-tiles automatically.
Run: python tools/fetch_osm.py [rev]   then   python tools/bake_osm.py"""
import json, os, sys, time, urllib.request, urllib.parse

S, W, N, E = 33.50, 72.86, 33.80, 73.26
NY, NX = 8, 8
URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
OUT = os.path.join(os.path.dirname(__file__), "raw")
os.makedirs(OUT, exist_ok=True)

Q = """[out:json][timeout:90];(
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|living_street)$"]({b});
way["building"]({b});
way["natural"="water"]({b}); way["waterway"~"river|stream|canal"]({b});
way["leisure"~"park|pitch|golf_course"]({b}); way["landuse"~"forest|grass|cemetery|recreation_ground"]({b});
way["natural"="wood"]({b});
node["name"]["amenity"~"hospital|university|place_of_worship|restaurant|cafe"]({b});
node["name"]["tourism"]({b}); node["name"]["place"~"suburb|neighbourhood|town|city"]({b});
);out geom tags;"""

def get(box, tries=3):
    data = urllib.parse.urlencode({"data": Q.format(b=box)}).encode()
    for att in range(tries):
        try:
            req = urllib.request.Request(URLS[att % 2], data, {"User-Agent": "an-ordinary-day/1.0 (game prototype)"})
            return urllib.request.urlopen(req, timeout=110).read()
        except Exception as e:
            print("  retry", att, str(e)[:60], flush=True); time.sleep(8 * (att + 1))
    return None

def fetch(name, s, w, n, e, depth=0):
    f = f"{OUT}/{name}.json"
    if os.path.exists(f) or os.path.exists(f"{OUT}/{name}_a.json"): return
    d = get(f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}")
    if d is not None:
        open(f, "wb").write(d); print("tile", name, len(d) // 1024, "KB", flush=True); time.sleep(3); return
    if depth >= 2: print("FAILED", name, flush=True); return
    print("splitting", name, flush=True)
    ms, mw = (s + n) / 2, (w + e) / 2
    for sub, (a, b, c, dd) in zip("abcd", [(s, w, ms, mw), (s, mw, ms, e), (ms, w, n, mw), (ms, mw, n, e)]):
        fetch(f"{name}_{sub}", a, b, c, dd, depth + 1)

order = [(i, j) for i in range(NY) for j in range(NX)]
if 'rev' in sys.argv: order.reverse()
for i, j in order:
    fetch(f"t_{i}_{j}", S + (N - S) * i / NY, W + (E - W) * j / NX, S + (N - S) * (i + 1) / NY, W + (E - W) * (j + 1) / NX)
print("DONE")
