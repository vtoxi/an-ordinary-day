"""raw/*.json (Overpass) -> world/c_X_Z.json chunks (+ world/global.json). Units: metres, x east, z south, origin 33.65N 73.06E.
Run: python tools/bake_osm.py"""
import glob, json, math, os, random

LAT0, LON0, CH = 33.65, 73.06, 1000
KX, KZ = 111320 * math.cos(math.radians(LAT0)), 110574
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "world")
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(OUT + "/*.json"): os.remove(f)

def nm(t):
    n = t.get("name:en") or t.get("int_name") or t.get("name") or ""
    return n if n.isascii() else ""   # keep the HUD English; Urdu-only names are dropped
proj = lambda lat, lon: (round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KZ, 1))
ROAD = {"motorway": 0, "motorway_link": 0, "trunk": 1, "trunk_link": 1, "primary": 1, "primary_link": 1, "secondary": 2, "secondary_link": 2,
        "tertiary": 3, "unclassified": 4, "residential": 4, "living_street": 4}
chunks, glob_ = {}, {"labels": [], "areas": [], "overview": []}
seen = set()
ZONES = {"residential", "commercial", "industrial", "retail", "farmland", "military", "construction"}
ck = lambda x, z: (math.floor(x / CH), math.floor(z / CH))
C = lambda x, z: chunks.setdefault(ck(x, z), {"roads": [], "bld": [], "water": [], "green": [], "zone": []})

def area(p):
    return abs(sum(p[i] * p[(i + 3) % len(p)] - p[(i + 2) % len(p)] * p[(i + 1) % len(p)] for i in range(0, len(p), 2))) / 2

WDEF = {0: 11.0, 1: 9.0, 2: 8.0, 3: 7.0, 4: 5.6}
def road_w(t, cls):
    try: return max(3.0, float(str(t["width"]).split()[0]))
    except (KeyError, ValueError): pass
    try: return max(3.0, float(t["lanes"]) * 3.3 + (1.2 if cls <= 2 else 0.4))
    except (KeyError, ValueError): return WDEF[cls]
def speed(t):
    try: return int(str(t["maxspeed"]).split()[0])
    except (KeyError, ValueError): return 0

def elev(t, pts, cls):
    """flyover profile: ramps up over ~12 m of road per metre of rise, so short bridges stay low"""
    if t.get("bridge") in (None, "no") or cls > 4: return None
    try: lay = min(2, max(1, abs(int(t.get("layer", 1)))))
    except ValueError: lay = 1
    d = [0.0]
    for a, b in zip(pts, pts[1:]): d.append(d[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    L = d[-1]
    if L < 25: return None
    H = 6.2 * lay; ramp = H * 12
    if L < 2 * ramp: ramp = L / 2; H = ramp / 12
    sm = lambda u: u * u * (3 - 2 * u)
    return [round(H * sm(min(1, min(x, L - x) / ramp)), 1) for x in d]

def height(t, wid):
    if "height" in t:
        try: return max(3, float(str(t["height"]).split()[0]))
        except ValueError: pass
    if "building:levels" in t:
        try: return max(3, float(t["building:levels"]) * 3.3 + 1)
        except ValueError: pass
    return 6 + random.Random(wid).random() * 7

for f in sorted(glob.glob(HERE + "/raw/t_*.json")):
    for el in json.load(open(f, encoding="utf8"))["elements"]:
        if el["id"] in seen: continue
        seen.add(el["id"]); t = el.get("tags", {})
        if el["type"] == "node":
            x, z = proj(el["lat"], el["lon"]); glob_["labels"].append({"n": nm(t), "x": x, "z": z, "k": t.get("place") or t.get("amenity") or "poi"})
            kind = t.get("amenity") or ("shop" if "shop" in t else t.get("tourism") or "")
            if kind and nm(t) and not t.get("place"): C(x, z).setdefault("poi", []).append({"n": nm(t)[:28], "x": x, "z": z, "k": kind, "b": (t.get("brand") or "")[:20] if (t.get("brand") or "").isascii() else ""})
            continue
        g = el.get("geometry")
        if not g or len(g) < 2: continue
        pts = [proj(q["lat"], q["lon"]) for q in g]
        if "highway" in t:
            cls = ROAD[t["highway"]]
            o = 1 if t.get("oneway") in ("yes", "true", "1") or t.get("highway") in ("motorway", "motorway_link") else 0
            meta = {"c": cls, "o": o, "w": round(road_w(t, cls), 1), "n": nm(t) or (t.get("ref") if (t.get("ref") or "").isascii() else ""), "s": speed(t)}
            ys = elev(t, pts, cls)
            if t.get("bridge") not in (None, "no") and ys: meta["b"] = 1
            if t.get("tunnel") in ("yes", "covered"): meta["t"] = 1
            run, ry = [pts[0]], [ys[0]] if ys else None
            def emit(): C(*run[0])["roads"].append({**meta, "p": [v for q in run for v in q], **({"y": ry} if ry else {})})
            for k, a in enumerate(pts[1:], 1):
                run.append(a)
                if ys: ry.append(ys[k])
                if ck(*a) != ck(*run[0]): emit(); run, ry = [a], [ys[k]] if ys else None
            if len(run) > 1: emit()
            if cls <= 2: glob_["overview"].append({"c": cls, "p": [v for q in pts[::max(1, len(pts) // 40)] for v in q]})
            if nm(t) and cls <= 2 and random.random() < 0.15: glob_["labels"].append({"n": nm(t), "x": pts[len(pts) // 2][0], "z": pts[len(pts) // 2][1], "k": "road"})
            continue
        if len(pts) < 4: continue
        flat = [v for q in pts[:-1] for v in q] if pts[0] == pts[-1] else [v for q in pts for v in q]
        cx = sum(flat[0::2]) / (len(flat) // 2); cz = sum(flat[1::2]) / (len(flat) // 2); A = area(flat)
        if "building" in t:
            C(cx, cz)["bld"].append({"p": flat, "h": round(height(t, el["id"]), 1), "n": t.get("name")})
        else:
            kind = "water" if (t.get("natural") == "water" or "waterway" in t) else "zone" if t.get("landuse") in ZONES else "green"
            if "waterway" in t and "building" not in t:  # lines: widen into a thin polygon is overkill; draw as road class 5
                C(cx, cz)["roads"].append({"c": 5, "o": 0, "p": [v for q in pts for v in q]}); continue
            item = {"p": flat, **({"u": t["landuse"]} if kind == "zone" else {})}
            if A > 400000: glob_["areas"].append({"k": kind, **item})
            else: C(cx, cz)[kind].append(item)


# ---- infill: OSM building coverage in Pakistan is patchy, so line the residential/tertiary roads with plausible low-rise blocks ----
RW = [16, 14, 11, 8, 6, 5]
road_cells, bld_cells = set(), set()
cell = lambda x, z, s: (int(x // s), int(z // s))
def mark_road(P, w):
    for k in range(0, len(P) - 2, 2):
        x0, z0, x1, z1 = P[k:k + 4]; L = math.hypot(x1 - x0, z1 - z0); n = max(1, int(L / 2.5)); r = int(w / 2 / 3) + 1
        for q in range(n + 1):
            cx, cz = cell(x0 + (x1 - x0) * q / n, z0 + (z1 - z0) * q / n, 3)
            for a in range(-r, r + 1):
                for b in range(-r, r + 1): road_cells.add((cx + a, cz + b))
for d in chunks.values():
    for r in d["roads"]: mark_road(r["p"], r.get("w", RW[r["c"]]) + 3)
    for b in d["bld"]:
        for q in range(0, len(b["p"]), 2): bld_cells.add(cell(b["p"][q], b["p"][q + 1], 3))
polys = [(a["p"], min(a["p"][0::2]), max(a["p"][0::2]), min(a["p"][1::2]), max(a["p"][1::2])) for a in glob_["areas"]]
for d in chunks.values():
    for a in d["green"] + d["water"] + d["zone"][:0]: polys.append((a["p"], min(a["p"][0::2]), max(a["p"][0::2]), min(a["p"][1::2]), max(a["p"][1::2])))
def in_poly(x, z, P):
    c = False; n = len(P) // 2
    for a in range(n):
        b = a - 1; zi, zj = P[a * 2 + 1], P[b * 2 + 1]
        if (zi > z) != (zj > z) and x < (P[b * 2] - P[a * 2]) * (z - zi) / (zj - zi) + P[a * 2]: c = not c
    return c
poly_grid = {}
for pl in polys:
    for gx in range(int(pl[1] // 500), int(pl[2] // 500) + 1):
        for gz in range(int(pl[3] // 500), int(pl[4] // 500) + 1): poly_grid.setdefault((gx, gz), []).append(pl)
KEEP = [(33.7295, 73.0372, 230), (33.7081, 73.0510, 110), (33.6931, 73.0689, 70)]
KEEP = [(((lo - LON0) * KX), -(la - LAT0) * KZ, rad) for la, lo, rad in KEEP]
def blocked(x, z):
    if any(math.hypot(x - kx, z - kz) < rad for kx, kz, rad in KEEP): return True
    return any(pl[1] <= x <= pl[2] and pl[3] <= z <= pl[4] and in_poly(x, z, pl[0]) for pl in poly_grid.get((int(x // 500), int(z // 500)), []))
BA = (0, -(33.7101 - LAT0) * KZ)  # Blue Area: tall commercial core
BA = ((73.056 - LON0) * KX, -(33.7101 - LAT0) * KZ)
rng, made = random.Random(7), 0
for d in list(chunks.values()):
    for r in list(d["roads"]):
        if r["c"] not in (2, 3, 4) or len(r["p"]) < 4: continue
        P, w = r["p"], r.get("w", RW[r["c"]])
        pos = rng.uniform(4, 14)
        for k in range(0, len(P) - 2, 2):
            x0, z0, x1, z1 = P[k:k + 4]; L = math.hypot(x1 - x0, z1 - z0)
            if L < 1: continue
            ux, uz = (x1 - x0) / L, (z1 - z0) / L; nx, nz = -uz, ux
            while pos < L:
                for side in (-1, 1):
                    bw, bd = rng.uniform(8, 16), rng.uniform(9, 15); off = w / 2 + rng.uniform(3, 8) + bd / 2
                    cx, cz = x0 + ux * pos + nx * off * side, z0 + uz * pos + nz * off * side
                    corners = [(cx + ux * a * bw / 2 + nx * b * bd / 2, cz + uz * a * bw / 2 + nz * b * bd / 2) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                    if any(cell(x, z, 3) in road_cells or cell(x, z, 3) in bld_cells for x, z in corners + [(cx, cz)]) or blocked(cx, cz): continue
                    dba = math.hypot(cx - BA[0], cz - BA[1])
                    if dba < 1400 and r["c"] <= 3 and rng.random() < 0.5: h = rng.uniform(25, 75) * (1.4 - dba / 1400)
                    elif cz < -1100: h = rng.choice([7, 7, 8, 10, 10, 13, 19])        # Islamabad sectors: low rise
                    else: h = rng.choice([8, 10, 10, 13, 13, 16, 19])                 # Rawalpindi: denser
                    flat = [round(v, 1) for c in corners for v in c]
                    tgt = chunks.setdefault(ck(cx, cz), {"roads": [], "bld": [], "water": [], "green": [], "zone": []})
                    tgt["bld"].append({"p": flat, "h": round(h, 1), "n": None}); made += 1
                    for c in corners + [(cx, cz)]: bld_cells.add(cell(c[0], c[1], 3))
                pos += rng.uniform(11, 20)
            pos -= L
print("infill buildings:", made)

glob_["labels"] = [l for l in glob_["labels"] if l["n"]]
for (i, j), d in chunks.items():
    json.dump(d, open(f"{OUT}/c_{i}_{j}.json", "w"), separators=(",", ":"))
json.dump({"chunks": [list(k) for k in chunks], **glob_}, open(f"{OUT}/global.json", "w"), separators=(",", ":"))
print(len(chunks), "chunks;", sum(len(c["bld"]) for c in chunks.values()), "buildings;", sum(len(c["roads"]) for c in chunks.values()), "road runs")
