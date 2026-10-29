/**
 * Rawalpindi + Islamabad on foot and by car, from baked OpenStreetMap chunks (tools/fetch_osm.py -> tools/bake_osm.py -> world/).
 * Units: metres, x east, z south, y up, origin 33.65N 73.06E. Drive on the LEFT. Debug hook: window.__city.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHAPTERS, TOTAL } from './story.js';

const $ = id => document.getElementById(id);
const WV = 1;   // bump when world/ is re-baked (the CDN caches static files)
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const LAT0 = 33.65, LON0 = 73.06, CH = 1000, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const ll = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const BOUNDS = { x0: ll(0, 72.86)[0], x1: ll(0, 73.26)[0], z0: ll(33.80, 0)[1], z1: ll(33.50, 0)[1] };
const hash = n => { n = Math.sin(n * 127.1) * 43758.5453; return n - Math.floor(n); };

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let qLevel = 2; try { const v = localStorage.getItem('q'); if (v !== null) qLevel = clamp(+v, 0, 2); } catch (e) {}
const PR_CAP = [0.8, 1.1, 1.5];
let pr = Math.min(devicePixelRatio, PR_CAP[qLevel]);
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb0c8e0, 0.00032);
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.4, 40000);
cam.rotation.order = 'YXZ';
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: 2 }));
composer.addPass(new RenderPass(scene, cam));
const gtao = new GTAOPass(scene, cam, innerWidth, innerHeight); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.9; gtao.enabled = false;
gtao.updateGtaoMaterial({ radius: 2.5, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 }); composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.4, 0.88);
composer.addPass(bloom); composer.addPass(new OutputPass());
addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ---------- sky + light ----------
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6b6a58, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.4;
Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 1500 });
const moon = new THREE.DirectionalLight(0x9db4ff, 0); scene.add(moon, moon.target);
const sky = new Sky(); sky.scale.setScalar(30000); scene.add(sky);
const su = sky.material.uniforms; su.turbidity.value = 7; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.7;
const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
envSky.material.uniforms.turbidity.value = 7;
let envRT = null, envHour = -9;
const starGeo = new THREE.BufferGeometry(), sp = [];
for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) + 0.02; sp.push(...v.normalize().multiplyScalar(20000).toArray()); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
scene.add(stars);

// ---------- ground, Margalla hills ----------
function grassTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#7d7a55'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const g = 90 + Math.random() * 60; x.fillStyle = `rgba(${g * 0.9},${g},${g * 0.55},.35)`; x.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 2 + Math.random() * 6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(500, 500); return t;
}
const TILE = 40, GSIZE = 6000;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GSIZE, GSIZE), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
{ // Margalla ridge north of the city (z negative); cosmetic backdrop, not walkable
  const W = 52000, D = 9000, g = new THREE.PlaneGeometry(W, D, 220, 60), pos = g.attributes.position, col = [], sn = new SimplexNoise();
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getY(i) + D / 2) / D, x = pos.getX(i);                      // u: 0 = city side, 1 = far
    const ridge = Math.pow(clamp((u - 0.05) * 1.5, 0, 1), 1.3) * (700 + 400 * sn.noise(x / 6000, 0)) + 260 * sn.noise(x / 1400, u * 3) * u + 90 * sn.noise(x / 300, u * 9) * u;
    pos.setZ(i, Math.max(0, ridge));
    const k = clamp(ridge / 900, 0, 1); col.push(0.22 + 0.2 * k, 0.3 + 0.12 * k, 0.17 + 0.08 * k);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const hills = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  hills.rotation.x = -Math.PI / 2; hills.position.set(0, -2, BOUNDS.z0 - 300 - D / 2); scene.add(hills);
}

// ---------- facade material (world-space window grid, no UV stretching) ----------
function facade(lit) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = lit ? '#000' : '#a89c88'; x.fillRect(0, 0, 256, 1024);
  for (let r = 0; r < 32; r++) {
    let run = 0, on = false;
    for (let q = 0; q < 8; q++) {
      if (run-- <= 0) { on = Math.random() < 0.28; run = (Math.random() * 3) | 0; }
      const s = 45 + Math.random() * 25 | 0;
      x.fillStyle = lit ? (on ? ['#ffd9a0', '#ffe8c0', '#fff4e0', '#c8e4ff'][(Math.random() * 4) | 0] : '#000') : `rgb(${s},${s + 8},${s + 16})`;
      x.fillRect(q * 32 + 5, r * 32 + 6, 22, 18);
      if (!lit) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(q * 32 + 5, r * 32 + 6, 22, 3); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(q * 32 + 5, r * 32 + 24, 22, 2); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const bldMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: facade(false), emissiveMap: facade(true), emissive: 0xffffff, roughness: 0.7, metalness: 0.05 });
bldMat.onBeforeCompile = sh => {
  const V = '#include <common>\nvarying vec3 vWP; varying vec3 vWN;';
  sh.vertexShader = sh.vertexShader.replace('#include <common>', V)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', V)
    .replace('#include <map_fragment>', `vec2 fUV = (abs(vWN.x) > 0.5 ? vWP.zy : vWP.xy) / vec2(26.0, 105.0);
      float roof = step(0.5, vWN.y);
      vec4 fTex = texture2D(map, fUV);
      diffuseColor.rgb *= mix(fTex.rgb, vec3(0.62), roof);`)
    .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= texture2D(emissiveMap, fUV).rgb * (1.0 - roof);');
};
const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const detail = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const g = 100 + Math.random() * 60 | 0; x.fillStyle = `rgba(${g},${g},${g},.6)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(40,40,40,.35)'; x.lineWidth = 1; x.beginPath(); let px = Math.random() * 256, py = Math.random() * 256; x.moveTo(px, py); for (let k = 0; k < 6; k++) x.lineTo(px += Math.random() * 30 - 15, py += Math.random() * 30 - 15); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; })();
function worldDetail(mat, scale) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.dMap = { value: detail };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform sampler2D dMap;').replace('#include <map_fragment>', `#include <map_fragment>\ndiffuseColor.rgb *= 0.55 + 0.9 * texture2D(dMap, vWP.xz / ${scale.toFixed(1)}).rgb;`);
  };
}
const greenMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
worldDetail(roadMat, 9);
for (const m of [roadMat, greenMat]) { m.roughness = 1; m.envMapIntensity = 0.15; }
const zoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -0.5, polygonOffsetUnits: -0.5 });
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a5878, roughness: 0.08, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 });

// ---------- geometry builders ----------
const ROAD_W = [16, 14, 11, 8, 6, 5], ROAD_C = [[.09, .09, .1], [.1, .1, .11], [.11, .11, .12], [.13, .13, .14], [.16, .155, .15], [.1, .22, .34]];
function ribbon(P, w, y, col, out) {
  const n = P.length / 2; if (n < 2) return;
  const nx = [], nz = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const dx = P[b * 2] - P[a * 2], dz = P[b * 2 + 1] - P[a * 2 + 1], l = Math.hypot(dx, dz) || 1; nx.push(-dz / l); nz.push(dx / l);
  }
  const base = out.pos.length / 3;
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) { out.pos.push(P[i * 2] + nx[i] * w / 2 * s, y, P[i * 2 + 1] + nz[i] * w / 2 * s); out.col.push(...col); }
  for (let i = 0; i < n - 1; i++) { const a = base + i * 2; out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
/** triangulate a flat (x,z) polygon at height y, faces up */
const ZONE_C = { residential: [.5, .46, .36], commercial: [.52, .42, .4], industrial: [.38, .38, .4], retail: [.55, .43, .4], farmland: [.5, .55, .3], military: [.34, .4, .3], construction: [.5, .42, .3] };
function fillPoly(flat, y, out, col) {
  const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  const faces = THREE.ShapeUtils.triangulateShape(pts, []), base = out.pos.length / 3;
  for (const p of pts) { out.pos.push(p.x, y, p.y); if (col) out.col.push(...col); }
  for (const [a, b, c] of faces) { const cr = (pts[b].y - pts[a].y) * (pts[c].x - pts[a].x) - (pts[b].x - pts[a].x) * (pts[c].y - pts[a].y); out.idx.push(...(cr >= 0 ? [base + a, base + b, base + c] : [base + a, base + c, base + b])); }
}
function buildingGeo(list, out) {
  for (const b of list) {
    const flat = b.p, n = flat.length / 2; if (n < 3) continue;
    const h = b.h, k = hash(flat[0] * 0.013 + flat[1]), tint = 0.62 + 0.3 * k, col = [tint, tint * (0.92 + 0.1 * hash(k * 9)), tint * (0.85 + 0.12 * hash(k * 31))];
    let A = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; A += flat[i * 2] * flat[j * 2 + 1] - flat[j * 2] * flat[i * 2 + 1]; }
    const sgn = A > 0 ? 1 : -1, base = out.pos.length / 3;
    for (let i = 0; i < n; i++) { out.pos.push(flat[i * 2], h, flat[i * 2 + 1]); out.col.push(...col); }
    const pts = []; for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(flat[i * 2], flat[i * 2 + 1]));
    for (const [a, b2, c] of THREE.ShapeUtils.triangulateShape(pts, [])) {
      const cr = (pts[b2].y - pts[a].y) * (pts[c].x - pts[a].x) - (pts[b2].x - pts[a].x) * (pts[c].y - pts[a].y);
      out.idx.push(...(cr >= 0 ? [base + a, base + b2, base + c] : [base + a, base + c, base + b2]));
    }
    for (let i = 0; i < n; i++) {                       // walls: own verts so normals stay flat
      const j = (i + 1) % n, x0 = flat[i * 2], z0 = flat[i * 2 + 1], x1 = flat[j * 2], z1 = flat[j * 2 + 1], v = out.pos.length / 3;
      out.pos.push(x0, 0, z0, x1, 0, z1, x1, h, z1, x0, h, z0); for (let q = 0; q < 4; q++) out.col.push(...col);
      const dx = x1 - x0, dz = z1 - z0, nx = dz * sgn, nz = -dx * sgn;      // outward normal; (v,v+1,v+2) has normal (-dz,0,dx)
      if (-dz * nx + dx * nz >= 0) out.idx.push(v, v + 1, v + 2, v, v + 2, v + 3); else out.idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
    }
  }
}
const mkMesh = (o, mat, shadow = false) => {
  if (!o.idx.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  if (o.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  g.setIndex(o.idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; return m;
};
const blank = () => ({ pos: [], col: [], idx: [] });

// ---------- world streaming ----------
let GL = { chunks: [], labels: [], areas: [], overview: [] };
const have = new Set(), loaded = new Map(), loading = new Set(), runs = [];
const ck = (x, z) => [Math.floor(x / CH), Math.floor(z / CH)], kk = (i, j) => i + ',' + j;
async function loadChunk(i, j) {
  const key = kk(i, j); loading.add(key);
  try {
    const d = await (await fetch(`world/c_${i}_${j}.json?v=${WV}`)).json();
    const g = new THREE.Group(), rd = blank(), gr = blank(), wt = blank(), bl = blank(), zn = blank(), mine = [];
    for (const r of d.roads) {
      if (r.c === 5) { ribbon(r.p, 6, 0.1, ROAD_C[5], rd); continue; }
      const w = r.w || ROAD_W[r.c];
      if (r.c >= 1) ribbon(r.p, w + 3.6, 0.07, [.3, .29, .27], rd);                           // pavement
      ribbon(r.p, w, 0.14 - r.c * 0.012, ROAD_C[r.c], rd);
      if (!r.o && w >= 6) ribbon(r.p, 0.16, 0.16, [.78, .75, .55], rd);                       // centre line on two-way roads
      else if (r.o && w >= 7.5) { ribbon(r.p, 0.12, 0.16, [.55, .55, .55], rd); }             // lane divider on wide one-way carriageways
      if (r.c <= 4) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let q = 0; q < r.p.length; q += 2) { x0 = Math.min(x0, r.p[q]); x1 = Math.max(x1, r.p[q]); z0 = Math.min(z0, r.p[q + 1]); z1 = Math.max(z1, r.p[q + 1]); } mine.push({ c: r.c, p: r.p, w, o: r.o, n: r.n, s: r.s, x0: x0 - 25, x1: x1 + 25, z0: z0 - 25, z1: z1 + 25 }); }
    }
    for (const a of d.zone || []) fillPoly(a.p, 0.03, zn, ZONE_C[a.u]);
    for (const a of d.green) fillPoly(a.p, 0.05, gr);
    for (const a of d.water) fillPoly(a.p, 0.07, wt);
    buildingGeo(d.bld, bl);
    decorChunk(d.roads, g);
    for (const [o, mat, sh] of [[zn, zoneMat], [rd, roadMat], [gr, greenMat], [wt, waterMat], [bl, bldMat, true]]) { const m = mkMesh(o, mat, sh); if (m) g.add(m); }
    const col = d.bld.map(b => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let q = 0; q < b.p.length; q += 2) { x0 = Math.min(x0, b.p[q]); x1 = Math.max(x1, b.p[q]); z0 = Math.min(z0, b.p[q + 1]); z1 = Math.max(z1, b.p[q + 1]); } return { p: b.p, x0, x1, z0, z1 }; });
    for (const e of EXTRA) { const [ei, ej] = ck(e.cx, e.cz); if (ei === i && ej === j) col.push(e); }
    scene.add(g); loaded.set(key, { g, col, i, j });
    for (const r of mine) runs.push({ ...r, key });
  } catch (e) { console.warn('chunk', key, e); } finally { loading.delete(key); }
}
function streamChunks() {
  const [ci, cj] = ck(P.pos.x, P.pos.z), R = P.car ? 3 : 2;
  for (const [key, c] of loaded) if (Math.abs(c.i - ci) > R + 1 || Math.abs(c.j - cj) > R + 1) {
    scene.remove(c.g); c.g.traverse(o => { if (!o.isInstancedMesh) o.geometry?.dispose(); }); loaded.delete(key);
    for (let k = runs.length - 1; k >= 0; k--) if (runs[k].key === key) runs.splice(k, 1);
  }
  if (loading.size >= 2) return;
  const want = [];
  for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) { const k = kk(i, j); if (have.has(k) && !loaded.has(k) && !loading.has(k)) want.push([i, j, Math.hypot(i - ci, j - cj)]); }
  want.sort((a, b) => a[2] - b[2]); if (want[0]) loadChunk(want[0][0], want[0][1]);
}

// ---------- collision ----------
/** push circle (pos.x,pos.z,r) out of any building; returns how far it had to move */
function resolve(pos, r) {
  let hit = 0;
  const [i0, j0] = ck(pos.x - r, pos.z - r), [i1, j1] = ck(pos.x + r, pos.z + r);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const c = loaded.get(kk(i, j)); if (!c) continue;
    for (const b of c.col) {
      if (pos.x < b.x0 - r || pos.x > b.x1 + r || pos.z < b.z0 - r || pos.z > b.z1 + r) continue;
      const p = b.p, n = p.length / 2; let best = 1e9, bx = 0, bz = 0, inside = false;
      for (let a = 0, q = n - 1; a < n; q = a++) {
        const ax = p[q * 2], az = p[q * 2 + 1], ex = p[a * 2] - ax, ez = p[a * 2 + 1] - az;
        if ((p[a * 2 + 1] > pos.z) !== (az > pos.z) && pos.x < ax + (pos.z - az) / ez * ex) inside = !inside;
        const t = clamp(((pos.x - ax) * ex + (pos.z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1), qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(pos.x - qx, pos.z - qz);
        if (d < best) { best = d; bx = qx; bz = qz; }
      }
      if (!inside && best >= r) continue;
      const dx = pos.x - bx, dz = pos.z - bz, l = Math.hypot(dx, dz) || 1, push = inside ? best + r : r - best, s = inside ? -1 : 1;
      pos.x += dx / l * push * s; pos.z += dz / l * push * s; hit += push;
    }
  }
  return hit;
}

// ---------- player + car ----------
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, ground: true, car: null, chase: false, lookYaw: 0 };
/** extrude a side profile (x = along the car, rear positive; y = height) across `width`, centred on x=0 */
function sideProfile(pts, width) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); return g;
}
const SEDAN = [[-2.25, 0.4], [-2.25, 0.76], [-1.55, 0.92], [-0.6, 1.02], [0.22, 1.43], [0.98, 1.43], [1.55, 1.02], [2.25, 0.98], [2.25, 0.4]];
const SEDAN_GLASS = [[-0.5, 1.03], [0.2, 1.38], [0.98, 1.38], [1.45, 1.03]];
function wheelGeo(r, wd) { const t = new THREE.CylinderGeometry(r, r, wd, 18).rotateZ(Math.PI / 2), m = new THREE.CylinderGeometry(r * 0.62, r * 0.62, wd + 0.02, 12).rotateZ(Math.PI / 2); return [t, m]; }
function makeCar(color) {
  const g = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.65 }), glass = new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 0.05, metalness: 0.9 }), blk = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.85 }), rim = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.9 });
  const body = new THREE.Group(); g.add(body);
  const put = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  put(sideProfile(SEDAN, 1.76), paint, 0, 0, 0); put(sideProfile(SEDAN_GLASS, 1.78), glass, 0, 0, 0);
  for (const [x, z] of [[-0.86, 1.4], [0.86, 1.4], [-0.86, -1.45], [0.86, -1.45]]) { const [t, m] = wheelGeo(0.32, 0.22); put(t, blk, x, 0.32, z); put(m, rim, x + Math.sign(x) * 0.02, 0.32, z); }
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2d0 }), tl = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  for (const sx of [-1, 1]) { put(new THREE.BoxGeometry(0.42, 0.14, 0.06), hl, sx * 0.62, 0.74, -2.27); put(new THREE.BoxGeometry(0.42, 0.12, 0.06), tl, sx * 0.62, 0.8, 2.27); }
  put(new THREE.BoxGeometry(1.5, 0.08, 0.1), blk, 0, 0.5, -2.27);                       // bumper strip
  // cockpit view: the body hides, a minimal right-hand-drive interior shows (driver and wheel on the right)
  const cockpit = new THREE.Group(); g.add(cockpit); cockpit.visible = false;
  put(new THREE.BoxGeometry(1.5, 0.2, 0.42), blk, 0, 0.86, -0.62, cockpit);              // dashboard
  put(new THREE.BoxGeometry(1.5, 0.04, 1.5), paint, 0, 0.99, -1.55, cockpit);            // bonnet seen through the screen
  const sw = put(new THREE.TorusGeometry(0.17, 0.022, 6, 18), blk, 0.4, 0.98, -0.34, cockpit); sw.rotation.x = -0.9;
  for (const sx of [-1, 1]) { const pil = put(new THREE.BoxGeometry(0.06, 0.62, 0.08), blk, sx * 0.8, 1.2, -0.42, cockpit); pil.rotation.x = -0.45; put(new THREE.BoxGeometry(0.06, 0.06, 1.3), blk, sx * 0.8, 1.42, 0.22, cockpit); }
  put(new THREE.BoxGeometry(1.6, 0.04, 1.3), blk, 0, 1.45, 0.2, cockpit);                 // roof lining
  put(new THREE.BoxGeometry(0.45, 0.5, 0.2), blk, 0.4, 0.62, 0.35, cockpit); put(new THREE.BoxGeometry(0.45, 0.5, 0.2), blk, -0.4, 0.62, 0.35, cockpit);
  const lights = [-1, 1].map(sx => { const l = new THREE.SpotLight(0xfff2d0, 0, 90, 0.5, 0.5, 1.5); l.position.set(sx * 0.6, 0.8, -2); l.target.position.set(sx * 0.6, 0.2, -30); g.add(l, l.target); return l; });
  scene.add(g); return { g, body, cockpit, lights, yaw: 0, speed: 0, steer: 0 };
}
const myCar = makeCar(0xf0f0f0);
const keys = new Set();

function stepFoot(dt) {
  const k = c => keys.has(c) ? 1 : 0, f = k('KeyW') - k('KeyS'), s = k('KeyD') - k('KeyA');
  const sp = keys.has('ShiftLeft') ? 8 : 4.2;
  const wx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * s, wz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * s, wl = Math.hypot(wx, wz) || 1, a = Math.min(1, (P.ground ? 10 : 1.5) * dt);
  P.vel.x = lerp(P.vel.x, wx / wl * sp * (f || s ? 1 : 0), a); P.vel.z = lerp(P.vel.z, wz / wl * sp * (f || s ? 1 : 0), a);
  if (keys.has('Space') && P.ground) { P.vel.y = 4.2; P.ground = false; }
  P.vel.y -= 9.8 * dt; P.pos.addScaledVector(P.vel, dt);
  if (P.pos.y <= 0) { P.pos.y = 0; P.vel.y = 0; P.ground = true; }
  resolve(P.pos, 0.45);
  const bob = P.ground ? Math.sin(performance.now() / 170) * Math.hypot(P.vel.x, P.vel.z) * 0.012 : 0;
  cam.position.set(P.pos.x, P.pos.y + 1.7 + bob, P.pos.z); cam.rotation.set(P.pitch, P.yaw, 0);
}
const fwd = (y, o = new THREE.Vector3()) => o.set(-Math.sin(y), 0, -Math.cos(y));
const _f = new THREE.Vector3(), _p = new THREE.Vector3(), _b = new THREE.Vector3();
function stepCar(dt) {
  const c = myCar, k = n => keys.has(n) ? 1 : 0, thr = k('KeyW') - k('KeyS');
  const accel = thr > 0 ? (c.speed < 0 ? 12 : 6.5) : thr < 0 ? (c.speed > 0.5 ? -13 : -4) : 0;
  c.speed += (accel - Math.sign(c.speed) * (0.35 + 0.0012 * c.speed * c.speed) - c.speed * 0.02) * dt;
  if (keys.has('Space')) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 16 * dt);
  c.speed = clamp(c.speed, -8, 42); if (!thr && Math.abs(c.speed) < 0.3) c.speed = 0;
  c.steer = lerp(c.steer, k('KeyA') - k('KeyD'), Math.min(1, 5 * dt));
  c.yaw += c.speed / 2.7 * Math.tan(c.steer * 0.5 / (1 + Math.abs(c.speed) / 14)) * dt;
  c.g.position.addScaledVector(fwd(c.yaw, _f), c.speed * dt); c.g.position.y = 0;
  let hit = 0;
  for (const o of [-1.5, 0, 1.5]) { _p.copy(c.g.position).addScaledVector(fwd(c.yaw, _f), o); _b.copy(_p); hit += resolve(_p, 1.0); c.g.position.add(_p.sub(_b)); }
  if (hit > 0.02) { if (Math.abs(c.speed) > 6) bump(); c.speed *= 0.5; }
  for (const a of agents) if (a.on) { const dx = a.x - c.g.position.x, dz = a.z - c.g.position.z; if (dx * dx + dz * dz < (1.4 + a.r) ** 2) { c.speed *= -0.2; c.g.position.x -= dx * 0.1; c.g.position.z -= dz * 0.1; bump(); } }
  c.g.rotation.set(0, c.yaw, 0); c.g.rotateZ(-c.steer * 0.02 * clamp(c.speed / 20, 0, 1));
  P.pos.copy(c.g.position);
  P.lookYaw *= 1 - Math.min(1, 1.5 * dt);
  if (P.chase) { cam.position.copy(c.g.position).addScaledVector(fwd(c.yaw, _f), -9).y += 3.6; cam.lookAt(c.g.position.x, 1.4, c.g.position.z); }
  else { _p.set(Math.cos(c.yaw), 0, -Math.sin(c.yaw)); cam.position.copy(c.g.position).addScaledVector(_p, 0.4).addScaledVector(fwd(c.yaw, _f), 0.1).y += 1.25; cam.rotation.set(P.pitch, c.yaw + P.lookYaw, 0); }
  c.body.visible = P.chase; c.cockpit.visible = !P.chase;
  cam.fov = 70 + clamp(c.speed / 42, 0, 1) * 10; cam.updateProjectionMatrix();
}
let bumpT = 0; function bump() { if (performance.now() - bumpT > 600) { bumpT = performance.now(); toast('Careful!', 'Collision'); if (AU.ctx) thud(0.5, 300, 0.25); } }
function toggleCar() {
  const c = myCar;
  if (P.car) { P.pos.copy(c.g.position).add(_p.set(-Math.cos(c.yaw), 0, Math.sin(c.yaw)).multiplyScalar(2.4)); P.yaw = c.yaw; P.pitch = 0; c.speed = 0; P.car = null; cam.fov = 70; cam.updateProjectionMatrix(); c.body.visible = true; c.cockpit.visible = false; return; }
  if (c.g.position.distanceTo(P.pos) < 5) { P.car = c; P.pitch = 0; P.lookYaw = 0; }
}

// ---------- ambient traffic: Pakistani mix (hatchbacks, sedans, Bolan vans, Hilux, bikes, rickshaws, Hino trucks, donkey carts), left-hand traffic ----------
const vcol = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const WHITE = [1, 1, 1], GLASS = [0.1, 0.13, 0.17], DARK = [0.07, 0.07, 0.07], WOOD = [0.45, 0.3, 0.15];
const bx = (w, h, d, x, y, z, c = WHITE) => vcol(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
const wl = (r, wd, x, y, z) => vcol(new THREE.CylinderGeometry(r, r, wd, 12).rotateZ(Math.PI / 2).translate(x, y, z), DARK);
const prof = (pts, w, c = WHITE) => vcol(sideProfile(pts, w), c);
const HATCH = [[-1.75, 0.4], [-1.75, 0.75], [-1.1, 0.9], [-0.4, 1.0], [0.1, 1.46], [1.2, 1.46], [1.75, 1.05], [1.75, 0.4]], HATCH_G = [[-0.3, 1.02], [0.12, 1.4], [1.15, 1.4], [1.62, 1.07]];
const PICK = [[-2.6, 0.5], [-2.6, 0.95], [-1.4, 1.05], [-0.9, 1.1], [-0.3, 1.75], [0.5, 1.75], [0.7, 1.2], [2.6, 1.2], [2.6, 0.5]], PICK_G = [[-0.8, 1.14], [-0.3, 1.68], [0.45, 1.68], [0.62, 1.14]];
const ball = (r, x, y, z, c) => vcol(new THREE.SphereGeometry(r, 8, 6).translate(x, y, z), c);
const four = (r, wd, hx, hz) => [[-hx, hz], [hx, hz], [-hx, -hz], [hx, -hz]].map(([x, z]) => wl(r, wd, x, r, z));
const merge = parts => mergeGeometries(parts.map(g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));
const LEG = [0.25, 0.25, 0.3], SKIN = [0.55, 0.38, 0.28], HIDE = [0.5, 0.45, 0.4], HIDE2 = [0.4, 0.36, 0.32];
const VT = [
  { n: 18, v: [7, 14], r: 1.2, minc: 1, maxc: 4, off: 2.4, tints: [0xf2f2f2, 0xf2f2f2, 0xcfd2d6, 0x9a1c1c, 0x1d2a4a, 0x7a8087],   // Suzuki Alto / Mehran style hatchback
    geo: merge([prof(HATCH, 1.5), prof(HATCH_G, 1.52, GLASS), ...four(0.27, 0.2, 0.7, 1.1)]) },
  { n: 16, v: [8, 16], r: 1.3, minc: 0, maxc: 4, off: 2.4, tints: [0xf4f4f4, 0xf4f4f4, 0xe8e8e8, 0x202226, 0x8a8e94, 0xb7b1a2],       // Corolla / Civic / City style sedan
    geo: merge([prof(SEDAN, 1.76), prof(SEDAN_GLASS, 1.78, GLASS), ...four(0.31, 0.22, 0.85, 1.4)]) },
  { n: 6, v: [6, 11], r: 1.3, minc: 1, maxc: 4, off: 2.4, tints: [0xf2f2f2, 0xdcdcdc, 0x6f7a86],                                         // Suzuki Bolan van
    geo: merge([bx(1.5, 1.15, 3.7, 0, 0.98, 0), bx(1.46, 0.42, 0.06, 0, 1.3, -1.86, GLASS), bx(1.48, 0.3, 2.4, 0, 1.3, 0.5, GLASS), ...four(0.28, 0.2, 0.7, 1.15)]) },
  { n: 6, v: [8, 15], r: 1.4, minc: 0, maxc: 4, off: 2.4, tints: [0xf0f0f0, 0x23262b, 0xb9b9b4, 0x5b4a3a],                                 // Hilux style pickup
    geo: merge([prof(PICK, 1.85), prof(PICK_G, 1.87, GLASS), ...four(0.36, 0.26, 0.9, 1.6)]) },
  { n: 22, v: [8, 15], r: 0.7, minc: 1, maxc: 4, off: 3.2, tints: [0xc01818, 0x1a1a1a, 0x1b3a8a, 0xdadada, 0x1d6a2a],                      // Honda CD70 style bike with rider
    geo: merge([wl(0.28, 0.08, 0, 0.28, -0.6), wl(0.28, 0.08, 0, 0.28, 0.6), bx(0.22, 0.32, 1.1, 0, 0.55, 0), bx(0.28, 0.08, 0.6, 0, 0.78, 0.25, DARK), bx(0.6, 0.04, 0.04, 0, 0.98, -0.5, DARK), bx(0.42, 0.62, 0.26, 0, 1.12, 0.12), bx(0.14, 0.4, 0.14, -0.14, 0.78, -0.12, LEG), bx(0.14, 0.4, 0.14, 0.14, 0.78, -0.12, LEG), ball(0.13, 0, 1.58, 0.08, SKIN)]) },
  { n: 8, v: [5, 9], r: 0.9, minc: 1, maxc: 4, off: 3.0, tints: [0xe3b800, 0x1c7a3a, 0xe3b800, 0x2a2a2a],                                    // auto-rickshaw
    geo: merge([bx(1.3, 0.6, 2.3, 0, 0.55, 0.1), bx(1.3, 0.06, 1.7, 0, 1.6, 0.25, DARK), bx(1.2, 0.75, 0.04, 0, 1.2, -0.75, GLASS), bx(0.06, 0.9, 0.06, -0.62, 1.15, -0.6, DARK), bx(0.06, 0.9, 0.06, 0.62, 1.15, -0.6, DARK), bx(0.06, 0.9, 0.06, -0.62, 1.15, 1.0, DARK), bx(0.06, 0.9, 0.06, 0.62, 1.15, 1.0, DARK), wl(0.25, 0.12, 0, 0.25, -1.0), wl(0.25, 0.12, -0.65, 0.25, 0.85), wl(0.25, 0.12, 0.65, 0.25, 0.85)]) },
  { n: 4, v: [5, 9], r: 1.8, minc: 0, maxc: 3, off: 2.8, tints: [0x2e6fd0, 0xd04a2e, 0x2a9a52, 0xe0b020],                                    // painted Hino-style truck
    geo: merge([bx(2.2, 1.7, 1.8, 0, 1.3, -3.2, [.9, .9, .9]), bx(2.1, 0.5, 0.06, 0, 1.7, -4.11, GLASS), bx(2.4, 1.9, 5.6, 0, 1.95, 0.8, [.85, .85, .85]), bx(2.45, 0.25, 5.65, 0, 2.5, 0.8, [1, .3, .15]), bx(2.45, 0.12, 5.65, 0, 1.55, 0.8, [.2, .7, .3]), bx(2.4, 0.2, 7.6, 0, 0.85, -0.4, DARK), ...four(0.52, 0.3, 1.0, 2.4), wl(0.52, 0.3, -1.0, 0.52, -0.2), wl(0.52, 0.3, 1.0, 0.52, -0.2)]) },
  { n: 3, v: [1.2, 2.2], r: 1.4, minc: 3, maxc: 4, off: 3.2, tints: [0xffffff],                                                              // donkey cart
    geo: merge([bx(1.5, 0.12, 2.6, 0, 0.9, 0.4, WOOD), bx(0.06, 0.3, 2.6, -0.75, 1.05, 0.4, WOOD), bx(0.06, 0.3, 2.6, 0.75, 1.05, 0.4, WOOD), wl(0.5, 0.08, -0.82, 0.5, 0.6), wl(0.5, 0.08, 0.82, 0.5, 0.6), bx(0.06, 0.06, 2.2, -0.35, 0.85, -1.7, WOOD), bx(0.06, 0.06, 2.2, 0.35, 0.85, -1.7, WOOD), bx(0.45, 0.55, 1.1, 0, 0.9, -2.8, HIDE), bx(0.2, 0.3, 0.45, 0, 1.3, -3.5, HIDE), bx(0.1, 0.55, 0.1, -0.15, 0.3, -2.4, HIDE2), bx(0.1, 0.55, 0.1, 0.15, 0.3, -2.4, HIDE2), bx(0.1, 0.55, 0.1, -0.15, 0.3, -3.2, HIDE2), bx(0.1, 0.55, 0.1, 0.15, 0.3, -3.2, HIDE2)]) },
];
const vehMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 });
const agents = [];
for (const [t, vt] of VT.entries()) {
  vt.im = new THREE.InstancedMesh(vt.geo, vehMat, vt.n); vt.im.castShadow = true; vt.im.frustumCulled = false; scene.add(vt.im);
  for (let i = 0; i < vt.n; i++) { vt.im.setColorAt(i, new THREE.Color(vt.tints[i % vt.tints.length])); agents.push({ t, i, on: false, x: 0, z: 0, yaw: 0, r: vt.r }); }
}
const polyLen = p => { const c = [0]; for (let i = 2; i < p.length; i += 2) c.push(c.at(-1) + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1])); return c; };
const cum = r => r.cl ||= polyLen(r.p);
function atRun(a) {
  const p = a.run.p, cl = cum(a.run); let i = 1; while (i < cl.length - 1 && cl[i] < a.d) i++;
  const t = (a.d - cl[i - 1]) / (cl[i] - cl[i - 1] || 1), x = lerp(p[i * 2 - 2], p[i * 2], t), z = lerp(p[i * 2 - 1], p[i * 2 + 1], t);
  let dx = (p[i * 2] - p[i * 2 - 2]) * a.dir, dz = (p[i * 2 + 1] - p[i * 2 - 1]) * a.dir; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const off = a.off; a.x = x + dz * off; a.z = z - dx * off; a.yaw = Math.atan2(-dx, -dz);     // left of travel
}
/** lane position from the real road width: two-way roads keep to the left lane, one-way carriageways spread over their lanes */
function laneOf(a) {
  const w = a.run.w || 6, vt = VT[a.t], edge = Math.max(0, w / 2 - 1.1);
  a.off = a.run.o ? (Math.random() * 2 - 1) * Math.max(0, w / 2 - 1.6) : vt.off > 2.9 ? edge : Math.min(edge, w / 4 + 0.2);
}
function nextRun(a) {
  const p = a.run.p, ex = a.dir > 0 ? p[p.length - 2] : p[0], ez = a.dir > 0 ? p[p.length - 1] : p[1], vt = VT[a.t], opts = [];
  for (const r of runs) { if (r === a.run || r.c < vt.minc || r.c > vt.maxc) continue; const q = r.p; if (Math.hypot(q[0] - ex, q[1] - ez) < 4) opts.push([r, 1]); else if (Math.hypot(q.at(-2) - ex, q.at(-1) - ez) < 4) opts.push([r, -1]); }
  if (!opts.length) { a.dir *= -1; return; }
  const [r, dir] = opts[(Math.random() * opts.length) | 0]; a.run = r; a.dir = dir; a.d = dir > 0 ? 0 : cum(r).at(-1); laneOf(a);
}
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tp = new THREE.Vector3(), _ts = new THREE.Vector3(1, 1, 1);
function stepTraffic(dt) {
  if (!runs.length) return;
  for (const a of agents) {
    const vt = VT[a.t];
    if (a.on && Math.hypot(a.x - P.pos.x, a.z - P.pos.z) > 700) a.on = false;
    if (!a.on) {
      const r = runs[(Math.random() * runs.length) | 0]; if (r.c < vt.minc || r.c > vt.maxc) continue;
      Object.assign(a, { run: r, d: Math.random() * cum(r).at(-1), dir: Math.random() < 0.5 ? 1 : -1, v: lerp(vt.v[0], vt.v[1], Math.random()), on: true }); laneOf(a); a.v = Math.min(a.v, a.run.s ? a.run.s / 3.6 : 99); atRun(a);
      const dist = Math.hypot(a.x - P.pos.x, a.z - P.pos.z); if (dist > 600 || dist < 50) a.on = false;
    }
    if (a.on) { a.d += a.dir * a.v * dt; const L = cum(a.run).at(-1); if (a.d < 0 || a.d > L) { a.d = clamp(a.d, 0, L); nextRun(a); } atRun(a); }
    vt.im.setMatrixAt(a.i, _tm.compose(_tp.set(a.x, a.on ? 0 : -50, a.z), _tq.setFromEuler(_te.set(0, a.yaw, 0)), _ts));
  }
  for (const vt of VT) { vt.im.instanceMatrix.needsUpdate = true; if (vt.im.instanceColor) vt.im.instanceColor.needsUpdate = true; }
}

// ---------- street decor: trees + lamp posts per chunk (instanced), pedestrians, audio ----------
const treeGeo = merge([vcol(new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6).translate(0, 1.6, 0), [0.28, 0.2, 0.13]), vcol(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 4.4, 0), [0.1, 0.27, 0.07]), vcol(new THREE.IcosahedronGeometry(1.3, 0).translate(0.7, 3.6, 0.3), [0.13, 0.32, 0.09]), vcol(new THREE.IcosahedronGeometry(1.2, 0).translate(-0.6, 5.3, -0.2), [0.09, 0.24, 0.07])]);
const lampGeo = merge([vcol(new THREE.CylinderGeometry(0.07, 0.1, 7.5, 6).translate(0, 3.75, 0), [0.25, 0.26, 0.28]), bx(0.07, 0.07, 1.6, 0, 7.5, 0.8, [0.25, 0.26, 0.28]), bx(0.5, 0.12, 0.3, 0, 7.45, 1.6, [1, 0.9, 0.6])]);
const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4, emissive: 0xffd9a0, emissiveIntensity: 0 });
function decorChunk(roads, g) {
  const trees = [], lamps = [];
  for (const r of roads) {
    if (r.c > 4 || r.c < 1) continue;
    const P = r.p, w = r.w || ROAD_W[r.c]; let acc = Math.random() * 15;
    for (let k = 0; k < P.length - 2; k += 2) {
      const x0 = P[k], z0 = P[k + 1], x1 = P[k + 2], z1 = P[k + 3], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1) continue;
      const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      for (; acc < L; acc += 14 + Math.random() * 10) for (const s of [-1, 1]) {
        const o = w / 2 + 2.4, x = x0 + ux * acc - uz * o * s, z = z0 + uz * acc + ux * o * s;
        if (Math.random() < (r.c >= 3 ? 0.3 : 0.18)) trees.push(x, z, 0.8 + Math.random() * 0.7, Math.random() * 6.3);
        else if (r.c <= 3 && Math.random() < 0.25) lamps.push(x, z, Math.atan2(uz * s, -ux * s) + Math.PI / 2 * 0);
      }
      acc -= L;
    }
  }
  for (const [list, geo, mat, stride, shadow] of [[trees, treeGeo, treeMat, 4, false], [lamps, lampGeo, lampMat, 3, false]]) {
    const n = list.length / stride; if (!n) continue;
    const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = shadow;
    for (let i = 0; i < n; i++) {
      const sc = stride === 4 ? list[i * 4 + 2] : 1, rot = stride === 4 ? list[i * 4 + 3] : list[i * 3 + 2];
      im.setMatrixAt(i, _tm.compose(_tp.set(list[i * stride], 0, list[i * stride + 1]), _tq.setFromEuler(_te.set(0, rot, 0)), _ts.set(sc, sc, sc)));
    }
    _ts.set(1, 1, 1); im.computeBoundingSphere(); g.add(im);
  }
}

// pedestrians: shalwar kameez, walk the verge of real roads, legs swing
const PN = 40, ped = [];
const kameez = [0xf4f1ea, 0xd7e4f2, 0xcfc6b0, 0x9fb7a8, 0x6d7f95, 0xe9c9c9, 0x8a8a8a, 0xb89f7a];
const pBody = merge([bx(0.4, 0.78, 0.25, 0, 1.2, 0), bx(0.1, 0.58, 0.1, -0.26, 1.25, 0), bx(0.1, 0.58, 0.1, 0.26, 1.25, 0), ball(0.12, 0, 1.78, 0, SKIN), vcol(new THREE.SphereGeometry(0.125, 8, 6, 0, Math.PI * 2, 0, 1.3).translate(0, 1.8, 0.01), [0.06, 0.05, 0.05]), ball(0.07, -0.26, 0.93, 0, SKIN), ball(0.07, 0.26, 0.93, 0, SKIN)]);
const pLeg = merge([bx(0.17, 0.9, 0.17, 0, -0.45, 0), bx(0.15, 0.08, 0.28, 0, -0.9, -0.05, DARK)]);
const pMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
const pIM = new THREE.InstancedMesh(pBody, pMat, PN), lIM = new THREE.InstancedMesh(pLeg, pMat, PN), rIM = new THREE.InstancedMesh(pLeg, pMat, PN);
for (const im of [pIM, lIM, rIM]) { im.frustumCulled = false; im.castShadow = true; scene.add(im); }
for (let i = 0; i < PN; i++) { const c = new THREE.Color(kameez[i % kameez.length]); pIM.setColorAt(i, c); lIM.setColorAt(i, c); rIM.setColorAt(i, c); ped.push({ on: false, i, ph: Math.random() * 6 }); }
const _hm = new THREE.Matrix4(), _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion();
function stepPeds(dt) {
  if (!runs.length) return;
  for (const a of ped) {
    if (a.on && Math.hypot(a.x - P.pos.x, a.z - P.pos.z) > 160) a.on = false;
    if (!a.on) {
      const r = runs[(Math.random() * runs.length) | 0]; if (r.c < 2 || r.c > 4) continue;
      Object.assign(a, { run: r, d: Math.random() * cum(r).at(-1), dir: Math.random() < 0.5 ? 1 : -1, v: 1.1 + Math.random() * 0.6, side: Math.random() < 0.5 ? -1 : 1, on: true }); pedPlace(a);
      const dist = Math.hypot(a.x - P.pos.x, a.z - P.pos.z); if (dist > 130 || dist < 12) a.on = false;
    }
    if (a.on) { a.d += a.dir * a.v * dt; a.ph += a.v * dt * 4.6; const L = cum(a.run).at(-1); if (a.d < 0 || a.d > L) { a.d = clamp(a.d, 0, L); a.dir *= -1; } pedPlace(a); }
    _hm.compose(_tp.set(a.x, a.on ? 0 : -50, a.z), _tq.setFromEuler(_te.set(0, a.yaw, 0)), _ts.set(1, 1, 1));
    pIM.setMatrixAt(a.i, _hm);
    const sw = Math.sin(a.ph) * 0.55;
    for (const [im, side, s] of [[lIM, -0.1, sw], [rIM, 0.1, -sw]]) im.setMatrixAt(a.i, _lm.compose(_tp.set(side, 0.9, 0), _lq.setFromEuler(_te.set(s, 0, 0)), _ts).premultiply(_hm));
  }
  for (const im of [pIM, lIM, rIM]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
}
function pedPlace(a) {
  const p = a.run.p, cl = cum(a.run); let i = 1; while (i < cl.length - 1 && cl[i] < a.d) i++;
  const t = (a.d - cl[i - 1]) / (cl[i] - cl[i - 1] || 1), x = lerp(p[i * 2 - 2], p[i * 2], t), z = lerp(p[i * 2 - 1], p[i * 2 + 1], t);
  let dx = (p[i * 2] - p[i * 2 - 2]), dz = (p[i * 2 + 1] - p[i * 2 - 1]); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const o = (a.run.w || ROAD_W[a.run.c]) / 2 + 1.8; a.x = x - dz * o * a.side; a.z = z + dx * o * a.side; a.yaw = Math.atan2(-dx * a.dir, -dz * a.dir);
}

// audio: everything synthesised (no files). Engine pitch follows speed; ambience follows time of day.
const AU = { ctx: null, muted: false };
function audioInit() {
  if (AU.ctx) { AU.ctx.resume(); return; }
  const ctx = AU.ctx = new (window.AudioContext || window.webkitAudioContext)(), out = ctx.createGain(); out.gain.value = 0.6; out.connect(ctx.destination); AU.out = out;
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = noise.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
  const src = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
  AU.city = ctx.createGain(); AU.city.gain.value = 0.15; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; src().connect(lp); lp.connect(AU.city); AU.city.connect(out);
  AU.wind = ctx.createGain(); AU.wind.gain.value = 0; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; src().connect(bp); bp.connect(AU.wind); AU.wind.connect(out);
  const eng = ctx.createOscillator(), eng2 = ctx.createOscillator(), ef = ctx.createBiquadFilter(); eng.type = 'sawtooth'; eng2.type = 'square'; ef.type = 'lowpass'; ef.frequency.value = 380; AU.engGain = ctx.createGain(); AU.engGain.gain.value = 0;
  eng.connect(ef); eng2.connect(ef); ef.connect(AU.engGain); AU.engGain.connect(out); eng.start(); eng2.start(); AU.eng = eng; AU.eng2 = eng2; AU.ef = ef;
  AU.noise = noise; AU.step = 0; AU.horn = 4 + Math.random() * 8; AU.bird = 3;
}
function blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq; if (slide) o.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); o.connect(g); g.connect(AU.out); o.start(); o.stop(c.currentTime + dur);
}
function thud(vol = 0.3, f = 160, dur = 0.14) { const c = AU.ctx, s = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter(); s.buffer = AU.noise; lp.type = 'lowpass'; lp.frequency.value = f; g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); s.connect(lp); lp.connect(g); g.connect(AU.out); s.start(0, Math.random()); s.stop(c.currentTime + dur); }
function updateAudio(dt, night) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  AU.out.gain.setTargetAtTime(AU.muted || paused ? 0 : 0.6, t, 0.1);
  const sp = P.car ? Math.abs(myCar.speed) : 0;
  AU.engGain.gain.setTargetAtTime(P.car ? 0.07 + 0.05 * Math.min(1, sp / 30) + (keys.has('KeyW') ? 0.03 : 0) : 0, t, 0.1);
  AU.eng.frequency.setTargetAtTime(38 + sp * 3.4 + (keys.has('KeyW') ? 12 : 0), t, 0.08); AU.eng2.frequency.setTargetAtTime(19 + sp * 1.7, t, 0.08); AU.ef.frequency.setTargetAtTime(260 + sp * 22, t, 0.1);
  AU.city.gain.setTargetAtTime(0.14 + 0.1 * (1 - night) + (P.car ? 0.06 : 0), t, 0.5); AU.wind.gain.setTargetAtTime(P.car ? Math.min(0.12, sp / 300) : 0.02, t, 0.2);
  if (!P.car && P.ground && Math.hypot(P.vel.x, P.vel.z) > 1) { AU.step -= dt * Math.hypot(P.vel.x, P.vel.z) * 0.55; if (AU.step <= 0) { AU.step = 1; thud(0.12, 700, 0.07); } }
  if ((AU.horn -= dt) < 0) { AU.horn = 5 + Math.random() * 14; const f = 330 + Math.random() * 100, n = Math.random() < 0.4 ? 2 : 1; for (let i = 0; i < n; i++) setTimeout(() => AU.ctx && (blip(f, 0.22, 'square', 0.035), blip(f * 1.26, 0.22, 'square', 0.03)), i * 300); }
  if ((AU.bird -= dt) < 0) { AU.bird = 1.5 + Math.random() * 4; if (night < 0.4) { const f = 2400 + Math.random() * 1500; blip(f, 0.09, 'sine', 0.025, 700); setTimeout(() => AU.ctx && blip(f + 400, 0.09, 'sine', 0.02, -500), 110); } else blip(5200 + Math.random() * 600, 0.06, 'sine', 0.01); }
}

// ---------- landmarks (procedural stand-ins for the real thing, placed at real coordinates) ----------
const EXTRA = [];       // collision rectangles, handed to the chunk that contains them
const rectCol = (x, z, hw, hd) => EXTRA.push({ cx: x, cz: z, p: [x - hw, z - hd, x + hw, z - hd, x + hw, z + hd, x - hw, z + hd], x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
const stone = new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.6, metalness: 0.02 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xc8a24a, roughness: 0.3, metalness: 0.8 });
function landmarks() {
  const add = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  { // Faisal Mosque: tent-shaped prayer hall + four minarets, on a raised plaza
    const [x, z] = ll(33.7295, 73.0372);
    add(new THREE.Mesh(new THREE.BoxGeometry(150, 3, 150), stone), x, 1.5, z);
    add(new THREE.Mesh(new THREE.BoxGeometry(76, 12, 76), stone), x, 9, z);
    const hall = add(new THREE.Mesh(new THREE.ConeGeometry(50, 42, 8, 1), stone), x, 36, z, Math.PI / 8);
    add(new THREE.Mesh(new THREE.ConeGeometry(30, 28, 8, 1), stone), x, 56, z, 0).scale.set(1, 0.5, 1);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const mx = x + sx * 62, mz = z + sz * 62;
      add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 88, 8), stone), mx, 47, mz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(4.2, 2.8, 4, 8), stone), mx, 76, mz);
      add(new THREE.Mesh(new THREE.ConeGeometry(2.8, 14, 8), goldMat), mx, 97, mz);
      rectCol(mx, mz, 3.5, 3.5);
    }
    rectCol(x, z, 38, 38);
  }
  { // Centaurus: podium + three glass towers
    const [x, z] = ll(33.7081, 73.0510), parts = [];
    parts.push(bx(150, 26, 80, x, 13, z, [0.7, 0.72, 0.78]));
    for (const dx of [-48, 0, 48]) { parts.push(bx(36, 118, 30, x + dx, 59, z - 4, [0.55, 0.68, 0.82])); rectCol(x + dx, z - 4, 18, 15); }
    rectCol(x, z, 75, 40);
    add(new THREE.Mesh(merge(parts), bldMat), 0, 0, 0);
  }
  { // Pakistan Monument: four granite petals around a star plaza
    const [x, z] = ll(33.6931, 73.0689);
    add(new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 1.5, 24), stone), x, 0.75, z);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, petal = new THREE.Mesh(new THREE.BoxGeometry(7, 30, 15), stone); add(petal, x + Math.cos(a) * 9, 15, z + Math.sin(a) * 9, -a); petal.rotation.order = 'YXZ'; petal.rotation.z = 0.2; }
    rectCol(x, z, 12, 12);
  }
}

// ---------- the day: CHAPTERS placed on real places ----------
const PLACES = {
  home: { n: 'Home · Satellite Town, Rawalpindi', ll: [33.6376, 73.0650], col: '#ff2fa0' },
  office: { n: 'Office · Blue Area, Islamabad', ll: [33.7101, 73.0560], col: '#ffb020' },
  mall: { n: 'Centaurus, Islamabad', ll: [33.7081, 73.0510], col: '#18f0ff' },
  monal: { n: 'The Monal, Margalla Hills', ll: [33.7478, 73.0583], col: '#7dff6a' },
  park: { n: 'Fatima Jinnah Park, F-9', ll: [33.6968, 73.0127], col: '#ffe14a' },
  lab: { n: 'VTOXI Lab · Saddar, Rawalpindi', ll: [33.5973, 73.0434], col: '#b36bff' },
  faiz: { n: 'Faizabad Interchange', ll: [33.6603, 73.0836], col: '#aaaaaa' },
};
for (const s of Object.values(PLACES)) [s.x, s.z] = ll(...s.ll);
const SITE_OF = { wake: 'home', ready: 'home', commute: 'faiz', code: 'office', meet: 'mall', lunch: 'monal', build: 'office', home: 'home', family: 'park', hobby: 'lab', sleep: 'home' };
let EV = [], hour = 6.5, ffTo = 0, day = 1, trail = [], trailT = 0, mapBig = false, timeScale = 30;
const resetEvents = () => { EV = CHAPTERS.map((c, k) => ({ id: c.id, title: c.title, text: c.text, hour: c.hour, end: CHAPTERS[k + 1]?.hour ?? 24, site: PLACES[SITE_OF[c.id]], status: 'pending' })); };
resetEvents();
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1200, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
scene.add(beacon);
const activeEvent = () => EV.find(e => e.status === 'pending');
let nearEvent = null, inScene = false, sceneTimer = 0, sceneEv = null;
function completeEvent(e) { e.status = 'done'; e.at = Math.max(hour, e.hour); ffTo = Math.max(ffTo, e.end); toast(`✓ ${e.title}`, e.text); }
/** step inside: the original day walkthrough (index.html) plays that chapter's interior in an iframe, then hands control back */
function enterEvent(e) {
  const ch = CHAPTERS.find(c => c.id === e.id); if (!ch || inScene) return;
  inScene = true; sceneEv = e; document.exitPointerLock(); keys.clear();
  $('sceneTitle').textContent = `${fmt(e.hour)} · ${e.title}`;
  const f = $('sceneFrame'); f.src = `index.html?p=${((ch.start + 0.2) / TOTAL).toFixed(4)}`;
  $('scene').classList.remove('hidden'); canvas.style.visibility = 'hidden';
  $('sceneLoad').style.display = '';
  let tries = 0, started = false;
  clearInterval(sceneTimer);
  sceneTimer = setInterval(() => {
    try {
      const w = f.contentWindow, st = w && w.__story;
      if (st && !started && !w.document.body.classList.contains('loading')) { started = true; $('sceneLoad').style.display = 'none'; w.document.getElementById('play')?.click(); }   // autoplay the chapter
      if (st && started && st.P >= ch.end - 0.3) exitEvent(true);
    } catch (err) { if (++tries > 100) exitEvent(true); }
  }, 400);
}
function exitEvent(done) {
  if (!inScene) return; clearInterval(sceneTimer); inScene = false;
  $('scene').classList.add('hidden'); $('sceneFrame').src = 'about:blank'; canvas.style.visibility = '';
  if (done && sceneEv && sceneEv.status === 'pending') completeEvent(sceneEv);
  sceneEv = null; clock.getDelta();
}
$('sceneBack').addEventListener('click', () => exitEvent(true));
function updateEvents() {
  const e = activeEvent();
  nearEvent = e && ffTo <= hour && Math.hypot(P.pos.x - e.site.x, P.pos.z - e.site.z) < 70 ? e : null;
  if (nearEvent && nearEvent.id === 'commute') completeEvent(nearEvent);   // the drive itself is the commute chapter; every other stop has a scene to step into

  if (hour >= 24) {
    if (!activeEvent()) { toast(`DAY ${day} COMPLETE`, `${EV.length}/${EV.length} events lived. A new day begins.`); day++; hour = 6.5; ffTo = 0; trail = []; resetEvents(); incFired = new Set(); }
    else hour = 23.99;
  }
}

// ---------- phone: calendar, maps/GPS, chats and calls (scripted conversations that steer the day). The data here is the seam for real Slack/calendar/GPS later. ----------
PLACES.bazaar = { n: 'Saddar Bazaar, Rawalpindi', ll: [33.5985, 73.0455], col: '#ff8a3a' }; [PLACES.bazaar.x, PLACES.bazaar.z] = ll(...PLACES.bazaar.ll);
let wp = null, phoneOpen = false, phoneTab = 'day', phoneView = null, ringing = null;
const setWp = (key, label) => { const p = PLACES[key]; wp = p ? { x: p.x, z: p.z, n: p.n, col: p.col, key } : null; if (p) toast('GPS', `Heading to ${label || p.n}`); };
const CT = {
  ammi: { name: 'Ammi', role: 'Mom', pitch: 1.35, banter: ['Beta, are you eating properly?', 'Your cousin is visiting on Sunday. Keep the day free.', 'Drive slowly, the roads are busy.'] },
  sara: { name: 'Sara', role: 'Engineering manager', pitch: 1.2, banter: ['Can you review the pull request before the call?', 'The client loved the demo.', 'Remind me to book the sprint review.'] },
  ali: { name: 'Ali', role: 'Friend', pitch: 0.8, banter: ['Yaar, what a traffic jam on Kashmir Highway!', 'Did you watch the match last night?', 'We should drive up to Margalla this weekend.'] },
  wife: { name: 'Family', role: 'Home', pitch: 1.25, banter: ['The kids drew you a picture today.', 'Dinner is at eight. Do not be late!', 'Come home safe.'] },
  hamza: { name: 'Hamza', role: 'Maker friend', pitch: 0.9, banter: ['I found a cheap ESP32 supplier in Raja Bazaar.', 'My Pi cluster finally booted.', 'Thinking of adding LoRa to the sensor project.'] },
  car: { name: 'My Car', role: 'Bring it to me', pitch: 1, banter: [] },
};
const SC = {
  ammi: { m1: { t: 'Beta, did you have breakfast? Take a parantha with you.', c: [{ t: "Yes Ammi, don't worry", n: 'm2' }, { t: 'No time, I will eat at the office', n: 'm3' }] }, m2: { t: 'Okay. Drive safely, Allah hafiz.' }, m3: { t: 'Always the same. Take care of yourself.' } },
  sara: { s1: { t: 'Morning! The architecture review moved to Centaurus, 11:00. Bring the Azure diagrams.', c: [{ t: 'On my way', n: 's2', a: ['wp', 'mall'] }, { t: 'Can we do it remotely?', n: 's3' }] }, s2: { t: 'Great, see you there.' }, s3: { t: 'The client wants everyone in the room today. See you at eleven.', c: [{ t: 'Okay, heading there', n: 's2', a: ['wp', 'mall'] }] } },
  ali: { a1: { t: 'Salam bhai! Lunch at The Monal? I got a table with the view of the whole city.', c: [{ t: 'Sure, see you there', n: 'a2', a: ['wp', 'monal'] }, { t: "What's on the menu?", n: 'a4' }, { t: 'Next time, too busy', n: 'a3' }] }, a2: { t: "Perfect. I'll order the karahi before you arrive." }, a3: { t: "Okay yaar, no worries. Don't skip lunch!" }, a4: { t: 'BBQ, karahi, fresh naan. Come on, the weather is perfect!', c: [{ t: "Okay, I'm coming", n: 'a2', a: ['wp', 'monal'] }, { t: 'Not today', n: 'a3' }] } },
  wife: { w1: { t: 'The kids keep asking when you will be home. Can you stop at Saddar for fruit?', c: [{ t: 'Of course', n: 'w2', a: ['wp', 'bazaar'] }, { t: "Not tonight, I'm tired", n: 'w3' }] }, w2: { t: 'Thank you! Drive safe.' }, w3: { t: 'No problem. Come home soon.' } },
  hamza: { h1: { t: 'Bhai, I got the new ESP32 boards and a better soldering station. Lab tonight?', c: [{ t: 'Absolutely, heading there', n: 'h2', a: ['wp', 'lab'] }, { t: 'Tomorrow maybe', n: 'h3' }] }, h2: { t: 'Bringing chai!' }, h3: { t: "Hmm, okay. Don't sleep on the idea." } },
};
for (const [id, c] of Object.entries(CT)) Object.assign(c, { id, thread: [], node: null, unread: 0, ended: true });
const INC = [{ h: 6.75, c: 'ammi', n: 'm1', kind: 'msg' }, { h: 10.2, c: 'sara', n: 's1', kind: 'msg' }, { h: 12.6, c: 'ali', n: 'a1', kind: 'call' }, { h: 17.5, c: 'wife', n: 'w1', kind: 'msg' }, { h: 20.4, c: 'hamza', n: 'h1', kind: 'call' }];
let incFired = new Set();
function speak(text, pitch = 1) {
  if (AU.muted || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.pitch = pitch; u.rate = 1.05; u.volume = 0.9; speechSynthesis.speak(u); } catch (e) { /* no voices: text only */ }
}
function say(id, node, spoken = false) {
  const c = CT[id], n = SC[id]?.[node]; if (!n) return; c.thread.push({ w: 'them', t: n.t }); c.node = n.c ? node : null; c.ended = !n.c;
  if (spoken) speak(n.t, c.pitch);
}
function choose(id, i) {
  const c = CT[id], cur = SC[id][c.node], ch = cur.c[i]; c.thread.push({ w: 'me', t: ch.t });
  if (ch.a?.[0] === 'wp') setWp(ch.a[1]);
  c.node = null; if (ch.n) setTimeout(() => { say(id, ch.n, phoneView?.call === id); renderPhone(); }, 500); renderPhone();
}
function startCall(id) {
  const c = CT[id]; phoneView = { call: id, since: performance.now() };
  if (id === 'car') { const f = fwd(P.yaw, new THREE.Vector3()); myCar.g.position.set(P.pos.x + f.x * 9, 0, P.pos.z + f.z * 9); myCar.yaw = P.yaw; myCar.speed = 0; myCar.g.rotation.set(0, P.yaw, 0); toast('🚗', 'Your car is waiting nearby'); closePhone(); return; }
  if (ringing === id) { ringing = null; $('phoneBtn').classList.remove('ring'); } else if (!c.node) { const b = c.banter[(Math.random() * c.banter.length) | 0]; c.thread.push({ w: 'them', t: b }); speak(b, c.pitch); }
  if (c.node) speak(SC[id][c.node].t, c.pitch);
  renderPhone();
}
function fireIncoming() {
  for (const e of INC) if (hour >= e.h && !incFired.has(e.n)) {
    incFired.add(e.n); say(e.c, e.n); CT[e.c].unread++; updateBadge();
    if (AU.ctx) { blip(880, 0.15, 'sine', 0.1); setTimeout(() => AU.ctx && blip(1175, 0.2, 'sine', 0.1), 180); }
    if (e.kind === 'call') { ringing = e.c; $('phoneBtn').classList.add('ring'); toast(`📞 ${CT[e.c].name} is calling`, 'Press T to answer'); } else toast(`💬 ${CT[e.c].name}`, SC[e.c][e.n].t);
  }
}
function updateBadge() { const n = Object.values(CT).reduce((a, c) => a + c.unread, 0); $('phoneBadge').textContent = n || ''; $('phoneBadge').style.display = n ? '' : 'none'; }
const esc = s => s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const distTxt = p => { const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); return d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'; };
function renderPhone() {
  if (!phoneOpen) return;
  document.querySelectorAll('#phone nav button').forEach(b => b.classList.toggle('on', b.dataset.t === phoneTab && !phoneView));
  let h = '';
  const thread = id => { const c = CT[id], cur = c.node && SC[id][c.node];
    return `<div class="th">${c.thread.map(m => `<p class="${m.w}">${esc(m.t)}</p>`).join('') || '<p class="hint">No messages yet.</p>'}</div>` +
      (cur?.c ? `<div class="ch">${cur.c.map((x, i) => `<button data-act="pick" data-id="${id}" data-i="${i}">${esc(x.t)}</button>`).join('')}</div>` : ''); };
  if (phoneView?.chat) { const c = CT[phoneView.chat]; c.unread = 0; updateBadge(); h = `<button class="back" data-act="back">‹ Chats</button><h4>${c.name} <small>${c.role}</small></h4>` + thread(phoneView.chat); }
  else if (phoneView?.call) { const c = CT[phoneView.call]; c.unread = 0; updateBadge(); h = `<div class="calling"><b>${c.name}</b><small>${c.role} · on call</small></div>` + thread(phoneView.call) + `<button class="hang" data-act="hang">Hang up</button>`; }
  else if (phoneTab === 'day') h = `<h4>Today</h4>` + EV.map(e => `<div class="row ${e.status}"><span class="tm">${fmt(e.hour)}</span><div><b>${e.title}</b><small>${e.site.n}</small></div>${e.status === 'pending' ? `<button data-act="go" data-k="${Object.keys(PLACES).find(k => PLACES[k] === e.site)}">Go</button>` : '<i>✓</i>'}</div>`).join('') + (wp ? '<button class="wide" data-act="clr">Clear route</button>' : '');
  else if (phoneTab === 'map') h = `<h4>Maps</h4>${wp ? `<div class="row on"><div><b>Route set</b><small>${wp.n} · ${distTxt(wp)}</small></div><button data-act="clr">Clear</button></div>` : ''}` + Object.entries(PLACES).sort((a, b) => Math.hypot(a[1].x - P.pos.x, a[1].z - P.pos.z) - Math.hypot(b[1].x - P.pos.x, b[1].z - P.pos.z)).map(([k, p]) => `<div class="row"><span class="dot" style="background:${p.col}"></span><div><b>${p.n}</b><small>${distTxt(p)}</small></div><button data-act="go" data-k="${k}">Go</button></div>`).join('');
  else if (phoneTab === 'chat') h = `<h4>Chats</h4>` + Object.values(CT).filter(c => c.id !== 'car').map(c => `<div class="row" data-act="chat" data-id="${c.id}"><div><b>${c.name}</b><small>${esc(c.thread.at(-1)?.t || c.role)}</small></div>${c.unread ? `<i class="bd">${c.unread}</i>` : ''}</div>`).join('');
  else h = `<h4>Calls</h4>` + Object.values(CT).map(c => `<div class="row ${ringing === c.id ? 'on' : ''}"><div><b>${c.name}</b><small>${ringing === c.id ? 'Incoming call…' : c.role}</small></div><button data-act="call" data-id="${c.id}">${ringing === c.id ? 'Answer' : 'Call'}</button></div>`).join('');
  $('phBody').innerHTML = h; const th = $('phBody').querySelector('.th'); if (th) th.scrollTop = 1e6;
}
function openPhone(tab) {
  if (inScene) return; phoneOpen = true; document.exitPointerLock(); if (tab) { phoneTab = tab; phoneView = null; }
  $('phone').classList.remove('hidden'); start.classList.add('hidden'); if (ringing) { phoneTab = 'call'; phoneView = null; } renderPhone();
}
function closePhone() { phoneOpen = false; phoneView = null; $('phone').classList.add('hidden'); try { speechSynthesis.cancel(); } catch (e) { /* nothing speaking */ } canvas.requestPointerLock(); }
$('phoneBtn').addEventListener('click', () => (phoneOpen ? closePhone() : openPhone()));
$('phClose').addEventListener('click', closePhone);
$('phone').querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => { phoneTab = b.dataset.t; phoneView = null; renderPhone(); }));
$('phBody').addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const a = t.dataset.act, id = t.dataset.id;
  if (a === 'go') { setWp(t.dataset.k); renderPhone(); } else if (a === 'clr') { wp = null; renderPhone(); }
  else if (a === 'chat') { phoneView = { chat: id }; renderPhone(); } else if (a === 'back') { phoneView = null; renderPhone(); }
  else if (a === 'call') startCall(id); else if (a === 'hang') { phoneView = null; try { speechSynthesis.cancel(); } catch (err) { /* nothing speaking */ } renderPhone(); }
  else if (a === 'pick') choose(id, +t.dataset.i);
});

// ---------- sky update ----------
let nightK = 0;
const tmpA = new THREE.Color(), tmpB = new THREE.Color(), _d = new THREE.Vector3();
const snap = (v, s) => Math.round(v / s) * s;
function updateSky() {
  const a = (hour - 6) / 12 * Math.PI, el = Math.sin(a);
  const dayK = THREE.MathUtils.smoothstep(el, -0.1, 0.25), duskK = Math.exp(-((el / 0.18) ** 2));
  const dir = _d.set(Math.cos(a), el, -0.3).normalize();
  sky.position.copy(cam.position); su.sunPosition.value.copy(dir);
  su.rayleigh.value = 0.25 + 1.5 * dayK + duskK * 1.2; su.mieCoefficient.value = 0.003 + duskK * 0.004;
  if (Math.abs(hour - envHour) > 0.3) {
    envHour = hour; envSky.material.uniforms.sunPosition.value.copy(dir); envSky.material.uniforms.rayleigh.value = su.rayleigh.value;
    envRT?.dispose(); envRT = pmrem.fromScene(envScene); scene.environment = envRT.texture;
  }
  scene.environmentIntensity = 0.1 + 0.2 * dayK;
  tmpA.setRGB(0.42, 0.55, 0.75).lerp(tmpB.setRGB(0.9, 0.55, 0.38), duskK * 0.7).lerp(tmpB.setRGB(0.02, 0.03, 0.07), 1 - dayK);
  scene.fog.color.copy(tmpA); scene.fog.density = 0.0003 + 0.0002 * (1 - dayK) + 0.0003 * duskK;
  sun.position.set(snap(P.pos.x + dir.x * 600, 8), P.pos.y + dir.y * 600, snap(P.pos.z + dir.z * 600, 8)); sun.target.position.set(snap(P.pos.x, 8), 0, snap(P.pos.z, 8));
  sun.intensity = 1.7 * dayK; sun.color.setRGB(1, 0.96, 0.9).lerp(tmpB.setRGB(1, 0.6, 0.35), duskK);
  moon.intensity = 0.7 * (1 - dayK); moon.position.set(P.pos.x - dir.x * 600, 400, P.pos.z - dir.z * 600); moon.target.position.copy(P.pos);
  hemi.intensity = 0.3 - 0.05 * dayK; hemi.color.setRGB(0.8, 0.88, 1).lerp(tmpB.setRGB(0.25, 0.3, 0.5), 1 - dayK);
  stars.material.opacity = clamp(1 - dayK * 1.6, 0, 1); stars.position.copy(cam.position);
  const night = nightK = 1 - dayK;
  lampMat.emissiveIntensity = 2.5 * night;
  bldMat.emissiveIntensity = 1.1 * night; myCar.lights.forEach(l => l.intensity = 1800 * night * night);
  bloom.threshold = lerp(4, 0.9, night); bloom.strength = 0.1 + 0.3 * night; renderer.toneMappingExposure = 0.5 + 0.35 * night;
  ground.material.color.setScalar(0.5 + 0.5 * dayK);
}

// ---------- HUD ----------
const fmt = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor(h % 1 * 60)).padStart(2, '0')}`;
let toastT = 0; function toast(t, s) { $('toast').innerHTML = `${t}<small>${s}</small>`; $('toast').style.opacity = 1; toastT = 3.2; }
let placeT = 0, placeName = '', roadT = 0, roadInfo = null;
function nearestPlace() {
  let best = 1e9, nm = '';
  for (const l of GL.labels) if (l.k !== 'road' && l.k !== 'poi') { const d = (l.x - P.pos.x) ** 2 + (l.z - P.pos.z) ** 2; if (d < best) { best = d; nm = l.n; } }
  return best < 2500 ** 2 ? nm : '';
}
function nearestRoad() {
  let best = 14 * 14, hit = null;
  for (const r of runs) {
    if (P.pos.x < r.x0 || P.pos.x > r.x1 || P.pos.z < r.z0 || P.pos.z > r.z1) continue;
    const p = r.p;
    for (let k = 0; k < p.length - 2; k += 2) {
      const ex = p[k + 2] - p[k], ez = p[k + 3] - p[k + 1], t = clamp(((P.pos.x - p[k]) * ex + (P.pos.z - p[k + 1]) * ez) / (ex * ex + ez * ez || 1), 0, 1), d = (P.pos.x - p[k] - ex * t) ** 2 + (P.pos.z - p[k + 1] - ez * t) ** 2;
      if (d < best) { best = d; hit = r; }
    }
  }
  return hit && { n: hit.n, s: hit.s, w: Math.round(hit.w), o: hit.o };
}
function updateHud(dt) {
  $('clock').textContent = fmt(hour);
  placeT -= dt; if (placeT <= 0) { placeT = 1.5; placeName = nearestPlace(); }
  $('uni').textContent = placeName || 'Rawalpindi · Islamabad';
  $('day').textContent = `Day ${day}${ffTo > hour ? ' · time passing…' : ''}`;
  const e = activeEvent();
  const tgt = wp || (e && e.site);
  if (tgt) {
    const dx = tgt.x - P.pos.x, dz = tgt.z - P.pos.z, dist = Math.hypot(dx, dz), view = P.car ? myCar.yaw + P.lookYaw : P.yaw, rel = Math.atan2(dx, -dz) + view;
    $('obj').innerHTML = `<span id="arrow" style="transform:rotate(${rel}rad)">▲</span> <b>${wp ? 'Route' : e.title}</b> — ${tgt.n}<br><small>${dist > 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'}${wp ? '' : ` · ${fmt(e.hour)}–${fmt(e.end)}`}</small>`;
    beacon.position.set(tgt.x, 600, tgt.z); beacon.material.color.set(tgt.col); beacon.visible = true;
    if (wp && dist < 40) { toast('Arrived', wp.n); wp = null; }
  } else { $('obj').innerHTML = 'Day done. Wander freely.'; beacon.visible = false; }
  roadT -= dt; if (roadT <= 0) { roadT = 0.5; roadInfo = nearestRoad(); }
  $('roadinfo').innerHTML = roadInfo ? `${roadInfo.n || 'Street'}${roadInfo.s ? ` · limit ${roadInfo.s}` : ''} <small>${roadInfo.w} m wide${roadInfo.o ? ' · one-way' : ''}</small>` : '';
  $('prompt').textContent = nearEvent && nearEvent.id !== 'commute' ? `E — enter: ${nearEvent.title}` : !P.car && myCar.g.position.distanceTo(P.pos) < 5 ? 'F — get in the car' : '';
  $('speed').style.display = P.car ? 'block' : 'none';
  if (P.car) $('speed').innerHTML = `${Math.abs(Math.round(myCar.speed * 3.6))}<small>KM/H</small>`;
}

// ---------- map ----------
const MW = 3072, mscale = MW / (BOUNDS.x1 - BOUNDS.x0), mpx = x => (x - BOUNDS.x0) * mscale, mpz = z => (z - BOUNDS.z0) * mscale;
const mapBase = document.createElement('canvas'); mapBase.width = MW; mapBase.height = Math.round((BOUNDS.z1 - BOUNDS.z0) * mscale);
function buildMapBase() {
  const x = mapBase.getContext('2d'); x.fillStyle = '#1b2230'; x.fillRect(0, 0, mapBase.width, mapBase.height);
  for (const a of GL.areas) { x.fillStyle = a.k === 'water' ? '#244a6a' : a.k === 'zone' ? '#262a36' : '#22402c'; x.beginPath(); for (let i = 0; i < a.p.length; i += 2) x[i ? 'lineTo' : 'moveTo'](mpx(a.p[i]), mpz(a.p[i + 1])); x.fill(); }
  x.lineCap = 'round';
  for (const cls of [2, 1, 0]) for (const r of GL.overview) if (r.c === cls) { x.strokeStyle = ['#e8c070', '#d8d8e0', '#8a93a8'][cls]; x.lineWidth = [2.6, 2.2, 1.2][cls]; x.beginPath(); for (let i = 0; i < r.p.length; i += 2) x[i ? 'lineTo' : 'moveTo'](mpx(r.p[i]), mpz(r.p[i + 1])); x.stroke(); }
}
const mctx = $('map').getContext('2d');
function drawMap() {
  const W = 440, ctx = mctx, view = P.car ? myCar.yaw + P.lookYaw : P.yaw, bw = BOUNDS.x1 - BOUNDS.x0, bh = BOUNDS.z1 - BOUNDS.z0;
  const sc = mapBig ? Math.min(W / bw, W / bh) : W / 2600, cx = mapBig ? (BOUNDS.x0 + BOUNDS.x1) / 2 : P.pos.x, cz = mapBig ? (BOUNDS.z0 + BOUNDS.z1) / 2 : P.pos.z;
  ctx.fillStyle = '#10141c'; ctx.fillRect(0, 0, W, W); ctx.save();
  ctx.translate(W / 2, W / 2); if (!mapBig) ctx.rotate(view); ctx.scale(sc, sc); ctx.translate(-cx, -cz);
  ctx.drawImage(mapBase, BOUNDS.x0, BOUNDS.z0, bw, bh);
  const px = 1 / sc; ctx.lineWidth = 3 * px; ctx.lineJoin = 'round';
  for (let k = 1; k < trail.length; k++) { if (Math.hypot(trail[k][0] - trail[k - 1][0], trail[k][1] - trail[k - 1][1]) > 300) continue; ctx.strokeStyle = `hsl(${(trail[k][2] / 24) * 300 + 180},100%,60%)`; ctx.beginPath(); ctx.moveTo(trail[k - 1][0], trail[k - 1][1]); ctx.lineTo(trail[k][0], trail[k][1]); ctx.stroke(); }
  const e = activeEvent(), pulse = (7 + Math.sin(performance.now() / 200) * 3) * px;
  if (wp) { ctx.strokeStyle = '#fff'; ctx.setLineDash([8 * px, 6 * px]); ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.moveTo(P.pos.x, P.pos.z); ctx.lineTo(wp.x, wp.z); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = wp.col; ctx.beginPath(); ctx.arc(wp.x, wp.z, pulse * 1.5, 0, 7); ctx.fill(); }
  ctx.textAlign = 'center';
  for (const s of Object.values(PLACES)) {
    const on = e && e.site === s; ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(s.x, s.z, on ? pulse * 1.3 : 5 * px, 0, 7); ctx.fill();
    if (mapBig || on) { ctx.font = `600 ${12 * px}px Chakra Petch, sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(s.n.split('·').at(-1).trim(), s.x, s.z - 12 * px); }
  }
  if (mapBig) { ctx.font = `700 ${15 * px}px Chakra Petch, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('ISLAMABAD', ...ll(33.69, 73.03)); ctx.fillText('RAWALPINDI', ...ll(33.60, 73.05)); }
  ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(P.pos.x, P.pos.z); ctx.rotate(mapBig ? -view : 0); ctx.beginPath(); ctx.moveTo(0, -11 * px); ctx.lineTo(7 * px, 8 * px); ctx.lineTo(-7 * px, 8 * px); ctx.fill(); ctx.restore();
  ctx.restore();
}

// ---------- input ----------
const start = $('start');
start.addEventListener('click', () => { canvas.requestPointerLock(); audioInit(); }); canvas.addEventListener('click', () => { canvas.requestPointerLock(); audioInit(); });
let paused = true;
document.addEventListener('pointerlockchange', () => { paused = document.pointerLockElement !== canvas; start.classList.toggle('hidden', !paused || phoneOpen || inScene); if (paused) keys.clear(); });
addEventListener('mousemove', e => {
  if (paused) return;
  if (P.car && !P.chase) P.lookYaw = clamp(P.lookYaw - e.movementX * 0.0022, -1.8, 1.8); else if (!P.car) P.yaw -= e.movementX * 0.0022;
  P.pitch = clamp(P.pitch - e.movementY * 0.0022, -1.4, 1.4);
});
const ARROWS = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
addEventListener('keydown', e => {
  if (e.code === 'KeyT' && !e.repeat && (!paused || phoneOpen) && !inScene) { phoneOpen ? closePhone() : openPhone(); return; }
  if (paused) return; keys.add(ARROWS[e.code] || e.code); if (e.code === 'Space' || ARROWS[e.code]) e.preventDefault(); if (e.repeat) return;
  if (e.code === 'KeyF') toggleCar();
  if (e.code === 'KeyE' && nearEvent && nearEvent.id !== 'commute') enterEvent(nearEvent);
  if (e.code === 'KeyV') P.chase = !P.chase;
  if (e.code === 'KeyN') AU.muted = !AU.muted;
  if (e.code === 'KeyM') { mapBig = !mapBig; $('map').classList.toggle('big', mapBig); }
  if (e.code === 'BracketRight') timeScale = Math.min(timeScale * 2, 240);
  if (e.code === 'BracketLeft') timeScale = Math.max(timeScale / 2, 1);
});
addEventListener('keyup', e => keys.delete(ARROWS[e.code] || e.code));

function setQuality(q) {
  qLevel = q; try { localStorage.setItem('q', q); } catch (e) {}
  pr = Math.min(devicePixelRatio, PR_CAP[q]); renderer.setPixelRatio(pr); composer.setPixelRatio(pr); gtao.enabled = false; sun.castShadow = q > 0;
  document.querySelectorAll('#start [data-q]').forEach(b => b.classList.toggle('on', +b.dataset.q === q));
}
document.querySelectorAll('#start [data-q]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setQuality(+b.dataset.q); }));
setQuality(qLevel);

// ---------- boot + loop ----------
function teleport(key, car = false) {
  const s = PLACES[key]; P.pos.set(s.x + 8, 0, s.z + 8); P.vel.set(0, 0, 0); P.yaw = 0.6;
  myCar.g.position.set(s.x + 12, 0, s.z + 3); myCar.yaw = 0; myCar.speed = 0; myCar.g.rotation.set(0, 0, 0); P.car = car ? myCar : null;
}
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, goodFps = 0;
function governor(dt) {
  fpsAcc += dt; fpsN++; if (fpsAcc < 2) return;
  const fps = fpsN / fpsAcc; fpsAcc = fpsN = 0;
  const cap = Math.min(devicePixelRatio, PR_CAP[qLevel]), next = fps < 45 ? Math.max(0.55, pr - 0.15) : fps > 58 ? Math.min(cap, pr + 0.1) : pr;
  if (next !== pr) { pr = next; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); }
  goodFps = fps > 58 ? goodFps + 1 : 0; if (fps < 42) gtao.enabled = false; else if (goodFps >= 2 && pr >= 1.2 && qLevel === 2) gtao.enabled = true;   // AO only when the GPU has headroom
  sun.castShadow = qLevel > 0 && pr > 0.7;
}
const TM = {};
function tm(k, f) { const t = performance.now(); f(); TM[k] = (TM[k] || 0) * 0.9 + (performance.now() - t) * 0.1; }
function frame() {
  if (inScene) { requestAnimationFrame(frame); return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) {
    if (ffTo > hour) { hour += Math.min(0.5 * dt * 2, ffTo - hour); if (ffTo - hour < 1e-3) ffTo = 0; } else hour += timeScale / 3600 * dt;
    if (P.car) stepCar(dt); else stepFoot(dt);
    trailT -= dt; if (trailT <= 0) { trailT = 1; trail.push([P.pos.x, P.pos.z, hour]); if (trail.length > 6000) trail.shift(); }
    tm('traffic', () => stepTraffic(dt)); tm('peds', () => stepPeds(dt)); updateEvents(); fireIncoming();
  } else if (P.car) stepCar(0); else stepFoot(0);
  tm('stream', streamChunks);
  ground.position.set(snap(P.pos.x, TILE), 0, snap(P.pos.z, TILE));
  tm('sky', updateSky); updateAudio(dt, nightK); tm('hud', () => updateHud(dt)); tm('map', drawMap); governor(dt);
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  tm('render', () => composer.render()); requestAnimationFrame(frame);
}
(async () => {
  GL = await (await fetch(`world/global.json?v=${WV}`)).json();
  GL.chunks.forEach(([i, j]) => have.add(kk(i, j)));
  buildMapBase(); landmarks();
  const gm = blank(), gw = blank();
  const gz = blank();
  for (const a of GL.areas) a.k === 'zone' ? fillPoly(a.p, 0.03, gz, ZONE_C[a.u]) : fillPoly(a.p, a.k === 'water' ? 0.07 : 0.05, a.k === 'water' ? gw : gm);
  for (const [o, m] of [[gz, zoneMat], [gm, greenMat], [gw, waterMat]]) { const me = mkMesh(o, m); if (me) scene.add(me); }
  teleport('home'); P.yaw = Math.PI * 0.9;
  const [ci, cj] = ck(P.pos.x, P.pos.z);                                  // block on the nearest chunks so you never spawn in the void
  await Promise.all([[ci, cj], [ci + 1, cj], [ci, cj + 1], [ci - 1, cj], [ci, cj - 1]].filter(([i, j]) => have.has(kk(i, j))).map(([i, j]) => loadChunk(i, j)));
  frame();
})();
window.__city = { TM, renderer, composer, sun, bloom, gtao, scene, tp: (lat, lon, car = false) => { const [x, z] = ll(lat, lon); P.pos.set(x, 0, z); myCar.g.position.set(x + 4, 0, z); myCar.speed = 0; P.car = car ? myCar : null; }, P, myCar, get hour() { return hour; }, set hour(v) { hour = v; }, teleport, PLACES, get paused() { return paused; }, set paused(v) { paused = v; start.classList.toggle('hidden', !v); }, keys, loaded, runs, agents, EV };
