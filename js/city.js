/**
 * Vice Multiverse: first-person open-world city. Island grid of N x N lots, a day clock that
 * drives sky + CHAPTERS-as-events, hovercars, traffic, and rifts that swap the active universe.
 * 1 unit ~ 1 ft. y up. Debug hook: window.__city.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CHAPTERS } from './story.js';

const $ = id => document.getElementById(id);
const N = 14, BLOCK = 70, HALF = N * BLOCK / 2, ISLAND = 560;
const lotC = i => (i - (N - 1) / 2) * BLOCK;
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const C = h => new THREE.Color(h);

const UNI = [
  { name: 'Vice Prime', tag: 'Earth-2186', day: 0x86c8ff, dusk: 0xff6f9c, night: 0x0b0322, neon: [0xff2fa0, 0x18f0ff, 0xffb020], bldg: [0xd9d4cc, 0x9aa6b2, 0xe8dcc8, 0x5d6a78], ground: 0xffffff, sea: 0x0c4a6e, g: 32, hs: 1, fog: 0.0018 },
  { name: 'Verdant Loop', tag: 'Earth-77G', day: 0xbfe8b0, dusk: 0xffc25a, night: 0x041a12, neon: [0x7dff6a, 0xffe14a, 0x3affc8], bldg: [0x9fcf8f, 0xe8e0b8, 0x6fa88a, 0xd8f0d0], ground: 0xc8e8b0, sea: 0x0d5a4a, g: 32, hs: 0.55, fog: 0.0024 },
  { name: 'Low-G Drift', tag: 'Earth-0.3g', day: 0xb7a6ff, dusk: 0xff7a5a, night: 0x07031a, neon: [0xb36bff, 0xff5ad1, 0x5af0ff], bldg: [0x8a7bc8, 0x5a4a9a, 0xc0b0ff, 0x3a2f6a], ground: 0xb0a8ff, sea: 0x2a1060, g: 9, hs: 1.9, fog: 0.0013 },
  { name: 'Gridline Zero', tag: 'Earth-NULL', day: 0x0a1630, dusk: 0x301040, night: 0x000008, neon: [0x00f0ff, 0xff7a00, 0x00ff9a], bldg: [0x00b8d0, 0xff7a00, 0x00f0ff, 0x40ffb0], ground: 0x406080, sea: 0x001020, g: 32, hs: 1.2, fog: 0.0016, wire: true },
];
let uni = 0, U = UNI[0];

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, U.fog);
const cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.3, 5000);
cam.rotation.order = 'YXZ';
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.5); scene.add(sun, sun.target);
const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
let envRT = null, envHour = -9, envUni = -1;
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 1400 });
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe8b0, fog: false }));
const moonBall = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 12), new THREE.MeshBasicMaterial({ color: 0xcfe0ff, fog: false }));
scene.add(sunBall, moonBall);
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 4500 }, () => 0).map((_, i, a) => {
  if (i % 3) return a[i]; const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y); v.multiplyScalar(3000); a[i + 1] = v.y; a[i + 2] = v.z; return v.x;
}), 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, fog: false, transparent: true }));
scene.add(stars);

// ---------- ground (one canvas = ground texture + minimap base) ----------
const GC = 2048, gk = GC / (ISLAND * 2), gx = v => (v + ISLAND) * gk;
const gcan = document.createElement('canvas'); gcan.width = gcan.height = GC;
const g2 = gcan.getContext('2d');
g2.fillStyle = '#d8c39a'; g2.fillRect(0, 0, GC, GC);                       // beach ring
g2.fillStyle = '#15171e'; g2.fillRect(gx(-HALF - 10), gx(-HALF - 10), (HALF * 2 + 20) * gk, (HALF * 2 + 20) * gk);
const SITES = {
  home: { i: 2, j: 10, name: 'Palm Villa', col: '#ff2fa0' },
  sky: { i: 7, j: 7, name: 'Central Skyport', col: '#18f0ff' },
  office: { i: 10, j: 3, name: 'Nexus Tower', col: '#ffb020' },
  cafe: { i: 12, j: 9, name: 'Ocean Café', col: '#7dff6a' },
  lab: { i: 3, j: 3, name: 'VTOXI Lab', col: '#b36bff' },
  beach: { x: 530, z: 260, name: 'Starlight Beach', col: '#ffe14a' },
};
for (const s of Object.values(SITES)) if (s.i !== undefined) { s.x = lotC(s.i); s.z = lotC(s.j); }
const isSite = (i, j) => Object.values(SITES).some(s => s.i === i && s.j === j);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x = lotC(i), z = lotC(j);
  g2.fillStyle = '#2c2f3a'; g2.fillRect(gx(x - 27), gx(z - 27), 54 * gk, 54 * gk);
  g2.fillStyle = isSite(i, j) ? '#1f3a2a' : '#1c1f28'; g2.fillRect(gx(x - 25), gx(z - 25), 50 * gk, 50 * gk);
}
g2.strokeStyle = '#c9b46a'; g2.lineWidth = 1.2; g2.setLineDash([10, 12]);
for (let k = 0; k <= N; k++) {
  const r = gx(-HALF + k * BLOCK);
  g2.beginPath(); g2.moveTo(r, gx(-HALF)); g2.lineTo(r, gx(HALF)); g2.moveTo(gx(-HALF), r); g2.lineTo(gx(HALF), r); g2.stroke();
}
const groundTex = new THREE.CanvasTexture(gcan);
groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8;
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.85, metalness: 0.1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(ISLAND * 2, ISLAND * 2), groundMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const seaMat = new THREE.MeshStandardMaterial({ color: U.sea, roughness: 0.06, metalness: 0.9 });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), seaMat);
sea.rotation.x = -Math.PI / 2; sea.position.y = -0.8; scene.add(sea);

// ---------- buildings (instanced) ----------
function windowCanvas(lit) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = lit ? '#000' : '#d8d8d8'; x.fillRect(0, 0, 64, 256);
  for (let r = 0; r < 32; r++) for (let q = 0; q < 8; q++) {
    const on = Math.random() < 0.45;
    x.fillStyle = lit ? (on ? pick(['#ffe2a0', '#a0f0ff', '#ffb0e0']) : '#000') : (on ? '#fff' : '#3a3f4a');
    x.fillRect(q * 8 + 2, r * 8 + 2, 5, 5);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
const bldMat = new THREE.MeshStandardMaterial({ map: windowCanvas(false), emissiveMap: windowCanvas(true), emissive: 0xffffff, roughness: 0.22, metalness: 0.7, envMapIntensity: 1.2 });
for (const t of [bldMat.map, bldMat.emissiveMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); t.anisotropy = 8; }
const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const B = [];                                  // {x,z,hw,hd,h,ci,ni}
const lots = Array.from({ length: N * N }, () => []);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  if (isSite(i, j)) continue;
  const x = lotC(i), z = lotC(j), d = Math.hypot(x, z) / HALF;
  const beachfront = i === N - 1 || j === 0 || j === N - 1 || i === 0;
  const tall = beachfront ? rnd(28, 70) : 30 + rnd(40) + 300 * Math.exp(-d * d * 5) * rnd(0.4, 1);
  const parts = Math.random() < 0.45 ? [[0, 0, rnd(16, 23), rnd(16, 23)]] : [[-12, -12], [12, -12], [-12, 12], [12, 12]].map(([a, b]) => [a, b, rnd(7, 11), rnd(7, 11)]);
  for (const [ox, oz, hw, hd] of parts) {
    const b = { x: x + ox, z: z + oz, hw, hd, h: tall * rnd(0.45, 1.1), ci: (Math.random() * 4) | 0, ni: (Math.random() * 3) | 0 };
    B.push(b); lots[i * N + j].push(b);
  }
}
const bldIM = new THREE.InstancedMesh(boxGeo, bldMat, B.length);
const trimIM = new THREE.InstancedMesh(boxGeo, trimMat, B.length);
bldIM.castShadow = bldIM.receiveShadow = true;
scene.add(bldIM, trimIM);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function layoutBuildings() {
  B.forEach((b, k) => {
    const h = b.h * U.hs;
    bldIM.setMatrixAt(k, _m.compose(_p.set(b.x, 0, b.z), _q.identity(), _s.set(b.hw * 2, h, b.hd * 2)));
    trimIM.setMatrixAt(k, _m.compose(_p.set(b.x, h, b.z), _q, _s.set(b.hw * 2 + 0.8, 0.9, b.hd * 2 + 0.8)));
    bldIM.setColorAt(k, C(U.bldg[b.ci])); trimIM.setColorAt(k, C(U.neon[b.ni]));
  });
  for (const im of [bldIM, trimIM]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
}

// ---------- landmarks ----------
const glow = c => new THREE.MeshBasicMaterial({ color: c });
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.5, ...o });
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
const solid = (s, hw, hd, h) => lots[s.i * N + s.j].push({ x: s.x, z: s.z, hw, hd, h, fixed: true });
const landmarkNeon = [];
{ const s = SITES.home, g = new THREE.Group(); g.position.set(s.x, 0, s.z); scene.add(g);
  add(g, new THREE.BoxGeometry(30, 12, 18), std(0xfdf4f8), -4, 6, -8); add(g, new THREE.BoxGeometry(20, 10, 16), std(0xffe0ec), 6, 17, -9);
  add(g, new THREE.BoxGeometry(31, 0.6, 1), glow(0xff2fa0), -4, 12.3, 1.2); landmarkNeon.push(g.children[2]);
  add(g, new THREE.BoxGeometry(18, 0.4, 10), glow(0x18f0ff), 2, 0.3, 12);
  solid(s, 16, 18, 22); }
{ const s = SITES.office, g = new THREE.Group(); g.position.set(s.x, 0, s.z); scene.add(g);
  add(g, new THREE.CylinderGeometry(16, 22, 330, 8), std(0x7fa8d8, { metalness: 0.9, roughness: 0.1 }), 0, 165, 0);
  for (let y = 40; y < 330; y += 45) landmarkNeon.push(add(g, new THREE.TorusGeometry(22 - y / 30, 0.8, 6, 32), glow(0xffb020), 0, y, 0)), g.children.at(-1).rotation.x = Math.PI / 2;
  add(g, new THREE.CylinderGeometry(0.6, 0.6, 60), glow(0xff2fa0), 0, 360, 0);
  solid(s, 21, 21, 330); }
{ const s = SITES.cafe, g = new THREE.Group(); g.position.set(s.x, 0, s.z); scene.add(g);
  add(g, new THREE.BoxGeometry(34, 10, 22), std(0xfff4d8), 0, 5, -6);
  const ring = add(g, new THREE.TorusGeometry(7, 0.9, 8, 40), glow(0x7dff6a), 0, 18, 5); landmarkNeon.push(ring);
  solid(s, 17, 17, 10); }
{ const s = SITES.lab, g = new THREE.Group(); g.position.set(s.x, 0, s.z); scene.add(g);
  add(g, new THREE.SphereGeometry(22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb36bff, wireframe: true }));
  const core = add(g, new THREE.IcosahedronGeometry(6, 1), glow(0xff5ad1), 0, 10, 0); core.userData.spin = 1; landmarkNeon.push(core);
  solid(s, 4, 4, 16); }
{ const s = SITES.sky, g = new THREE.Group(); g.position.set(s.x, 0, s.z); scene.add(g);
  add(g, new THREE.CylinderGeometry(24, 18, 3, 32), std(0x2a2f40), 0, 30, 0);
  add(g, new THREE.CylinderGeometry(4, 6, 30, 12), std(0x404860), 0, 15, 0);
  landmarkNeon.push(add(g, new THREE.TorusGeometry(22, 0.6, 6, 48), glow(0x18f0ff), 0, 31.6, 0)); g.children.at(-1).rotation.x = Math.PI / 2;
  add(g, new THREE.CylinderGeometry(0.5, 0.5, 120), glow(0x18f0ff), 0, 90, 0);
  lots[s.i * N + s.j].push({ x: s.x, z: s.z, hw: 6, hd: 6, h: 30, fixed: true }, { x: s.x, z: s.z, hw: 20, hd: 20, h: 31.5, fixed: true, deck: 28.5 }); }

// palms on the beach ring + boulevard
const palmN = 220, trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.9, 1, 6).translate(0, 0.5, 0), std(0x7a5a3a, { metalness: 0 }), palmN);
const FR = 8, frondGeo = new THREE.PlaneGeometry(2.2, 11, 1, 6).translate(0, 5.5, 0);
{ const a = frondGeo.attributes.position; for (let v = 0; v < a.count; v++) { const y = a.getY(v); a.setZ(v, -0.02 * y * y); a.setX(v, a.getX(v) * Math.sin(Math.PI * Math.min(1, y / 11 + 0.05))); } frondGeo.computeVertexNormals(); }
const crownIM = new THREE.InstancedMesh(frondGeo, std(0x3d6b2a, { metalness: 0, roughness: 0.8, side: THREE.DoubleSide }), palmN * FR);
crownIM.castShadow = trunkIM.castShadow = true;
for (let k = 0; k < palmN; k++) {
  let x, z;
  if (k < 160) { const t = rnd(-1, 1) * (ISLAND - 25), e = rnd(HALF + 18, ISLAND - 12); [x, z] = pick([[e, t], [-e, t], [t, e], [t, -e]]); }
  else { x = lotC(1) + 35; z = -HALF + (k - 160) * (HALF * 2 / 60); x += k % 2 ? 4 : -4; }
  const h = rnd(18, 30);
  trunkIM.setMatrixAt(k, _m.compose(_p.set(x, 0, z), _q.setFromEuler(_e.set(rnd(-0.12, 0.12), 0, rnd(-0.12, 0.12))), _s.set(1, h, 1)));
  for (let f = 0; f < FR; f++) crownIM.setMatrixAt(k * FR + f, _m.compose(_p.set(x, h, z), _q.setFromEuler(_e.set(rnd(0.9, 1.4), f / FR * Math.PI * 2 + rnd(0.3), 0, 'YXZ')), _s.set(1, 1, 1)));
}
scene.add(trunkIM, crownIM);

// lamp posts at intersections
const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 1, 0.6).translate(0, 0.5, 0), std(0x303040), (N + 1) ** 2);
const lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.5, 2.6), glow(0xffffff), (N + 1) ** 2);
for (let a = 0, k = 0; a <= N; a++) for (let b = 0; b <= N; b++, k++) {
  const x = -HALF + a * BLOCK + 11, z = -HALF + b * BLOCK + 11;
  lamps.setMatrixAt(k, _m.compose(_p.set(x, 0, z), _q.identity(), _s.set(1, 16, 1)));
  lampHeads.setMatrixAt(k, _m.compose(_p.set(x, 16, z), _q, _s.set(1, 1, 1)));
}
scene.add(lamps, lampHeads);

// ---------- traffic (ground + sky lanes) ----------
const TN = 150, traffic = [];
const carBodyIM = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 2.6, 12), std(0xffffff, { metalness: 0.8, roughness: 0.2 }), TN);
const carGlowIM = new THREE.InstancedMesh(new THREE.BoxGeometry(6.6, 0.4, 12.6), glow(0xffffff), TN);
for (let k = 0; k < TN; k++) {
  const sky = k > 95, road = -HALF + ((Math.random() * (N + 1)) | 0) * BLOCK, dir = Math.random() < 0.5 ? 1 : -1;
  traffic.push({ axis: Math.random() < 0.5 ? 'x' : 'z', lane: road + dir * 5, t: rnd(-HALF, HALF), v: dir * (sky ? rnd(70, 140) : rnd(30, 60)), y: sky ? rnd(70, 220) : 2.2, ni: k % 3 });
  carBodyIM.setColorAt(k, C(pick([0xf0f0f0, 0x202028, 0xff4080, 0x40c0ff, 0xffd040])));
}
scene.add(carBodyIM, carGlowIM);
function updateTraffic(dt) {
  traffic.forEach((c, k) => {
    c.t += c.v * dt; const lim = c.y > 10 ? ISLAND + 400 : HALF;
    if (c.t > lim) c.t = -lim; else if (c.t < -lim) c.t = lim;
    const x = c.axis === 'x' ? c.t : c.lane, z = c.axis === 'x' ? c.lane : c.t;
    const yaw = c.axis === 'x' ? (c.v > 0 ? -Math.PI / 2 : Math.PI / 2) : (c.v > 0 ? Math.PI : 0);
    const bob = c.y > 10 ? Math.sin(c.t * 0.05) * 2 : 0;
    _q.setFromEuler(_e.set(0, yaw, 0));
    carBodyIM.setMatrixAt(k, _m.compose(_p.set(x, c.y + bob, z), _q, _s.set(1, 1, 1)));
    carGlowIM.setMatrixAt(k, _m.compose(_p.set(x, c.y + bob - 1.5, z), _q, _s));
  });
  carBodyIM.instanceMatrix.needsUpdate = carGlowIM.instanceMatrix.needsUpdate = true;
}
function colorTraffic() { traffic.forEach((c, k) => carGlowIM.setColorAt(k, C(U.neon[c.ni]))); carGlowIM.instanceColor.needsUpdate = true; }

// ---------- player hovercars ----------
function makeHover(color) {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(7, 2.2, 15), std(color, { metalness: 0.85, roughness: 0.18 }));
  add(g, new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35, roughness: 0, metalness: 1 }), 0, 1.1, 1).scale.set(1, 0.8, 1.6);
  const under = add(g, new THREE.BoxGeometry(7.4, 0.4, 15.4), glow(0x18f0ff), 0, -1.3, 0);
  add(g, new THREE.BoxGeometry(6, 0.5, 0.3), glow(0xff2040), 0, 0.3, 7.6);
  add(g, new THREE.BoxGeometry(6, 0.5, 0.3), glow(0xffffff), 0, 0.3, -7.6);
  scene.add(g); return { g, under, yaw: 0, speed: 0, vy: 0 };
}
const hovers = [];
const parkAt = (x, z, yaw) => { const h = makeHover(pick([0xff3c8c, 0x2ad4ff, 0xf6f6f6, 0x8a5cff, 0xffc23c])); h.g.position.set(x, 2.5, z); h.yaw = yaw; hovers.push(h); };
for (const s of Object.values(SITES)) parkAt(s.x + (s.i === undefined ? -20 : 33), s.z + 12, 0);
for (let k = 0; k < 14; k++) parkAt(-HALF + ((rnd(N) | 0) + 1) * BLOCK - 7, lotC(rnd(N) | 0) + rnd(-15, 15), 0);

// ---------- rifts ----------
const rifts = [[-HALF + 4 * BLOCK, 0, -HALF + 6 * BLOCK], [-HALF + 9 * BLOCK, 0, -HALF + 12 * BLOCK], [-HALF + 12 * BLOCK, 0, -HALF + 2 * BLOCK], [-HALF + 2 * BLOCK, 160, -HALF + 2 * BLOCK]].map(([x, y, z], k) => {
  const g = new THREE.Group(); g.position.set(x, y + 12, z);
  const col = UNI[k].neon[0];
  add(g, new THREE.TorusGeometry(11, 1.1, 10, 48), glow(col));
  add(g, new THREE.CircleGeometry(10.5, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  add(g, new THREE.TorusGeometry(7, 0.3, 6, 40), glow(UNI[k].neon[1]));
  scene.add(g); return { g, k };
});

// ---------- events: the day from story.js, placed on the map ----------
const SITE_OF = { wake: 'home', ready: 'home', commute: 'sky', code: 'office', meet: 'office', lunch: 'cafe', build: 'office', home: 'home', family: 'beach', hobby: 'lab', sleep: 'home' };
const START_HOUR = 6.25;
let EV = [];
const resetEvents = () => { EV = CHAPTERS.map((c, k) => ({ id: c.id, title: c.title, text: c.text, hour: c.hour, end: CHAPTERS[k + 1]?.hour ?? 24, site: SITES[SITE_OF[c.id]], status: 'pending' })); };
resetEvents();
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 900, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scene.add(beacon);

// ---------- player ----------
const P = { pos: new THREE.Vector3(SITES.home.x + 10, 0, SITES.home.z + 30), vel: new THREE.Vector3(), yaw: 0, pitch: 0, ground: true, car: null, chase: false, lookYaw: 0 };
let hour = START_HOUR, rate = 2 / 60, day = 1, trail = [], trailT = 0, riftCool = 0, mapBig = false;
const keys = new Set();

function lotAt(x, z) {
  const i = Math.round(x / BLOCK + (N - 1) / 2), j = Math.round(z / BLOCK + (N - 1) / 2);
  return i < 0 || j < 0 || i >= N || j >= N ? null : lots[i * N + j];
}
/** push p (feet position) out of buildings it is below the roof of; returns floor height under p */
function collide(p, r) {
  let floor = 0, hit = false;
  for (const b of lotAt(p.x, p.z) || []) {
    const h = b.fixed ? b.h : b.h * U.hs, dx = p.x - b.x, dz = p.z - b.z;
    const ox = b.hw + r - Math.abs(dx), oz = b.hd + r - Math.abs(dz);
    if (ox <= 0 || oz <= 0) continue;
    if (p.y >= h - 1.5 || (b.deck && p.y >= b.deck)) { floor = Math.max(floor, h); continue; }
    hit = true;
    if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz;
  }
  return { floor, hit };
}

const fwd = y => _p.set(-Math.sin(y), 0, -Math.cos(y));
function stepFoot(dt) {
  const k = c => keys.has(c) ? 1 : 0, f = k('KeyW') - k('KeyS'), s = k('KeyD') - k('KeyA');
  const sp = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 36 : 15;
  const wx = (-Math.sin(P.yaw) * f + Math.cos(P.yaw) * s), wz = (-Math.cos(P.yaw) * f - Math.sin(P.yaw) * s), wl = Math.hypot(wx, wz) || 1;
  const acc = P.ground ? 12 : 2.5;
  P.vel.x = lerp(P.vel.x, wx / wl * sp, Math.min(1, acc * dt));
  P.vel.z = lerp(P.vel.z, wz / wl * sp, Math.min(1, acc * dt));
  if (keys.has('Space') && P.ground) { P.vel.y = 17; P.ground = false; }
  P.vel.y -= U.g * dt;
  P.pos.addScaledVector(P.vel, dt);
  const { floor } = collide(P.pos, 1.4);
  if (P.pos.y <= floor) { P.pos.y = floor; P.vel.y = 0; P.ground = true; } else P.ground = P.pos.y - floor < 0.05;
  P.pos.x = clamp(P.pos.x, -ISLAND + 6, ISLAND - 6); P.pos.z = clamp(P.pos.z, -ISLAND + 6, ISLAND - 6);
  cam.position.set(P.pos.x, P.pos.y + 6 + (P.ground ? Math.sin(performance.now() / 110) * Math.hypot(P.vel.x, P.vel.z) * 0.006 : 0), P.pos.z);
  cam.rotation.set(P.pitch, P.yaw, 0);
}
function stepCar(dt) {
  const c = P.car, k = n => keys.has(n) ? 1 : 0, g = c.g.position;
  const thr = k('KeyW') - k('KeyS'), steer = k('KeyA') - k('KeyD'), boost = keys.has('ShiftLeft') ? 1.8 : 1;
  c.speed += (thr * 90 * boost - c.speed * 0.6) * dt;
  c.yaw += steer * 1.6 * dt * clamp(Math.abs(c.speed) / 30, 0.25, 1) * Math.sign(c.speed || 1);
  c.vy = lerp(c.vy, (k('Space') - k('KeyC')) * 40, Math.min(1, 3 * dt));
  g.addScaledVector(fwd(c.yaw), c.speed * dt); g.y += c.vy * dt;
  const feet = _s.set(g.x, g.y - 1.5, g.z), { floor, hit } = collide(feet, 5);
  g.x = feet.x; g.z = feet.z;
  if (hit) c.speed *= -0.35;
  g.y = clamp(g.y, floor + 2.5, 700);
  g.x = clamp(g.x, -2500, 2500); g.z = clamp(g.z, -2500, 2500);
  c.g.rotation.set(0, c.yaw, 0); c.g.rotateZ(-steer * 0.25 * clamp(c.speed / 80, -1, 1)); c.g.rotateX(c.vy * 0.004);
  P.pos.copy(g);
  P.lookYaw *= 1 - Math.min(1, 1.5 * dt);
  if (P.chase) {
    cam.position.copy(g).addScaledVector(fwd(c.yaw), -32).y += 12;
    cam.lookAt(g.x, g.y + 3, g.z);
  } else {
    cam.position.copy(g).y += 2.4;
    cam.rotation.set(P.pitch, c.yaw + P.lookYaw, 0);
  }
}
function toggleCar() {
  if (P.car) {
    const g = P.car.g.position, side = _p.set(Math.cos(P.car.yaw), 0, -Math.sin(P.car.yaw));
    P.pos.set(g.x + side.x * 9, g.y, g.z + side.z * 9); P.vel.set(0, 0, 0); P.yaw = P.car.yaw;
    P.car.speed = 0; P.car = null; return;
  }
  const near = hovers.map(h => [h, h.g.position.distanceTo(P.pos)]).sort((a, b) => a[1] - b[1])[0];
  if (near && near[1] < 16) { P.car = near[0]; P.pitch = 0; P.lookYaw = 0; }
}

// ---------- universe ----------
function applyUni(k, fx = true) {
  uni = k; U = UNI[k];
  bldMat.wireframe = !!U.wire; layoutBuildings(); colorTraffic();
  groundMat.color.set(U.ground); seaMat.color.set(U.sea); scene.fog.density = U.fog;
  document.documentElement.style.setProperty('--a', '#' + C(U.neon[0]).getHexString());
  document.documentElement.style.setProperty('--b', '#' + C(U.neon[1]).getHexString());
  $('uni').textContent = `◈ ${U.name} · ${U.tag}`;
  if (fx) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = ''; f.style.opacity = 0; }); toast(`UNIVERSE SHIFT`, `${U.name} — gravity ${U.g < 20 ? 'low' : 'normal'}, skyline ×${U.hs}`); }
}

// ---------- sky ----------
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function updateSky() {
  const a = (hour - 6) / 12 * Math.PI, el = Math.sin(a);
  const dayK = THREE.MathUtils.smoothstep(el, -0.12, 0.3), duskK = Math.exp(-((el / 0.2) ** 2));
  tmpA.set(U.night).lerp(tmpB.set(U.day), dayK).lerp(tmpB.set(U.dusk), duskK * 0.65);
  const real = !U.wire;
  sky.visible = real; sunBall.visible = !real; scene.background = real ? null : tmpA; scene.fog.color.copy(tmpA);
  const dir = _p.set(Math.cos(a), el, -0.35).normalize();
  sunBall.position.copy(cam.position).addScaledVector(dir, 2600);
  moonBall.position.copy(cam.position).addScaledVector(dir, -2600);
  sun.position.copy(cam.position).addScaledVector(dir, 500); sun.target.position.copy(cam.position);
  sky.position.copy(cam.position); su.sunPosition.value.copy(dir);
  if (real && (Math.abs(hour - envHour) > 0.25 || envUni !== uni)) {
    envHour = hour; envUni = uni; envSky.material.uniforms.sunPosition.value.copy(dir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) envSky.material.uniforms[k].value = su[k].value;
    envRT?.dispose(); envRT = pmrem.fromScene(envScene); scene.environment = envRT.texture;
  } else if (!real) scene.environment = null;
  sun.shadow.camera.updateProjectionMatrix();
  sun.intensity = 3 * dayK; sun.color.set(0xffffff).lerp(tmpB.set(U.dusk), duskK);
  hemi.intensity = 0.08 + 0.25 * dayK; hemi.color.set(U.day); hemi.groundColor.set(U.neon[0]).multiplyScalar(0.25);
  stars.material.opacity = 1 - dayK; stars.position.copy(cam.position);
  const night = 1 - dayK;
  bldMat.emissiveIntensity = U.wire ? 1.5 : 0.02 + 2.2 * night * night;
  trimMat.color.setScalar(0.08 + 1.1 * night);
  lampHeads.material.color.setScalar(0.2 + night);
  bloom.strength = 0.12 + 0.7 * night; renderer.toneMappingExposure = 0.5 + 0.5 * night;
}

// ---------- events / HUD ----------
const fmt = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor(h % 1 * 60)).padStart(2, '0')}`;
let toastT = 0;
function toast(t, s) { $('toast').innerHTML = `${t}<small>${s}</small>`; $('toast').style.opacity = 1; toastT = 3.2; }
const activeEvent = () => EV.find(e => e.status === 'pending' && hour < e.end);
function updateEvents() {
  for (const e of EV) if (e.status === 'pending' && hour >= e.end) e.status = 'missed';
  const e = activeEvent();
  if (e && hour >= e.hour && Math.hypot(P.pos.x - e.site.x, P.pos.z - e.site.z) < 40) {
    e.status = 'done'; e.at = hour; toast(`✓ ${e.title}`, e.text);
  }
  if (hour >= 24) {
    const done = EV.filter(x => x.status === 'done').length;
    toast(`DAY ${day} COMPLETE`, `${done}/${EV.length} events lived. A new day begins.`);
    day++; hour = START_HOUR; trail = []; resetEvents();
  }
}
let logKey = '';
function updateHud() {
  $('clock').textContent = fmt(hour);
  $('day').textContent = `Day ${day} · ×${Math.round(rate * 60 * 60)} time`;
  const e = activeEvent();
  if (e) {
    const s = e.site, dx = s.x - P.pos.x, dz = s.z - P.pos.z, dist = Math.hypot(dx, dz);
    const view = P.car ? P.car.yaw + P.lookYaw : P.yaw;
    const rel = Math.atan2(dx, -dz) + view;
    const soon = hour < e.hour ? `starts ${fmt(e.hour)}` : `until ${fmt(e.end)}`;
    $('obj').innerHTML = `<span id="arrow" style="transform:rotate(${rel}rad)">▲</span> <b>${e.title}</b> — ${s.name} · ${Math.round(dist)} ft<br><small>${soon}</small>`;
    beacon.position.set(s.x, 450, s.z); beacon.material.color.set(s.col); beacon.visible = true;
  } else { $('obj').innerHTML = 'Night. Free roam until the next day.'; beacon.visible = false; }
  const key = EV.map(x => x.status).join() + (e && e.id);
  if (key !== logKey) {
    logKey = key;
    $('logList').innerHTML = EV.map(x => `<li class="${x === e ? 'now' : x.status}"><span>${fmt(x.hour)}</span><span>${x.status === 'done' ? '✓' : x.status === 'missed' ? '✗' : x === e ? '▶' : '·'}</span><span>${x.title}${x.at ? ` <small>@${fmt(x.at)}</small>` : ''}</span></li>`).join('');
  }
  const near = !P.car && hovers.some(h => h.g.position.distanceTo(P.pos) < 16);
  $('prompt').textContent = P.car ? '' : near ? 'F — enter hovercar' : '';
  $('speed').style.display = P.car ? 'block' : 'none';
  if (P.car) $('speed').innerHTML = `${Math.abs(Math.round(P.car.speed * 0.68))}<small>MPH · ALT ${Math.round(P.car.g.position.y)} FT</small>`;
}
const mctx = $('map').getContext('2d');
function drawMap() {
  const W = 440, sc = W / (ISLAND * 2), m = v => (v + ISLAND) * sc;
  mctx.fillStyle = '#' + C(U.sea).getHexString(); mctx.fillRect(0, 0, W, W);
  mctx.globalAlpha = 0.9; mctx.drawImage(gcan, 0, 0, W, W); mctx.globalAlpha = 1;
  mctx.lineWidth = 3;
  for (let k = 1; k < trail.length; k++) {
    const [ax, az] = trail[k - 1], [bx, bz, h] = trail[k];
    if (Math.hypot(bx - ax, bz - az) > 200) continue;
    mctx.strokeStyle = `hsl(${(h / 24) * 360 + 200},100%,60%)`;
    mctx.beginPath(); mctx.moveTo(m(ax), m(az)); mctx.lineTo(m(bx), m(bz)); mctx.stroke();
  }
  for (const r of rifts) { mctx.strokeStyle = '#' + C(UNI[r.k].neon[0]).getHexString(); mctx.beginPath(); mctx.arc(m(r.g.position.x), m(r.g.position.z), 6, 0, 7); mctx.stroke(); }
  mctx.fillStyle = '#9ff'; for (const h of hovers) if (h !== P.car) mctx.fillRect(m(h.g.position.x) - 2, m(h.g.position.z) - 2, 4, 4);
  const e = activeEvent(), pulse = 7 + Math.sin(performance.now() / 200) * 3;
  mctx.font = '600 13px Chakra Petch, sans-serif'; mctx.textAlign = 'center';
  for (const s of Object.values(SITES)) {
    const on = e && e.site === s;
    mctx.fillStyle = s.col; mctx.beginPath(); mctx.arc(m(s.x), m(s.z), on ? pulse : 5, 0, 7); mctx.fill();
    if (mapBig || on) { mctx.fillStyle = '#fff'; mctx.fillText(s.name, m(s.x), m(s.z) - 12); }
  }
  const view = P.car ? P.car.yaw + P.lookYaw : P.yaw;
  mctx.save(); mctx.translate(m(P.pos.x), m(P.pos.z)); mctx.rotate(-view);
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -11); mctx.lineTo(7, 8); mctx.lineTo(-7, 8); mctx.fill(); mctx.restore();
}

// ---------- input ----------
const start = $('start');
start.addEventListener('click', () => canvas.requestPointerLock());
canvas.addEventListener('click', () => canvas.requestPointerLock());
let paused = true;
document.addEventListener('pointerlockchange', () => { paused = document.pointerLockElement !== canvas; start.classList.toggle('hidden', !paused); if (paused) keys.clear(); });
addEventListener('mousemove', e => {
  if (paused) return;
  if (P.car) P.lookYaw = clamp(P.lookYaw - e.movementX * 0.0022, -1.6, 1.6); else P.yaw -= e.movementX * 0.0022;
  P.pitch = clamp(P.pitch - e.movementY * 0.0022, -1.45, 1.45);
});
addEventListener('keydown', e => {
  if (paused) return;
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyF') toggleCar();
  if (e.code === 'KeyV') P.chase = !P.chase;
  if (e.code === 'KeyM') { mapBig = !mapBig; $('map').classList.toggle('big', mapBig); }
  if (e.code === 'BracketRight') rate = Math.min(rate * 2, 2);
  if (e.code === 'BracketLeft') rate = Math.max(rate / 2, 1 / 240);
  if (e.code === 'KeyU') applyUni((uni + 1) % UNI.length);
});
addEventListener('keyup', e => keys.delete(e.code));

// ---------- loop ----------
applyUni(0, false);
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!paused) {
    hour += rate * dt;
    if (P.car) stepCar(dt); else stepFoot(dt);
    trailT -= dt;
    if (trailT <= 0) { trailT = 0.5; trail.push([P.pos.x, P.pos.z, hour]); if (trail.length > 4000) trail.shift(); }
    riftCool -= dt;
    for (const r of rifts) {
      if (riftCool <= 0 && r.k !== uni && r.g.position.distanceTo(cam.position) < 11) { riftCool = 3; applyUni(r.k); }
    }
    updateEvents();
  } else if (!P.car) stepFoot(0);
  else stepCar(0);
  for (const r of rifts) { r.g.rotation.y = t * 0.6; r.g.children[2].rotation.z = t * 2; r.g.visible = r.k !== uni; }
  for (const n of landmarkNeon) if (n.userData.spin) n.rotation.set(t, t * 0.7, 0);
  for (const h of hovers) { h.under.material.color.setHSL((t * 0.1 + h.g.position.x * 0.001) % 1, 1, 0.55); if (h !== P.car) h.g.position.y = 2.5 + Math.sin(t * 2 + h.g.position.x) * 0.3; }
  updateTraffic(paused ? 0 : dt);
  updateSky();
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  updateHud(); drawMap();
  composer.render();
  requestAnimationFrame(frame);
}
P.yaw = Math.PI * 0.75;
frame();
window.__city = { P, get hour() { return hour; }, set hour(v) { hour = v; }, applyUni, EV, scene, cam };
