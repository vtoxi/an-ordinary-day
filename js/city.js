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
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { carParts, trafficGeo, wheelGeos, plateTex, colorize, bikeGeo, qingqiGeo, rickGeo, vanGeo, truckGeo, cartGeo } from './cars.js?v=7';
import { Particles, Blood } from './fx.js?v=7';

const $ = id => document.getElementById(id);
const WV = 2;   // bump when world/ is re-baked (the CDN caches static files)
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const LAT0 = 33.65, LON0 = 73.06, CH = 1000, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const ll = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const BOUNDS = { x0: ll(0, 72.86)[0], x1: ll(0, 73.26)[0], z0: ll(33.80, 0)[1], z1: ll(33.50, 0)[1] };
const hash = n => { n = Math.sin(n * 127.1) * 43758.5453; return n - Math.floor(n); };

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const TOUCH = matchMedia('(pointer: coarse)').matches;
let qLevel = TOUCH ? 1 : 2; try { const v = localStorage.getItem('q'); if (v !== null) qLevel = clamp(+v, 0, 2); } catch (e) {}
const PR_CAP = [0.8, 1.1, 1.5];
let pr = Math.min(devicePixelRatio, PR_CAP[qLevel]);
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb0c8e0, 0.00032);
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.4, 40000);
cam.rotation.order = 'YXZ';
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: TOUCH ? 0 : 2 }));
composer.addPass(new RenderPass(scene, cam));
const gtao = new GTAOPass(scene, cam, innerWidth, innerHeight); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.9; gtao.enabled = false;
gtao.updateGtaoMaterial({ radius: 2.5, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 }); composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.4, 0.88);
composer.addPass(bloom); composer.addPass(new OutputPass());
const grade = new ShaderPass({   // final grade: vignette, speed blur, damage tint, death desaturation, film grain
  uniforms: { tDiffuse: { value: null }, spd: { value: 0 }, hurt: { value: 0 }, gray: { value: 0 }, t: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float spd, hurt, gray, t; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + t) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r = length(d), k = spd * 0.07 * smoothstep(0.12, 0.85, r); vec3 c = vec3(0.0);
      for (int i = 0; i < 6; i++) c += texture2D(tDiffuse, vUv - d * k * float(i) / 5.0).rgb;
      c /= 6.0;
      c *= 1.0 - smoothstep(0.38, 1.0, r) * (0.32 + hurt * 0.5);
      c = mix(c, c * vec3(1.0, 0.3, 0.28), hurt * smoothstep(0.25, 0.95, r));
      c = (c - 0.5) * 1.05 + 0.5; c += (h(vUv * 900.0) - 0.5) * 0.018;
      c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))) * 0.8, gray);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ---------- sky + light ----------
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6b6a58, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.4;
Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 1500 });
const moon = new THREE.DirectionalLight(0x9db4ff, 0); scene.add(moon, moon.target);
const sky = new Sky(); sky.scale.setScalar(30000); scene.add(sky);
const su = sky.material.uniforms; su.turbidity.value = 3; su.rayleigh.value = 2; su.mieCoefficient.value = 0.002; su.mieDirectionalG.value = 0.8;
const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
envSky.material.uniforms.turbidity.value = 3;
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
for (const m of [roadMat, greenMat]) { m.roughness = 1; m.envMapIntensity = 0.05; }
const zoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -0.5, polygonOffsetUnits: -0.5 });
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a5878, roughness: 0.08, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 });

// ---------- geometry builders ----------
const ROAD_W = [16, 14, 11, 8, 6, 5], ROAD_C = [[.09, .09, .1], [.1, .1, .11], [.11, .11, .12], [.13, .13, .14], [.16, .155, .15], [.1, .22, .34]];
function ribbon(P, w, y, col, out, Y) {
  const n = P.length / 2; if (n < 2) return;
  const nx = [], nz = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const dx = P[b * 2] - P[a * 2], dz = P[b * 2 + 1] - P[a * 2 + 1], l = Math.hypot(dx, dz) || 1; nx.push(-dz / l); nz.push(dx / l);
  }
  const base = out.pos.length / 3;
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) { out.pos.push(P[i * 2] + nx[i] * w / 2 * s, y + (Y ? Y[i] : 0), P[i * 2 + 1] + nz[i] * w / 2 * s); out.col.push(...col); }
  for (let i = 0; i < n - 1; i++) { const a = base + i * 2; out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
// ---------- flyovers (OSM bridge=yes ways, ramped) and underpass tunnels ----------
const bridgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
const CONC = [.56, .55, .52], CONC2 = [.36, .35, .34];
function edgePts(P, w) {
  const n = P.length / 2, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = P[b * 2] - P[a * 2], dz = P[b * 2 + 1] - P[a * 2 + 1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    L.push([P[i * 2] - nx * w / 2, P[i * 2 + 1] - nz * w / 2]); R.push([P[i * 2] + nx * w / 2, P[i * 2 + 1] + nz * w / 2]);
  }
  return { L, R };
}
function strip(A, B, col, out) {
  const base = out.pos.length / 3;
  for (let i = 0; i < A.length; i++) { out.pos.push(...A[i], ...B[i]); out.col.push(...col, ...col); }
  for (let i = 0; i < A.length - 1; i++) { const a = base + i * 2; out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
function addBox(out, x, y0, y1, z, hx, hz, ang, col) {
  const g = new THREE.BoxGeometry(hx * 2, y1 - y0, hz * 2).rotateY(ang).translate(x, (y0 + y1) / 2, z), base = out.pos.length / 3, p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) { out.pos.push(p[i], p[i + 1], p[i + 2]); out.col.push(...col); }
  for (const i of g.index.array) out.idx.push(base + i);
  g.dispose();
}
function bridgeGeo(P, Y, w, out) {
  const o = edgePts(P, w + 0.8), inn = edgePts(P, w - 0.1), lift = (E, dy) => E.map((q, i) => [q[0], Y[i] + 0.14 + dy, q[1]]);
  strip(lift(o.L, -1), lift(o.R, -1), CONC2, out);
  for (const s of ['L', 'R']) { strip(lift(o[s], -1), lift(o[s], 0.95), CONC, out); strip(lift(inn[s], 0), lift(inn[s], 0.95), CONC2, out); }
  let acc = 14;
  for (let i = 0; i < P.length / 2 - 1; i++) {                       // piers + cross-beams every ~26 m where the deck is clearly above the ground
    const dx = P[i * 2 + 2] - P[i * 2], dz = P[i * 2 + 3] - P[i * 2 + 1]; acc += Math.hypot(dx, dz);
    if (acc < 26 || Y[i] < 2.2) continue; acc = 0;
    const ang = Math.atan2(-dx, -dz);
    addBox(out, P[i * 2], 0, Y[i] - 1, P[i * 2 + 1], 0.75, 0.75, ang, CONC);
    addBox(out, P[i * 2], Y[i] - 1.7, Y[i] - 0.95, P[i * 2 + 1], w * 0.42, 0.9, ang, CONC);
  }
}
function tunnelGeo(P, w, out) {
  const o = edgePts(P, w + 2.4), lift = (E, y) => E.map(q => [q[0], y, q[1]]);
  strip(lift(o.L, 5.6), lift(o.R, 5.6), CONC2, out); strip(lift(o.L, 5.0), lift(o.R, 5.0), [.18, .18, .19], out);
  for (const s of ['L', 'R']) strip(lift(o[s], 0), lift(o[s], 5.6), CONC, out);
}
/** road-name boards and shop / brand signs (canvas textures, cached) */
const BRANDS = [['kfc', '#e4002b', '#fff'], ['mcdonald', '#da291c', '#ffc72c'], ['pizza hut', '#ee3124', '#fff'], ['subway', '#009743', '#ffc600'], ['hardee', '#ffd100', '#c8102e'], ['domino', '#006491', '#fff'], ['burger king', '#d62300', '#fff'], ['starbucks', '#00704a', '#fff'], ['gloria', '#6b2d1a', '#fff'], ['dunkin', '#ff671f', '#ff1493'], ['nando', '#e4002b', '#fff'], ['tgi', '#d52b1e', '#fff'], ['habib', '#00873c', '#fff'], ['hbl', '#00873c', '#fff'], ['ubl', '#0b5ea8', '#fff'], ['united bank', '#0b5ea8', '#fff'], ['mcb', '#d71920', '#fff'], ['allied', '#00539f', '#fff'], ['meezan', '#6f2c91', '#fff'], ['alfalah', '#c8102e', '#fff'], ['askari', '#0a5c36', '#fff'], ['faysal', '#0a4d8c', '#fff'], ['shell', '#fbce07', '#dd1d21'], ['pso', '#00833e', '#fff'], ['total', '#e30613', '#fff'], ['caltex', '#e2231a', '#fff'], ['attock', '#0057a8', '#fff'], ['hascol', '#00a859', '#fff'], ['apple', '#222', '#fff'], ['bata', '#d71920', '#fff'], ['khaadi', '#222', '#fff'], ['sapphire', '#2b2b2b', '#fff'], ['agha noor', '#222', '#f2c230']];
const KINDS = { restaurant: ['#b5361a', '🍽️'], fast_food: ['#d62300', '🍔'], cafe: ['#6b4226', '☕'], ice_cream: ['#e86fa0', '🍦'], food_court: ['#b5361a', '🍽️'], bank: ['#1a4f9c', '🏦'], pharmacy: ['#1aa56b', '💊'], hospital: ['#d62839', '🏥'], clinic: ['#d62839', '🏥'], fuel: ['#e85d04', '⛽'], school: ['#2a6fd0', '🎓'], college: ['#2a6fd0', '🎓'], university: ['#2a6fd0', '🎓'], place_of_worship: ['#0f6b3a', '🕌'], shop: ['#6b4fb5', '🛍️'], hotel: ['#7a4a9c', '🏨'], guest_house: ['#7a4a9c', '🛏️'], hostel: ['#7a4a9c', '🛏️'], police: ['#1b3a6b', '👮'], cinema: ['#8a1c5c', '🎬'], marketplace: ['#a0661c', '🏪'] };
const signMats = new Map();
function signMat(s) {
  const key = s.kind + '|' + s.t + '|' + (s.b || '') + '|' + (s.k || '');
  let m = signMats.get(key); if (m) return m;
  const c = document.createElement('canvas'), W = 512, H = s.kind === 'road' ? 112 : 128; c.width = W; c.height = H; const x = c.getContext('2d');
  const rr = r => { x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, r); };
  let bg, fg = '#fff', icon = '';
  if (s.kind === 'road') bg = '#17603e';
  else {
    const hay = ((s.b || '') + ' ' + s.t).toLowerCase(), br = BRANDS.find(q => hay.includes(q[0])), kd = KINDS[s.k] || ['#334455', '📍'];
    bg = br ? br[1] : kd[0]; fg = br ? br[2] : '#fff'; icon = kd[1];
  }
  rr(22); x.fillStyle = bg; x.fill(); x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,.88)'; rr(22); x.stroke();
  let tx = W / 2, maxW = W - 50;
  if (icon) { x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(66, H / 2, 44, 0, 7); x.fill(); x.font = '54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000'; x.fillText(icon, 66, H / 2 + 4); tx = 124 + (W - 124 - 20) / 2; maxW = W - 124 - 30; }
  let px = s.kind === 'road' ? 52 : 50; x.font = `700 ${px}px "Chakra Petch", Arial, sans-serif`;
  while (x.measureText(s.t).width > maxW && px > 18) { px -= 2; x.font = `700 ${px}px "Chakra Petch", Arial, sans-serif`; }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s.t, tx, H / 2 + 3);
  if (s.kind === 'road' && s.s) { x.font = '600 20px Arial'; x.fillStyle = '#d8f5e4'; x.textAlign = 'right'; x.fillText(s.s + ' km/h', W - 24, H - 16); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  m = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }); signMats.set(key, m); return m;
}
function makeSign(s) {
  const sp = new THREE.Sprite(signMat(s)), w = s.kind === "road" ? 10 : 15;
  sp.scale.set(w, w * (s.kind === 'road' ? 0.22 : 0.25), 1); sp.position.set(s.x, s.y, s.z); sp.userData = { x: s.x, z: s.z, far: s.kind === 'road' ? 150 : 230 }; sp.visible = false; return sp;
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
const have = new Set(), loaded = new Map(), loading = new Set(), runs = [], elev = [];
const ck = (x, z) => [Math.floor(x / CH), Math.floor(z / CH)], kk = (i, j) => i + ',' + j;
async function loadChunk(i, j) {
  const key = kk(i, j); loading.add(key);
  try {
    const d = await (await fetch(`world/c_${i}_${j}.json?v=${WV}`)).json();
    const g = new THREE.Group(), rd = blank(), gr = blank(), wt = blank(), bl = blank(), zn = blank(), br = blank(), mine = [], signs = [], lastName = new Map();
    for (const r of d.roads) {
      if (r.c === 5) { ribbon(r.p, 6, 0.1, ROAD_C[5], rd); continue; }
      const w = r.w || ROAD_W[r.c], Y = r.y;
      if (Y) {
        ribbon(r.p, w, 0.14, ROAD_C[r.c], rd, Y);
        if (!r.o && w >= 6) ribbon(r.p, 0.16, 0.16, [.78, .75, .55], rd, Y);
        bridgeGeo(r.p, Y, w, br);
      } else {
        if (r.c >= 1) ribbon(r.p, w + 3.6, 0.07, [.3, .29, .27], rd);                           // pavement
        ribbon(r.p, w, 0.14 - r.c * 0.012, ROAD_C[r.c], rd);
        if (!r.o && w >= 6) ribbon(r.p, 0.16, 0.16, [.78, .75, .55], rd);                       // centre line on two-way roads
        else if (r.o && w >= 7.5) { ribbon(r.p, 0.12, 0.16, [.55, .55, .55], rd); }             // lane divider on wide one-way carriageways
        if (r.t) tunnelGeo(r.p, w, br);
      }
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let q = 0; q < r.p.length; q += 2) { x0 = Math.min(x0, r.p[q]); x1 = Math.max(x1, r.p[q]); z0 = Math.min(z0, r.p[q + 1]); z1 = Math.max(z1, r.p[q + 1]); }
      if (r.c <= 4) mine.push({ c: r.c, p: r.p, w, o: r.o, n: r.n, s: r.s, y: Y, t: r.t, x0: x0 - 25, x1: x1 + 25, z0: z0 - 25, z1: z1 + 25 });
      if (r.n && r.c <= 3 && !r.t && Math.hypot(x1 - x0, z1 - z0) > 60 && signs.length < 40) {     // road-name board on the verge, one per name per ~250 m
        const m = (r.p.length / 4 | 0) * 2, dx = r.p[m + 2] - r.p[m], dz = r.p[m + 3] - r.p[m + 1], l = Math.hypot(dx, dz) || 1, off = w / 2 + 2.8, last = lastName.get(r.n);
        const sx = r.p[m] + dz / l * off, sz = r.p[m + 1] - dx / l * off;
        if (!last || Math.hypot(last[0] - sx, last[1] - sz) > 250) { lastName.set(r.n, [sx, sz]); signs.push({ kind: 'road', t: r.n, s: r.s, x: sx, z: sz, y: (Y ? Y[m / 2] : 0) + 4.6 }); }
      }
    }
    for (const q of d.poi || []) signs.push({ kind: 'poi', t: q.n, b: q.b, k: q.k, x: q.x, z: q.z, y: 7 });
    for (const a of d.zone || []) fillPoly(a.p, 0.03, zn, ZONE_C[a.u]);
    for (const a of d.green) fillPoly(a.p, 0.05, gr);
    for (const a of d.water) fillPoly(a.p, 0.07, wt);
    buildingGeo(d.bld, bl);
    const props = decorChunk(d.roads, g, d.green);
    for (const [o, mat, sh] of [[zn, zoneMat], [rd, roadMat], [gr, greenMat], [wt, waterMat], [bl, bldMat, true], [br, bridgeMat, true]]) { const m = mkMesh(o, mat, sh); if (m) g.add(m); }
    const sprites = signs.map(makeSign); for (const s of sprites) g.add(s);
    const col = d.bld.map(b => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let q = 0; q < b.p.length; q += 2) { x0 = Math.min(x0, b.p[q]); x1 = Math.max(x1, b.p[q]); z0 = Math.min(z0, b.p[q + 1]); z1 = Math.max(z1, b.p[q + 1]); } return { p: b.p, x0, x1, z0, z1 }; });
    for (const e of EXTRA) { const [ei, ej] = ck(e.cx, e.cz); if (ei === i && ej === j) col.push(e); }
    scene.add(g); loaded.set(key, { g, col, props, sprites, i, j });
    for (const r of mine) { runs.push({ ...r, key }); if (r.y) elev.push({ ...r, key }); }
  } catch (e) { console.warn('chunk', key, e); } finally { loading.delete(key); }
}
function streamChunks() {
  const [ci, cj] = ck(P.pos.x, P.pos.z), R = P.car ? 3 : 2;
  for (const [key, c] of loaded) if (Math.abs(c.i - ci) > R + 1 || Math.abs(c.j - cj) > R + 1) {
    scene.remove(c.g); c.g.traverse(o => { if (!o.isInstancedMesh && !o.isSprite) o.geometry?.dispose(); }); loaded.delete(key);
    for (let k = runs.length - 1; k >= 0; k--) if (runs[k].key === key) runs.splice(k, 1);
    for (let k = elev.length - 1; k >= 0; k--) if (elev[k].key === key) elev.splice(k, 1);
    for (const p of c.props) if (p.st === 1) falling.splice(falling.indexOf(p), 1);
  }
  if (loading.size >= (P.car ? 3 : 2)) return;
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

// ---------- vertical surfaces (flyovers) + roadside props (trees, lamps) that can fall ----------
/** height of the road surface under (x,z) that a body at height cy can stand on: bridges only count if you are on / next to them */
function surfaceY(x, z, cy) {
  let best = 0;
  for (const r of elev) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    const p = r.p, hw = r.w / 2 + 0.3;
    for (let k = 0; k < p.length - 2; k += 2) {
      const ex = p[k + 2] - p[k], ez = p[k + 3] - p[k + 1], u = clamp(((x - p[k]) * ex + (z - p[k + 1]) * ez) / (ex * ex + ez * ez || 1), 0, 1), dx = x - p[k] - ex * u, dz = z - p[k + 1] - ez * u;
      if (dx * dx + dz * dz < hw * hw) { const y = lerp(r.y[k / 2], r.y[k / 2 + 1], u); if (y <= cy + 1.3 && y > best) best = y; }
    }
  }
  return best;
}
const falling = [], _qa = new THREE.Quaternion(), _ax = new THREE.Vector3();
function setProp(p, ang) {
  _tq.setFromEuler(_te.set(0, p.rot, 0));
  if (ang) { _ax.set(p.dz, 0, -p.dx); _qa.setFromAxisAngle(_ax, ang); _tq.premultiply(_qa); }
  p.im.setMatrixAt(p.i, _tm.compose(_tp.set(p.x, 0, p.z), _tq, _ts.set(p.sc, p.sc, p.sc))); p.im.instanceMatrix.needsUpdate = true; _ts.set(1, 1, 1);
}
function collideProps(pos, r, onHit) {
  const [i0, j0] = ck(pos.x - r - 1, pos.z - r - 1), [i1, j1] = ck(pos.x + r + 1, pos.z + r + 1);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const c = loaded.get(kk(i, j)); if (!c) continue;
    for (const p of c.props) {
      if (p.st) continue;
      const dx = pos.x - p.x, dz = pos.z - p.z, rr = r + p.r; if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
      const d = Math.hypot(dx, dz); if (d >= rr) continue;
      const push = (rr - d) / (d || 1); pos.x += dx * push; pos.z += dz * push; if (onHit) onHit(p);
    }
  }
}
function topple(p, dx, dz) {
  const l = Math.hypot(dx, dz) || 1; p.st = 1; p.t = 0; p.dx = dx / l; p.dz = dz / l; falling.push(p);
  fx.burst(p.kind ? 6 : 16, { x: p.x, y: p.kind ? 6 : 4, z: p.z, life: 1.4, size: p.kind ? 0.1 : 0.4, grow: 0.3, grav: p.kind ? 9 : 2, drag: 0.8, col: p.kind ? [3, 2, .6] : [.15, .38, .08], add: !!p.kind }, 3);
}
function stepFalling(dt) {
  for (let k = falling.length - 1; k >= 0; k--) {
    const p = falling[k]; p.t += dt; const u = Math.min(1, p.t / (p.kind ? 0.8 : 1.1)); setProp(p, 1.5 * u * u);
    if (u < 1) continue;
    falling.splice(k, 1); p.st = 2;
    const h = (p.kind ? 7 : 4.6) * p.sc, lx = p.x + p.dx * h * 0.55, lz = p.z + p.dz * h * 0.55;
    if (AU.ctx) thud(0.5, p.kind ? 900 : 300, 0.35);
    fx.burst(p.kind ? 8 : 24, { x: lx, y: 0.5, z: lz, life: 1.6, size: p.kind ? 0.15 : 0.5, grow: 1, grav: 1, drag: 1, col: p.kind ? [.5, .5, .5] : [.2, .42, .1], a: 0.8 }, 2.5);
    if (Math.hypot(myCar.g.position.x - lx, myCar.g.position.z - lz) < 2.6 * p.sc + 1.3 && !myCar.exploded) treeHit(p);
  }
}
function treeHit(p) {   // the toppled tree lands on the car
  const c = myCar, dmg = p.kind ? 10 : 18 + 10 * p.sc; c.hp = Math.max(0, c.hp - dmg); shake = Math.min(2, shake + 0.8);
  dentCar(c, 0, -0.8, 0.5, 0, 0.6); CM.glass.roughness = 0.5; CM.glass.color.set(0x5a6670);
  fx.burst(18, { x: c.g.position.x, y: c.g.position.y + 1.3, z: c.g.position.z, vy: 2, life: 1.4, size: 0.06, grav: 9, drag: 0.4, col: [.8, .95, 1] }, 3);
  if (P.car) { P.hp = Math.max(0, P.hp - dmg * 0.4); if (P.hp <= 0) wasted(); }
  toast(p.kind ? 'Lamp post fell' : 'Tree fell on the car', `car ${Math.round(c.hp)}%`);
}

// ---------- player + car ----------
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, ground: true, car: null, chase: false, lookYaw: 0, hp: 100 };
/** extrude a side profile (x = along the car, rear positive; y = height) across `width`, centred on x=0 */
function sideProfile(pts, width) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); return g;
}
const SEDAN = [[-2.25, 0.4], [-2.25, 0.76], [-1.55, 0.92], [-0.6, 1.02], [0.22, 1.43], [0.98, 1.43], [1.55, 1.02], [2.25, 0.98], [2.25, 0.4]];
const SEDAN_GLASS = [[-0.5, 1.03], [0.2, 1.38], [0.98, 1.38], [1.45, 1.03]];
// ---------- game state, effects ----------
const fx = new Particles(scene), blood = new Blood($('blood'), $('wiper'));
let money = 500, wanted = 0, wantedT = 0, dead = 0, deadT = 0, shake = 0, crashCd = 0, flashT = 0, bigT = 0;
const JOY = { x: 0, y: 0 }, keys = new Set();
const fwd = (y, o = new THREE.Vector3()) => o.set(-Math.sin(y), 0, -Math.cos(y));
const _f = new THREE.Vector3(), _p = new THREE.Vector3(), _b = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3(), chaseP = new THREE.Vector3(), _col = new THREE.Color();
let chaseOn = false;
function big(t, s = '', cls = '') { const e = $('big'); e.className = 'hud ' + cls; e.innerHTML = `${t}<small>${s}</small>`; e.style.opacity = 1; bigT = dead ? 99 : 2.8; }
function addWanted(n) { const w = Math.min(5, wanted + n); if (w > wanted) toast('🚨 WANTED', '★'.repeat(w) + '☆'.repeat(5 - w)); wanted = w; wantedT = 0; }
function wasted(kind = 'WASTED') { if (dead) return; dead = kind; deadT = 0; keys.clear(); JOY.x = JOY.y = 0; big(kind, kind === 'WASTED' ? 'You were killed' : 'The police caught you', 'bad'); }
function respawn() {
  const busted = dead === 'BUSTED'; money = Math.floor(money * (busted ? 0.9 : 0.8)); dead = 0; P.hp = 100; wanted = 0; grade.uniforms.gray.value = 0; $('big').style.opacity = 0; bigT = 0;
  for (const k of cops) { k.on = false; k.g.visible = false; }
  teleport(busted ? 'faiz' : 'home'); myCar.build('peugeot', 0xf6f6f2); P.car = null; blood.cover = 0;
  toast(busted ? 'Released' : 'Recovered', busted ? 'You paid a fine. Stay out of trouble.' : 'You woke up at home. The car was repaired.');
}

// ---------- the player's car: lofted body, rim wheels, glass, lights; crumples where it is hit ----------
const CM = {
  paint: new THREE.MeshPhysicalMaterial({ color: 0xf0f0f0, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.06, vertexColors: true }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0c141c, roughness: 0.04, metalness: 0.9 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x0e0e0f, roughness: 0.8 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.18, metalness: 1 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0.6, roughness: 0.1 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x990000, emissive: 0xff1010, emissiveIntensity: 0.5, roughness: 0.2 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xaeb4bc, roughness: 0.25, metalness: 0.95 }),
};
const VMAX = { sedan: 66.7, peugeot: 66.7, hatch: 44, pickup: 53 };     // m/s: the sedan does 240 km/h
function makeCar(style, color) {
  const g = new THREE.Group(), body = new THREE.Group(), cockpit = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(body, cockpit); cockpit.visible = false;
  const c = { g, body, cockpit, yaw: 0, speed: 0, steer: 0, hp: 100, accel: 0, pitch: 0, defs: [], wheels: [], parts: null, style, exploded: false, burn: 0, smokeAcc: 0, braking: false, eyeY: 1.25, vmax: 66.7 };
  const bonnet = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 }), blk = CM.trim;
  const put = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // cockpit view: the body hides, a minimal right-hand-drive interior shows (driver and wheel on the right)
  put(new THREE.BoxGeometry(1.5, 0.2, 0.42), blk, 0, 0.86, -0.62, cockpit);              // dashboard
  put(new THREE.BoxGeometry(1.5, 0.04, 1.5), bonnet, 0, 0.99, -1.55, cockpit);           // bonnet seen through the screen
  const sw = put(new THREE.TorusGeometry(0.17, 0.022, 6, 18), blk, 0.4, 0.98, -0.34, cockpit); sw.rotation.x = -0.9;
  for (const sx of [-1, 1]) { const pil = put(new THREE.BoxGeometry(0.06, 0.62, 0.08), blk, sx * 0.8, 1.2, -0.42, cockpit); pil.rotation.x = -0.45; put(new THREE.BoxGeometry(0.06, 0.06, 1.3), blk, sx * 0.8, 1.42, 0.22, cockpit); }
  put(new THREE.BoxGeometry(1.6, 0.04, 1.3), blk, 0, 1.45, 0.2, cockpit);                 // roof lining
  put(new THREE.BoxGeometry(0.45, 0.5, 0.2), blk, 0.4, 0.62, 0.35, cockpit); put(new THREE.BoxGeometry(0.45, 0.5, 0.2), blk, -0.4, 0.62, 0.35, cockpit);
  c.lights = [-1, 1].map(() => { const l = new THREE.SpotLight(0xfff2d0, 0, 90, 0.5, 0.5, 1.5); g.add(l, l.target); return l; });
  c.build = (st, colr) => {
    c.style = st; c.hp = 100; c.exploded = false; c.burn = 0; c.speed = 0; c.vmax = VMAX[st];
    for (const ch of [...body.children]) { body.remove(ch); ch.geometry?.dispose(); }
    c.defs = []; c.wheels = []; CM.glass.roughness = 0.04; CM.glass.color.set(0x0c141c); CM.paint.color.set(colr); bonnet.color.set(colr);
    const p = c.parts = carParts(st);
    const add = (list, mat) => { for (const geo of list) { if (mat === CM.paint) colorize(geo, [1, 1, 1]); const m = new THREE.Mesh(geo, mat); m.castShadow = true; body.add(m); c.defs.push({ geo, orig: geo.attributes.position.array.slice() }); } };
    add(p.paint, CM.paint); add(p.glass, CM.glass); add(p.trim, CM.trim); add(p.chrome, CM.chrome); add(p.lamp, CM.lamp); add(p.tail, CM.tail);
    for (const [x, y, z, rad, wd] of p.wheels) {
      const steer = new THREE.Group(), spin = new THREE.Group(), { tyre, rim } = wheelGeos(rad, wd); steer.position.set(x, y, z); steer.add(spin);
      const a = new THREE.Mesh(tyre, CM.tyre), b = new THREE.Mesh(rim, CM.rim); a.castShadow = true; spin.add(a, b); body.add(steer); c.wheels.push({ steer, spin, front: z < 0, r: rad, x, z });
    }
    const pm = new THREE.MeshStandardMaterial({ map: st === 'peugeot' ? plateTex('BSK-798', 'PAKISTAN') : plateTex(), roughness: 0.4 });
    for (const [z, ry] of [[p.f - 0.04, Math.PI], [p.r + 0.04, 0]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), pm); m.position.set(0, 0.52, z); m.rotation.y = ry; body.add(m); }
    cockpit.position.set(0, st === 'pickup' ? 0.22 : st === 'hatch' ? 0.04 : st === 'peugeot' ? 0.1 : 0, p.S.cabin[0][0] + 0.75); c.eyeY = 1.25 + cockpit.position.y;
    c.lights.forEach((l, k) => { const sx = k ? 1 : -1; l.position.set(sx * 0.6, 0.8, p.f + 0.3); l.target.position.set(sx * 0.6, 0.2, p.f - 30); });
  };
  c.build(style, color); scene.add(g); return c;
}
const myCar = makeCar('peugeot', 0xf6f6f2);

/** push hull vertices near (lx,lz) (car space, x right / z back) inward along (ix,iz), darken the paint there */
function dentCar(c, lx, lz, amt, ix, iz) {
  const R = 1.6;
  for (const d of c.defs) {
    const a = d.geo.attributes.position, cl = d.geo.attributes.color, o = d.orig;
    for (let k = 0; k < a.count; k++) {
      const x = a.getX(k), y = a.getY(k), z = a.getZ(k), f = Math.max(0, 1 - Math.hypot(x - lx, z - lz, (y - 0.75) * 0.5) / R); if (f <= 0) continue;
      const m = amt * f * f * (0.6 + 0.4 * hash(x * 12.9 + y * 78.2 + z * 37.7));
      let nx = x + ix * m, ny = y - m * 0.12, nz = z + iz * m;
      const ox = o[k * 3], oy = o[k * 3 + 1], oz = o[k * 3 + 2], dd = Math.hypot(nx - ox, ny - oy, nz - oz);
      if (dd > 0.95) { const s = 0.95 / dd; nx = ox + (nx - ox) * s; ny = oy + (ny - oy) * s; nz = oz + (nz - oz) * s; }
      a.setXYZ(k, nx, ny, nz);
      if (cl) { const s = 1 - 0.45 * f; cl.setXYZ(k, cl.getX(k) * s, cl.getY(k) * s, cl.getZ(k) * s); }
    }
    a.needsUpdate = true; if (cl) cl.needsUpdate = true; d.geo.computeVertexNormals(); d.geo.computeBoundingSphere();
  }
}
/** impact of normal speed vn (m/s); (nx,nz) points from the obstacle toward the car */
function crash(vn, nx, nz) {
  const c = myCar; if (crashCd > 0 || vn < 2) return; crashCd = 0.15;
  c.hp = Math.max(0, c.hp - Math.max(0, vn - 3.5) ** 1.55 * 0.42);                           // 20 m/s = -32 %, 30 m/s = -68 %, 40 m/s = dead
  if (P.car) P.hp = Math.max(0, P.hp - Math.max(0, vn - 14) ** 1.45 * 0.9);                  // no seat belt: lethal from ~35 m/s
  shake = Math.min(1.8, shake + vn / 18); flashT = vn > 12 ? Math.min(0.7, vn / 40) : 0;
  const lx = nx * Math.cos(c.yaw) - nz * Math.sin(c.yaw), lz = nx * Math.sin(c.yaw) + nz * Math.cos(c.yaw), ln = Math.hypot(lx, lz) || 1;
  dentCar(c, -lx / ln * c.parts.hw, -lz / ln * c.parts.len / 2, Math.min(0.75, vn * 0.028), lx / ln, lz / ln);
  const wx = c.g.position.x - nx * 1.6, wz = c.g.position.z - nz * 1.6, wy = c.g.position.y + 0.7;
  fx.burst(Math.min(40, 4 + (vn * 1.4 | 0)), { x: wx, y: wy, z: wz, vx: nx * 4, vy: 2, vz: nz * 4, life: 0.5, size: 0.1, grav: 9, drag: 0.8, col: [3, 1.6, 0.5], add: true }, 5);
  fx.burst(Math.min(10, vn / 3 | 0) + 2, { x: wx, y: wy, z: wz, life: 1.6, size: 0.55, grow: 2, grav: -0.3, drag: 1.2, col: [.55, .55, .55], a: 0.5 }, 1.6);
  if (vn > 12) { fx.burst(22, { x: wx, y: wy + 0.4, z: wz, vx: -nx * 3, vy: 2.5, vz: -nz * 3, life: 1.6, size: 0.06, grav: 9, drag: 0.4, col: [.8, .95, 1] }, 4); CM.glass.roughness = 0.55; CM.glass.color.set(0x5a6670); }
  if (AU.ctx) { thud(Math.min(1, 0.3 + vn / 25), 500, 0.35); blip(120 + Math.random() * 60, 0.3, 'sawtooth', 0.12, -80); if (vn > 12) for (let k = 0; k < 3; k++) setTimeout(() => AU.ctx && blip(2500 + Math.random() * 1500, 0.12, 'square', 0.04, -1200), k * 60); }
  toast(vn < 8 ? 'Fender bender' : vn < 18 ? 'Collision' : vn < 30 ? 'Heavy crash' : 'Catastrophic impact', `${Math.round(vn * 3.6)} km/h impact · car ${Math.round(c.hp)}%${P.car ? ' · you ' + Math.round(P.hp) + '%' : ''}`);
  navigator.vibrate?.(Math.min(400, vn * 12));
  if (c.hp <= 0 && !c.exploded) toast('🔥 Engine on fire', 'Get out! It will blow up');
  if (P.hp <= 0) wasted();
}
function explode() {
  const c = myCar, p = c.g.position; c.exploded = true; c.speed = 0; CM.paint.color.set(0x141414);
  fx.burst(70, { x: p.x, y: p.y + 1, z: p.z, vy: 6, life: 1.1, size: 1.4, grow: 5, grav: -2, drag: 1.5, col: [6, 2.4, 0.5], add: true, a: 0.9 }, 7);
  fx.burst(40, { x: p.x, y: p.y + 1.5, z: p.z, vy: 4, life: 5, size: 1.6, grow: 6, grav: -1.2, drag: 0.6, col: [.08, .08, .08], a: 0.8 }, 4);
  fx.burst(50, { x: p.x, y: p.y + 1, z: p.z, vy: 8, life: 1.4, size: 0.12, grav: 9, drag: 0.3, col: [4, 2, 0.6], add: true }, 14);
  if (AU.ctx) { thud(1, 140, 1.2); blip(70, 0.8, 'sawtooth', 0.2, -40); }
  shake = 2.2; flashT = 0.9; toast('💥', 'Your car exploded');
  const d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z);
  if (P.car || d < 9) { P.hp = Math.max(0, P.hp - (P.car ? 200 : (9 - d) * 14)); if (P.hp <= 0) wasted(); }
}
function damageFx(dt) {
  const c = myCar; if (c.hp > 55 && !c.exploded) return;
  const sv = clamp((55 - c.hp) / 55, 0, 1), p = c.g.position; fwd(c.yaw, _f);
  c.smokeAcc += dt * (6 + 26 * sv);
  while (c.smokeAcc > 1) {
    c.smokeAcc--;
    const hx = p.x + _f.x * -c.parts.f * 0.6, hz = p.z + _f.z * -c.parts.f * 0.6;
    fx.emit({ x: hx, y: p.y + 1, z: hz, vx: (Math.random() - 0.5) * 0.6, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 0.6, life: 2.2, size: 0.35, grow: 1.6, grav: -0.5, drag: 0.8, col: c.hp < 25 ? [.05, .05, .05] : [.55, .55, .55], a: 0.55 });
    if (c.hp < 20) fx.emit({ x: hx, y: p.y + 0.9, z: hz, vy: 1.8, life: 0.5, size: 0.4, grow: -0.2, col: [3, 1.1, 0.2], add: true, a: 0.9 });
  }
  if (c.hp <= 0 && !c.exploded) { c.burn += dt / 6; if (c.burn >= 1) explode(); }
}
function animCar(dt) {
  const c = myCar, roll = c.speed * dt;
  for (const w of c.wheels) { w.spin.rotation.x -= roll / w.r; if (w.front) w.steer.rotation.y = c.steer * 0.4; }
  CM.tail.emissiveIntensity = c.braking ? 9 : 0.7;
}
const inp = () => { const k = n => keys.has(n) ? 1 : 0; return { thr: clamp(k('KeyW') - k('KeyS') + JOY.y, -1, 1), str: clamp(k('KeyA') - k('KeyD') - JOY.x, -1, 1) }; };

function stepFoot(dt) {
  const k = n => keys.has(n) ? 1 : 0, f = clamp(k('KeyW') - k('KeyS') + JOY.y, -1, 1), s = clamp(k('KeyD') - k('KeyA') + JOY.x, -1, 1), mag = Math.min(1, Math.hypot(f, s));
  const sp = keys.has('ShiftLeft') ? 8 : 4.2;
  const wx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * s, wz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * s, wl = Math.hypot(wx, wz) || 1, a = Math.min(1, (P.ground ? 10 : 1.5) * dt);
  P.vel.x = lerp(P.vel.x, wx / wl * sp * mag, a); P.vel.z = lerp(P.vel.z, wz / wl * sp * mag, a);
  if (keys.has('Space') && P.ground) { P.vel.y = 4.2; P.ground = false; }
  P.vel.y -= 9.8 * dt; P.pos.addScaledVector(P.vel, dt);
  const gy = surfaceY(P.pos.x, P.pos.z, P.pos.y);
  if (P.pos.y <= gy + 0.05 || (P.ground && P.vel.y <= 0 && P.pos.y - gy < 0.7)) { P.pos.y = gy; P.vel.y = 0; P.ground = true; }
  resolve(P.pos, 0.45); collideProps(P.pos, 0.45);
  const bob = P.ground ? Math.sin(performance.now() / 170) * Math.hypot(P.vel.x, P.vel.z) * 0.012 : 0;
  cam.position.set(P.pos.x, P.pos.y + 1.7 + bob, P.pos.z); cam.rotation.set(P.pitch, P.yaw, 0);
}
function stepCar(dt) {
  const c = myCar, { thr, str } = inp(), alive = c.hp > 0 && !c.exploded, vmax = c.vmax * (c.hp < 30 ? 0.75 : 1), t = alive ? thr : 0, v0 = c.speed, pos = c.g.position;
  const acc = t > 0 ? (c.speed < -0.5 ? 14 : 10.5 * Math.max(0, 1 - (c.speed / (vmax * 1.08)) ** 2)) : t < 0 ? (c.speed > 0.5 ? -16 : -5 * Math.max(0, 1 - (c.speed / -12) ** 2)) : -Math.sign(c.speed) * (Math.abs(c.speed) > 0.6 ? 1.1 : 0);
  c.speed += (acc - Math.sign(c.speed) * (0.3 + 0.00022 * c.speed * c.speed)) * dt;
  const hb = keys.has('Space'); if (hb) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 27 * dt);       // Space = foot brake
  c.speed = clamp(c.speed, -12, vmax); if (!t && Math.abs(c.speed) < 0.3 && !hb) c.speed = 0;
  c.braking = (t < 0 && v0 > 0.5) || (hb && v0 > 0.5);
  c.accel = lerp(c.accel, dt > 0 ? (c.speed - v0) / dt : 0, Math.min(1, 6 * dt));
  c.steer = lerp(c.steer, str, Math.min(1, 6 * dt));
  c.yaw += c.speed / 2.7 * Math.tan(c.steer * 0.5 / (1 + (Math.abs(c.speed) / 10) ** 1.5)) * dt + (hb && Math.abs(c.speed) > 14 && Math.abs(c.steer) > 0.5 ? c.steer * 1.1 * dt * Math.sign(c.speed) : 0);
  if (dt > 0 && ((hb && Math.abs(c.speed) > 10) || (Math.abs(c.steer) > 0.75 && Math.abs(c.speed) > 24))) {          // tyre smoke
    fwd(c.yaw, _f); for (const w of c.wheels) if (!w.front && Math.random() < 0.6) fx.emit({ x: pos.x + _f.x * w.z * -1 + Math.cos(c.yaw) * w.x, y: pos.y + 0.15, z: pos.z + _f.z * w.z * -1 - Math.sin(c.yaw) * w.x, vy: 0.5, life: 1, size: 0.4, grow: 1.8, drag: 1.4, col: [.85, .85, .85], a: 0.35 });
  }
  const n = Math.max(1, Math.ceil(Math.abs(c.speed) * dt / 1.2)), sd = dt / n;
  for (let s = 0; s < n; s++) {
    fwd(c.yaw, _f); pos.addScaledVector(_f, c.speed * sd);
    let ox = 0, oz = 0, prop = null;
    for (const o of [-1.5, 0, 1.5]) {
      _p.copy(pos).addScaledVector(_f, o); const x0 = _p.x, z0 = _p.z;
      resolve(_p, 1.0); collideProps(_p, 1.0, p => { prop = p; });
      pos.x += _p.x - x0; pos.z += _p.z - z0; ox += _p.x - x0; oz += _p.z - z0;
    }
    const dl = Math.hypot(ox, oz);
    if (dl > 0.01) {
      const nx = ox / dl, nz = oz / dl, dn = _f.x * nx + _f.z * nz, vn = -dn * c.speed, sg = Math.sign(c.speed) || 1;
      if (vn > 0.5) {
        const e = vn > 6 ? 0.22 : 0.05; c.speed += dn * vn * (1 + e);                                          // normal component bounces, sliding component stays
        crash(vn, nx, nz); if (vn > 3) c.yaw += (Math.random() - 0.5) * 0.04 * Math.min(vn, 25) / 5;
        if (prop && vn > 11 && !prop.st) topple(prop, _f.x * sg, _f.z * sg);
      }
    }
  }
  for (const a of agents) if (a.on) {
    const dx = pos.x - a.x, dz = pos.z - a.z, rr = 1.2 + a.r; if (dx * dx + dz * dz > rr * rr) continue;
    const d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d, av = a.v || 0;
    const vx = -Math.sin(c.yaw) * c.speed + Math.sin(a.yaw) * av, vz = -Math.cos(c.yaw) * c.speed + Math.cos(a.yaw) * av, closing = -(vx * nx + vz * nz);
    pos.x += nx * (rr - d) * 0.6; pos.z += nz * (rr - d) * 0.6;
    if (closing > 0.8) { crash(closing * 0.9, nx, nz); c.speed *= 0.6; if (closing > 11) { a.on = false; addWanted(1); fx.burst(20, { x: a.x, y: 0.8, z: a.z, life: 1, size: 0.1, grav: 9, col: [3, 1.6, 0.5], add: true }, 6); } else a.v *= 0.5; }
  }
  hitPeds(c);
  const gy = surfaceY(pos.x, pos.z, pos.y); pos.y = gy >= pos.y ? gy : Math.max(gy, pos.y - 30 * dt);
  fwd(c.yaw, _f);
  const yf = surfaceY(pos.x + _f.x * 1.7, pos.z + _f.z * 1.7, pos.y), yr = surfaceY(pos.x - _f.x * 1.7, pos.z - _f.z * 1.7, pos.y);
  c.pitch = lerp(c.pitch, Math.atan2(yf - yr, 3.4) + clamp(c.accel * 0.0035, -0.05, 0.04), Math.min(1, 8 * dt));
  c.g.rotation.set(c.pitch, c.yaw, -c.steer * 0.02 * clamp(c.speed / 20, 0, 1));
  P.pos.copy(pos); P.lookYaw *= 1 - Math.min(1, 1.5 * dt);
  if (P.chase) {
    const dist = 8 + Math.abs(c.speed) * 0.05; _w.copy(pos).addScaledVector(_f, -dist).y += 3.4 + Math.abs(c.speed) * 0.01;
    if (!chaseOn || chaseP.distanceTo(_w) > 40) { chaseP.copy(_w); chaseOn = true; } else chaseP.lerp(_w, 1 - Math.exp(-10 * dt));
    cam.position.copy(chaseP); cam.lookAt(pos.x + _f.x * 4, pos.y + 1.3, pos.z + _f.z * 4);
  } else {
    chaseOn = false; _r.set(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    cam.position.copy(pos).addScaledVector(_r, 0.4).addScaledVector(_f, 0.1 - c.cockpit.position.z).y += c.eyeY;
    cam.rotation.set(P.pitch + c.pitch * 0.5, c.yaw + P.lookYaw, c.g.rotation.z * 0.5);
  }
  c.body.visible = P.chase; c.cockpit.visible = !P.chase;
  cam.fov = lerp(cam.fov, 70 + clamp(Math.abs(c.speed) / 66.7, 0, 1) ** 1.3 * 32, Math.min(1, 5 * dt)); cam.updateProjectionMatrix();
}
/** run a pedestrian over: below ~12 km/h nothing, then a stumble, then a ballistic fly-off with blood */
function hitPeds(c) {
  const sp = Math.abs(c.speed); if (sp < 3) return;
  const sg = Math.sign(c.speed); fwd(c.yaw, _f);
  for (const a of ped) {
    if (!a.on || a.fly) continue;
    const dx = a.x - c.g.position.x, dz = a.z - c.g.position.z, along = (dx * _f.x + dz * _f.z) * sg, lat = Math.abs(-dx * _f.z + dz * _f.x);
    if (along < 0.2 || along > 2.9 || lat > 1.2) continue;
    const k = Math.min(1, sp / 25), dx_ = _f.x * sg, dz_ = _f.z * sg;
    a.fly = { x: a.x, y: 0.9, z: a.z, vx: dx_ * sp * 0.9 + (Math.random() - 0.5) * 2, vy: 2 + sp * 0.22, vz: dz_ * sp * 0.9 + (Math.random() - 0.5) * 2, rx: 0, rz: 0, ry: a.yaw, wx: (Math.random() - 0.5) * 12, wz: (Math.random() - 0.5) * 12, lie: 0, landed: false, bounces: 0 };
    a.dead = sp > 9; c.speed *= 1 - 0.12 * k; c.hp = Math.max(1, c.hp - sp * 0.12); shake = Math.min(1.8, shake + 0.3 + k * 0.6);
    fx.burst(10 + (sp | 0), { x: a.x, y: 1, z: a.z, vx: dx_ * sp * 0.3, vy: 2, vz: dz_ * sp * 0.3, life: 1.2, size: 0.12, grav: 9, drag: 0.3, col: [.45, .02, .03] }, 3);
    if (sp > 8) { blood.splat(k * 0.9 + 0.15); toast(a.dead ? 'Pedestrian killed' : 'Pedestrian hit', `${Math.round(sp * 3.6)} km/h`); }
    if (AU.ctx) { thud(0.7, 260, 0.25); blip(700 + Math.random() * 300, 0.45, 'sawtooth', 0.05, -450); }
    navigator.vibrate?.(150); addWanted(a.dead ? 2 : 1);
  }
}
function toggleCar() {
  const c = myCar;
  if (P.car) {
    if (Math.abs(c.speed) > 8) { toast('Too fast', 'Slow down to get out'); return; }
    P.pos.copy(c.g.position).add(_p.set(-Math.cos(c.yaw), 0, Math.sin(c.yaw)).multiplyScalar(2.4)); P.yaw = c.yaw; P.pitch = 0; c.speed = 0; P.car = null; cam.fov = 70; cam.updateProjectionMatrix(); c.body.visible = true; c.cockpit.visible = false; return;
  }
  let best = null, bd = 5;
  const dMine = c.g.position.distanceTo(P.pos); if (dMine < bd && !c.exploded) { best = 'mine'; bd = dMine; }
  for (const a of agents) if (a.on && VT[a.t].style) { const d = Math.hypot(a.x - P.pos.x, a.z - P.pos.z); if (d < bd) { bd = d; best = a; } }
  if (!best) { if (c.exploded && dMine < 6) toast('Wrecked', 'Call "My Car" on the phone for a new one'); return; }
  if (best !== 'mine') { VT[best.t].im.getColorAt(best.i, _col); best.on = false; c.build(VT[best.t].style, _col.getHex()); c.g.position.set(best.x, best.y || 0, best.z); c.yaw = best.yaw; addWanted(1); toast('🚗 Car jacked', 'The police were notified'); }
  P.car = c; P.pitch = 0; P.lookYaw = 0;
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
    geo: trafficGeo('hatch'), style: 'hatch' },
  { n: 16, v: [8, 16], r: 1.3, minc: 0, maxc: 4, off: 2.4, tints: [0xf4f4f4, 0xf4f4f4, 0xe8e8e8, 0x202226, 0x8a8e94, 0xb7b1a2],       // Corolla / Civic / City style sedan
    geo: trafficGeo('sedan'), style: 'sedan' },
  { n: 6, v: [6, 11], r: 1.3, minc: 1, maxc: 4, off: 2.4, tints: [0xf2f2f2, 0xdcdcdc, 0x6f7a86],                                         // Suzuki Bolan van
    geo: vanGeo() },
  { n: 6, v: [8, 15], r: 1.4, minc: 0, maxc: 4, off: 2.4, tints: [0xf0f0f0, 0x23262b, 0xb9b9b4, 0x5b4a3a],                                 // Hilux style pickup
    geo: trafficGeo('pickup'), style: 'pickup' },
  { n: 22, v: [8, 15], r: 0.7, minc: 1, maxc: 4, off: 3.2, tints: [0xc01818, 0x1a1a1a, 0x1b3a8a, 0xdadada, 0x1d6a2a],                      // Honda CD70 style bike with rider
    geo: bikeGeo() },
  { n: 8, v: [5, 9], r: 0.9, minc: 1, maxc: 4, off: 3.0, tints: [0xe3b800, 0x1c7a3a, 0xe3b800, 0x2a2a2a],                                    // auto-rickshaw
    geo: rickGeo() },
  { n: 4, v: [5, 9], r: 1.8, minc: 0, maxc: 3, off: 2.8, tints: [0x2e6fd0, 0xd04a2e, 0x2a9a52, 0xe0b020],                                    // painted Hino-style truck
    geo: truckGeo() },
  { n: 3, v: [1.2, 2.2], r: 1.4, minc: 3, maxc: 4, off: 3.2, tints: [0xffffff],                                                              // donkey cart
    geo: cartGeo() },
  { n: 5, v: [6, 10], r: 1.1, minc: 2, maxc: 4, off: 3.0, tints: [0x2e6fd0, 0xd04a2e, 0xe3b800, 0x1c7a3a],   // Qingqi loader
    geo: qingqiGeo() },
];
const vehMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45 });
vehMat.onBeforeCompile = sh => {            // the instance tint only paints vertices flagged paintMask (glass, tyres, riders keep their own colours)
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float paintMask;').replace('vColor.rgb *= instanceColor.rgb;', 'vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, paintMask);');
};
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
  a.y = a.run.y ? lerp(a.run.y[i - 1], a.run.y[i], t) : 0;
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
    vt.im.setMatrixAt(a.i, _tm.compose(_tp.set(a.x, a.on ? a.y || 0 : -50, a.z), _tq.setFromEuler(_te.set(0, a.yaw, 0)), _ts));
  }
  for (const vt of VT) { vt.im.instanceMatrix.needsUpdate = true; if (vt.im.instanceColor) vt.im.instanceColor.needsUpdate = true; }
}

// ---------- street decor: trees + lamp posts per chunk (instanced), pedestrians, audio ----------
const treeGeo = merge([vcol(new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6).translate(0, 1.6, 0), [0.28, 0.2, 0.13]), vcol(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 4.4, 0), [0.1, 0.27, 0.07]), vcol(new THREE.IcosahedronGeometry(1.3, 0).translate(0.7, 3.6, 0.3), [0.13, 0.32, 0.09]), vcol(new THREE.IcosahedronGeometry(1.2, 0).translate(-0.6, 5.3, -0.2), [0.09, 0.24, 0.07])]);
const lampGeo = merge([vcol(new THREE.CylinderGeometry(0.07, 0.1, 7.5, 6).translate(0, 3.75, 0), [0.25, 0.26, 0.28]), bx(0.07, 0.07, 1.6, 0, 7.5, 0.8, [0.25, 0.26, 0.28]), bx(0.5, 0.12, 0.3, 0, 7.45, 1.6, [1, 0.9, 0.6])]);
const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4, emissive: 0xffd9a0, emissiveIntensity: 0 });
const inPoly = (x, z, p) => { let c = false; const n = p.length / 2; for (let a = 0, b = n - 1; a < n; b = a++) { const zi = p[a * 2 + 1], zj = p[b * 2 + 1]; if ((zi > z) !== (zj > z) && x < (p[b * 2] - p[a * 2]) * (z - zi) / (zj - zi) + p[a * 2]) c = !c; } return c; };
function nearRoad(x, z, roads) {
  for (const r of roads) {
    if (r.c > 4) continue; const p = r.p, lim = (r.w || ROAD_W[r.c]) / 2 + 3.5;
    if (!r.bb) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); } r.bb = [x0 - 10, x1 + 10, z0 - 10, z1 + 10]; }
    if (x < r.bb[0] || x > r.bb[1] || z < r.bb[2] || z > r.bb[3]) continue;
    for (let k = 0; k < p.length - 2; k += 2) { const ex = p[k + 2] - p[k], ez = p[k + 3] - p[k + 1], u = clamp(((x - p[k]) * ex + (z - p[k + 1]) * ez) / (ex * ex + ez * ez || 1), 0, 1); if ((x - p[k] - ex * u) ** 2 + (z - p[k + 1] - ez * u) ** 2 < lim * lim) return true; }
  }
  return false;
}
function decorChunk(roads, g, green = []) {
  const trees = [], lamps = [], props = [];
  for (const r of roads) {
    if (r.c > 4 || r.c < 1 || r.y || r.t) continue;
    const P = r.p, w = r.w || ROAD_W[r.c]; let acc = Math.random() * 15;
    for (let k = 0; k < P.length - 2; k += 2) {
      const x0 = P[k], z0 = P[k + 1], x1 = P[k + 2], z1 = P[k + 3], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1) continue;
      const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      for (; acc < L; acc += 14 + Math.random() * 10) for (const s of [-1, 1]) {
        const o = w / 2 + 2.4, x = x0 + ux * acc - uz * o * s, z = z0 + uz * acc + ux * o * s;
        if (r.c <= 3 && Math.random() < 0.3) lamps.push(x, z, Math.atan2(uz * s, -ux * s) + Math.PI / 2 * 0);
      }
      acc -= L;
    }
  }
  for (const a of green) {                                              // trees only in parks / grass / woods, never on verges or medians
    const p = a.p; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, A = 0, n = p.length / 2;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; x0 = Math.min(x0, p[i * 2]); x1 = Math.max(x1, p[i * 2]); z0 = Math.min(z0, p[i * 2 + 1]); z1 = Math.max(z1, p[i * 2 + 1]); A += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
    const want = Math.min(70, Math.floor(Math.abs(A) / 2 / 330));
    for (let q = 0, got = 0; q < want * 4 && got < want && trees.length < 1000; q++) {
      const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0);
      if (inPoly(x, z, p) && !nearRoad(x, z, roads)) { trees.push(x, z, 0.8 + Math.random() * 0.8, Math.random() * 6.3); got++; }
    }
  }
  for (const [list, geo, mat, stride, kind] of [[trees, treeGeo, treeMat, 4, 0], [lamps, lampGeo, lampMat, 3, 1]]) {
    const n = list.length / stride; if (!n) continue;
    const im = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) {
      const sc = kind ? 1 : list[i * 4 + 2], rot = kind ? list[i * 3 + 2] : list[i * 4 + 3], x = list[i * stride], z = list[i * stride + 1];
      im.setMatrixAt(i, _tm.compose(_tp.set(x, 0, z), _tq.setFromEuler(_te.set(0, rot, 0)), _ts.set(sc, sc, sc)));
      props.push({ x, z, sc, rot, kind, r: kind ? 0.3 : 0.28 * sc + 0.12, im, i, st: 0, t: 0, dx: 0, dz: 0 });
    }
    _ts.set(1, 1, 1); im.computeBoundingSphere(); g.add(im);
  }
  return props;
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
const poolMat = new THREE.MeshStandardMaterial({ color: 0x4a0508, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const poolIM = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), poolMat, 24), pools = []; poolIM.frustumCulled = false; scene.add(poolIM);
for (let i = 0; i < 24; i++) poolIM.setMatrixAt(i, _hm.compose(_tp.set(0, -50, 0), _tq.identity(), _ts.set(0, 0, 0)));
let poolI = 0; const addPool = (x, z) => { pools[poolI++ % 24] = { x, z, t: 0 }; };
function stepPools(dt) {
  for (let i = 0; i < pools.length; i++) { const p = pools[i]; if (!p || p.t > 4) continue; p.t += dt; const s = 0.25 + Math.min(p.t, 3) * 0.4; poolIM.setMatrixAt(i, _hm.compose(_tp.set(p.x, 0.16, p.z), _tq.identity(), _ts.set(s, 1, s))); poolIM.instanceMatrix.needsUpdate = true; }
}
function flyPed(a, dt) {
  const f = a.fly;
  if (!f.landed) {
    f.vy -= 9.8 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.rx += f.wx * dt; f.rz += f.wz * dt;
    if (f.y <= 0.18 && f.vy < 0) {
      if (Math.hypot(f.vx, f.vz) > 4 && f.bounces < 2) { f.vy = -f.vy * 0.28; f.y = 0.2; f.vx *= 0.55; f.vz *= 0.55; f.bounces++; if (AU.ctx) thud(0.3, 400, 0.15); fx.burst(5, { x: f.x, y: 0.3, z: f.z, life: 0.8, size: 0.1, grav: 9, col: [.45, .02, .03] }, 2); }
      else { f.landed = true; f.y = 0.18; if (a.dead) addPool(f.x, f.z); }
    }
  } else {
    f.lie += dt; f.vx *= 0.9; f.vz *= 0.9; f.x += f.vx * dt; f.z += f.vz * dt;
    const k = Math.min(1, 8 * dt), tx = -Math.PI / 2 + Math.round((f.rx + Math.PI / 2) / (2 * Math.PI)) * 2 * Math.PI, tz = Math.round(f.rz / (2 * Math.PI)) * 2 * Math.PI;
    f.rx += (tx - f.rx) * k; f.rz += (tz - f.rz) * k;
    if (!a.dead && f.lie > 5) a.fly = null; else if (a.dead && f.lie > 40) { a.on = false; a.fly = null; a.dead = false; }
  }
  a.x = f.x; a.z = f.z;
}
function stepPeds(dt) {
  if (!runs.length) return;
  for (const a of ped) {
    if (a.on && !a.fly && Math.hypot(a.x - P.pos.x, a.z - P.pos.z) > 160) a.on = false;
    if (!a.on) {
      const r = runs[(Math.random() * runs.length) | 0]; if (r.c < 2 || r.c > 4 || r.y || r.t) continue;
      Object.assign(a, { run: r, d: Math.random() * cum(r).at(-1), dir: Math.random() < 0.5 ? 1 : -1, v: 1.1 + Math.random() * 0.6, side: Math.random() < 0.5 ? -1 : 1, on: true, fly: null, dead: false }); pedPlace(a);
      const dist = Math.hypot(a.x - P.pos.x, a.z - P.pos.z); if (dist > 130 || dist < 12) a.on = false;
    }
    if (a.on && a.fly) {
      flyPed(a, dt); const f = a.fly || { x: a.x, y: 0, z: a.z, rx: 0, ry: a.yaw, rz: 0, landed: true };
      _hm.compose(_tp.set(f.x, f.y - 0.18 * (f.landed ? 0 : 1) * 0, f.z), _tq.setFromEuler(_te.set(f.rx, f.ry, f.rz, 'YXZ')), _ts.set(1, 1, 1)); _te.order = 'XYZ';
      pIM.setMatrixAt(a.i, _hm); const fl = f.landed ? 0.15 : Math.sin(performance.now() / 70 + a.i) * 1.1;
      for (const [im, side, s] of [[lIM, -0.1, fl], [rIM, 0.1, -fl]]) im.setMatrixAt(a.i, _lm.compose(_tp.set(side, 0.9, 0), _lq.setFromEuler(_te.set(s, 0, 0)), _ts).premultiply(_hm));
      continue;
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
  AU.radio = ctx.createGain(); AU.radio.gain.value = 0; const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 9000; AU.radio.connect(rlp); rlp.connect(out);
  const sir = ctx.createOscillator(), sf = ctx.createBiquadFilter(); sir.type = 'sawtooth'; sf.type = 'lowpass'; sf.frequency.value = 1800; AU.sirG = ctx.createGain(); AU.sirG.gain.value = 0; sir.connect(sf); sf.connect(AU.sirG); AU.sirG.connect(out); sir.start(); AU.sir = sir;
  AU.hornG = ctx.createGain(); AU.hornG.gain.value = 0; for (const hf of [392, 494]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hf; o.connect(AU.hornG); o.start(); } AU.hornG.connect(out);
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
  const thrOn = keys.has('KeyW') || JOY.y > 0.3 ? 1 : 0, rp = rpmOf(sp), f0 = 34 + (0.18 + 0.82 * rp.r) * (62 + rp.g * 6), alive = myCar.hp > 0 && !myCar.exploded;
  AU.engGain.gain.setTargetAtTime(P.car && alive ? 0.07 + 0.05 * Math.min(1, sp / 40) + 0.03 * thrOn : 0, t, 0.1);
  AU.eng.frequency.setTargetAtTime(f0 * (1 + 0.12 * thrOn), t, 0.05); AU.eng2.frequency.setTargetAtTime(f0 * 0.5, t, 0.05); AU.ef.frequency.setTargetAtTime(240 + rp.r * 500 + thrOn * 260, t, 0.08);
  AU.radio.gain.setTargetAtTime(P.car ? 0.9 : 0.04, t, 0.2);
  if (station && P.car) { const spb = 60 / RADIO[station].bpm / 4; if (rNext < t - 0.5) rNext = t + 0.05; while (rNext < t + 0.25) { SONG[station](rStep++, rNext, spb); rNext += spb; } }
  let cd = 1e9; for (const k of cops) if (k.on) cd = Math.min(cd, Math.hypot(k.x - P.pos.x, k.z - P.pos.z));
  AU.sirG.gain.setTargetAtTime(cd < 220 ? 0.05 * (1 - cd / 220) + 0.01 : 0, t, 0.2); AU.sir.frequency.setTargetAtTime(700 + 300 * Math.sin(t * 5), t, 0.03);
  AU.hornG.gain.setTargetAtTime(P.car && keys.has('KeyH') ? 0.07 : 0, t, 0.02);
  
  AU.city.gain.setTargetAtTime(0.14 + 0.1 * (1 - night) + (P.car ? 0.06 : 0), t, 0.5); AU.wind.gain.setTargetAtTime(P.car ? Math.min(0.2, sp / 220) : 0.02, t, 0.2);
  if (!P.car && P.ground && Math.hypot(P.vel.x, P.vel.z) > 1) { AU.step -= dt * Math.hypot(P.vel.x, P.vel.z) * 0.55; if (AU.step <= 0) { AU.step = 1; thud(0.12, 700, 0.07); } }
  if ((AU.horn -= dt) < 0) { AU.horn = 5 + Math.random() * 14; const f = 330 + Math.random() * 100, n = Math.random() < 0.4 ? 2 : 1; for (let i = 0; i < n; i++) setTimeout(() => AU.ctx && (blip(f, 0.22, 'square', 0.035), blip(f * 1.26, 0.22, 'square', 0.03)), i * 300); }
  if ((AU.bird -= dt) < 0) { AU.bird = 1.5 + Math.random() * 4; if (night < 0.4) { const f = 2400 + Math.random() * 1500; blip(f, 0.09, 'sine', 0.025, 700); setTimeout(() => AU.ctx && blip(f + 400, 0.09, 'sine', 0.02, -500), 110); } else blip(5200 + Math.random() * 600, 0.06, 'sine', 0.01); }
}

// ---------- radio (synthesised stations), police, pickups ----------
const GEARS = [0, 11, 22, 34, 47, 62, 80];
function rpmOf(v) { let g = 0; while (g < 5 && v > GEARS[g + 1]) g++; return { g, r: clamp((v - GEARS[g]) / (GEARS[g + 1] - GEARS[g]), 0, 1) }; }
const mtof = m => 440 * 2 ** ((m - 69) / 12);
function note(f, t0, dur, type, vol) { const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(AU.radio); o.start(t0); o.stop(t0 + dur + 0.02); }
function noiseHit(t0, dur, vol, hp, dest = AU.radio) { const c = AU.ctx, s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter(); s.buffer = AU.noise; fl.type = 'highpass'; fl.frequency.value = hp; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t0, Math.random()); s.stop(t0 + dur); }
function kick(t0, vol = 0.3) { const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.14); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22); o.connect(g); g.connect(AU.radio); o.start(t0); o.stop(t0 + 0.25); }
const RADIO = [{ n: 'Radio off', bpm: 90 }, { n: 'Lo-Fi Margalla', bpm: 76 }, { n: 'Synth FM 86', bpm: 112 }, { n: 'Desi Beats', bpm: 96 }];
const SONG = [null,
  (s, t0, sp) => {
    const ch = [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]][(s >> 4) & 3];
    if (s % 16 === 0) for (const m of ch) note(mtof(m), t0, sp * 15, 'triangle', 0.045);
    if (s % 8 === 0) { note(mtof(ch[0] - 24), t0, sp * 6, 'sine', 0.2); kick(t0, 0.22); }
    if (s % 8 === 4) noiseHit(t0, 0.09, 0.08, 4000); if (s % 2 === 1) noiseHit(t0, 0.025, 0.025, 9000);
    if (s % 4 === 0 && Math.random() < 0.55) note(mtof(ch[(Math.random() * 4) | 0] + 12), t0, sp * 3, 'sine', 0.05);
  },
  (s, t0, sp) => {
    const root = [33, 33, 36, 31][(s >> 4) & 3];
    if (s % 2 === 0) note(mtof(root), t0, sp * 1.8, 'sawtooth', 0.07);
    note(mtof(root + 24 + [0, 7, 12, 15][s % 4]), t0, sp * 1.4, 'square', 0.025);
    if (s % 4 === 0) kick(t0, 0.3); if (s % 8 === 4) noiseHit(t0, 0.14, 0.12, 2500); if (s % 2 === 1) noiseHit(t0, 0.03, 0.04, 8000);
  },
  (s, t0, sp) => {
    const sc = [0, 1, 4, 5, 7, 8, 11];
    if (s % 32 === 0) { note(mtof(48), t0, sp * 31, 'sawtooth', 0.02); note(mtof(55), t0, sp * 31, 'sawtooth', 0.016); }
    if ([0, 3, 6, 10, 12].includes(s % 16)) kick(t0, 0.26); if ([2, 5, 7, 9, 11, 14, 15].includes(s % 16)) noiseHit(t0, 0.05, 0.07, 3200);
    if (s % 2 === 0 && Math.random() < 0.7) note(mtof(60 + sc[(s * 3 + ((Math.random() * 3) | 0)) % 7] + (s % 16 > 8 ? 12 : 0)), t0, sp * 2.5, 'triangle', 0.05);
  }];
let station = 0, rNext = 0, rStep = 0;
function nextStation() {
  if (!P.car) { toast('📻', 'Get in a car to use the radio'); return; }
  audioInit(); station = (station + 1) % RADIO.length; rStep = 0; rNext = AU.ctx.currentTime + 0.05; toast('📻 ' + RADIO[station].n, 'R — next station');
}
const COP_N = 4, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const copGeo = trafficGeo('sedan', [.06, .08, .16], [[new THREE.BoxGeometry(0.03, 0.26, 2.1).translate(0.89, 0.66, 0.15), [.92, .92, .92]], [new THREE.BoxGeometry(0.03, 0.26, 2.1).translate(-0.89, 0.66, 0.15), [.92, .92, .92]], [new THREE.BoxGeometry(0.9, 0.08, 0.28).translate(0, 1.5, 0.3), [.05, .05, .05]]]);
const cops = [];
for (let i = 0; i < COP_N; i++) {
  const g = new THREE.Group(), body = new THREE.Mesh(copGeo, vehMat); body.castShadow = true; g.add(body);
  const lr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.24), new THREE.MeshBasicMaterial({ color: 0xff2020 })), lb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.24), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
  lr.position.set(-0.24, 1.58, 0.3); lb.position.set(0.24, 1.58, 0.3); g.add(lr, lb); g.visible = false; scene.add(g);
  cops.push({ g, lr, lb, on: false, x: 0, z: 0, yaw: 0, v: 0, bust: 0 });
}
function stepCops(dt) {
  const tgt = P.car ? myCar.g.position : P.pos, want = wanted ? Math.min(COP_N, wanted + 1) : 0;
  let alive = 0, near = 1e9; for (const k of cops) if (k.on) alive++;
  if (alive < want && runs.length && Math.random() < dt * 1.5) {
    const k = cops.find(q => !q.on);
    for (let tries = 0; tries < 30 && k; tries++) {
      const rr = runs[(Math.random() * runs.length) | 0]; if (rr.c > 3 || rr.y) continue;
      const d = Math.hypot(rr.p[0] - tgt.x, rr.p[1] - tgt.z);
      if (d > 130 && d < 260) { Object.assign(k, { on: true, x: rr.p[0], z: rr.p[1], v: 0, bust: 0 }); k.yaw = Math.atan2(-(tgt.x - k.x), -(tgt.z - k.z)); k.g.visible = true; break; }
    }
  }
  for (const k of cops) {
    if (!k.on) continue;
    const tx = tgt.x - k.x, tz = tgt.z - k.z, dist = Math.hypot(tx, tz) || 1; near = Math.min(near, dist);
    if (!wanted && dist > 300) { k.on = false; k.g.visible = false; continue; }
    k.yaw += clamp(wrapA(Math.atan2(-tx, -tz) - k.yaw), -2.4 * dt, 2.4 * dt);
    const vt = wanted ? Math.min(20 + wanted * 6, dist * 1.4 + 4) : 8;
    k.v = lerp(k.v, dist < 3 ? 0 : vt, Math.min(1, 1.8 * dt));
    fwd(k.yaw, _f); k.x += _f.x * k.v * dt; k.z += _f.z * k.v * dt;
    _p.set(k.x, 0, k.z); if (resolve(_p, 1.2) > 0.02) k.v *= 0.5; collideProps(_p, 1.2); k.x = _p.x; k.z = _p.z;
    if (dist < 2.8 && wanted && P.car) { const closing = Math.abs(k.v) + Math.abs(myCar.speed) * 0.6; if (closing > 3) { crash(closing * 0.7, tx / dist, tz / dist); myCar.speed *= 0.75; k.v *= -0.3; } }
    const slow = P.car ? Math.abs(myCar.speed) < 3 : true;
    k.bust = wanted && dist < (P.car ? 6 : 3.5) && slow ? k.bust + dt : Math.max(0, k.bust - dt);
    if (k.bust > 2 && !dead) wasted('BUSTED');
    k.g.position.set(k.x, 0, k.z); k.g.rotation.y = k.yaw;
    const fl = Math.floor(performance.now() / 120) % 2; k.lr.material.color.setRGB(fl ? 6 : 0.3, 0.2, 0.2); k.lb.material.color.setRGB(0.2, 0.3, fl ? 0.3 : 6);
  }
  if (wanted) { wantedT = near > 90 ? wantedT + dt : 0; if (wantedT > 20) { wanted--; wantedT = 0; toast(wanted ? '🚨 Heat dropping' : '✔ Wanted level cleared', '★'.repeat(wanted) + '☆'.repeat(5 - wanted)); } }
}
const PK_N = 10;
const cashIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x1a8a44, emissiveIntensity: 1.6, roughness: 0.4 }), 6);
const heartIM = new THREE.InstancedMesh(merge([new THREE.BoxGeometry(0.5, 0.16, 0.16), new THREE.BoxGeometry(0.16, 0.16, 0.5)]), new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xcc1133, emissiveIntensity: 1.6, roughness: 0.4 }), 4);
for (const im of [cashIM, heartIM]) { im.frustumCulled = false; scene.add(im); }
const pk = Array.from({ length: PK_N }, (_, i) => ({ on: false, i, health: i >= 6, x: 0, z: 0 }));
function stepPickups(time) {
  for (const k of pk) {
    const im = k.health ? heartIM : cashIM, idx = k.health ? k.i - 6 : k.i;
    if (k.on && Math.hypot(k.x - P.pos.x, k.z - P.pos.z) > 380) k.on = false;
    if (!k.on && runs.length && Math.random() < 0.05) {
      const rr = runs[(Math.random() * runs.length) | 0];
      if (rr.c >= 2 && rr.c <= 4 && !rr.y && !rr.t) { const s = ((Math.random() * (rr.p.length / 2 - 1)) | 0) * 2, x = rr.p[s], z = rr.p[s + 1], d = Math.hypot(x - P.pos.x, z - P.pos.z); if (d > 50 && d < 300) { k.on = true; k.x = x; k.z = z; } }
    }
    if (k.on && Math.hypot(k.x - P.pos.x, k.z - P.pos.z) < (P.car ? 3.4 : 1.8) && P.pos.y < 3) {
      k.on = false;
      if (k.health) { P.hp = Math.min(100, P.hp + 35); toast('❤ Health', `+35 · ${Math.round(P.hp)}%`); } else { const v = 50 * (1 + (Math.random() * 8 | 0)); money += v; toast('$ Cash', `+$${v}`); }
      if (AU.ctx) { blip(k.health ? 700 : 1100, 0.12, 'sine', 0.1); setTimeout(() => AU.ctx && blip(k.health ? 900 : 1500, 0.14, 'sine', 0.1), 90); }
    }
    im.setMatrixAt(idx, _hm.compose(_tp.set(k.x, k.on ? 1 + 0.15 * Math.sin(time * 3 + k.i) : -50, k.z), _tq.setFromEuler(_te.set(0, time * 1.6, 0)), _ts.set(1, 1, 1)));
  }
  cashIM.instanceMatrix.needsUpdate = heartIM.instanceMatrix.needsUpdate = true;
}
let signT = 0;
function updateSigns() {
  for (const c of loaded.values()) {
    const far = Math.hypot((c.i + 0.5) * CH - P.pos.x, (c.j + 0.5) * CH - P.pos.z) > 800;
    for (const s of c.sprites) { if (far) { s.visible = false; continue; } const d = Math.hypot(s.userData.x - P.pos.x, s.userData.z - P.pos.z); s.visible = d < s.userData.far && d > 22; }
  }
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
let EV = [], hour = 6.5, ffTo = 0, day = 1, trail = [], trailT = 0, mapBig = false, mapZ = 0, timeScale = 30;
const resetEvents = () => { EV = CHAPTERS.map((c, k) => ({ id: c.id, title: c.title, text: c.text, hour: c.hour, end: CHAPTERS[k + 1]?.hour ?? 24, site: PLACES[SITE_OF[c.id]], status: 'pending' })); };
resetEvents();
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1200, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
scene.add(beacon);
const activeEvent = () => EV.find(e => e.status === 'pending');
let nearEvent = null, inScene = false, sceneTimer = 0, sceneEv = null;
function completeEvent(e) { e.status = 'done'; e.at = Math.max(hour, e.hour); ffTo = Math.max(ffTo, e.end); toast(`✓ ${e.title}`, e.text); money += 250; big('MISSION PASSED', `${e.title} · +$250`, 'gold'); }
/** step inside: the original day walkthrough (index.html) plays that chapter's interior in an iframe, then hands control back */
function enterEvent(e) {
  const ch = CHAPTERS.find(c => c.id === e.id); if (!ch || inScene) return;
  inScene = true; sceneEv = e; document.exitPointerLock(); keys.clear(); if (TOUCH) setPaused(true);
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
  if (id === 'car') { const f = fwd(P.yaw, new THREE.Vector3()); const broken = myCar.hp < 100 || myCar.exploded, fee = broken ? Math.min(money, Math.round((100 - Math.max(0, myCar.hp)) * 4)) : 0; if (broken) { myCar.build('peugeot', 0xf6f6f2); money -= fee; } myCar.g.position.set(P.pos.x + f.x * 9, P.pos.y, P.pos.z + f.z * 9); myCar.yaw = P.yaw; myCar.speed = 0; myCar.g.rotation.set(0, P.yaw, 0); toast('🚗', fee ? `Repaired and delivered · -$${fee}` : 'Your car is waiting nearby'); closePhone(); return; }
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
  if (inScene) return; phoneOpen = true; document.exitPointerLock(); if (TOUCH) setPaused(true); if (tab) { phoneTab = tab; phoneView = null; }
  $('phone').classList.remove('hidden'); start.classList.add('hidden'); if (ringing) { phoneTab = 'call'; phoneView = null; } renderPhone();
}
function closePhone() { phoneOpen = false; phoneView = null; $('phone').classList.add('hidden'); try { speechSynthesis.cancel(); } catch (e) { /* nothing speaking */ } if (TOUCH) setPaused(false); else canvas.requestPointerLock(); }
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
  su.rayleigh.value = 0.3 + 0.9 * dayK + duskK * 1.0; su.mieCoefficient.value = 0.002 + duskK * 0.004; su.turbidity.value = 2 + 5 * duskK;
  if (Math.abs(hour - envHour) > 0.3) {
    envHour = hour; envSky.material.uniforms.sunPosition.value.copy(dir); envSky.material.uniforms.rayleigh.value = su.rayleigh.value;
    envRT?.dispose(); envRT = pmrem.fromScene(envScene); scene.environment = envRT.texture;
  }
  scene.environmentIntensity = 0.1;
  tmpA.setRGB(0.5, 0.66, 0.9).lerp(tmpB.setRGB(0.9, 0.55, 0.38), duskK * 0.7).lerp(tmpB.setRGB(0.02, 0.03, 0.07), 1 - dayK);
  scene.fog.color.copy(tmpA); scene.fog.density = 0.00012 + 0.0003 * (1 - dayK) + 0.0003 * duskK;
  sun.position.set(snap(P.pos.x + dir.x * 600, 8), P.pos.y + dir.y * 600, snap(P.pos.z + dir.z * 600, 8)); sun.target.position.set(snap(P.pos.x, 8), 0, snap(P.pos.z, 8));
  sun.intensity = 3.5 * dayK; sun.color.setRGB(1, 0.96, 0.9).lerp(tmpB.setRGB(1, 0.6, 0.35), duskK);
  moon.intensity = 0.7 * (1 - dayK); moon.position.set(P.pos.x - dir.x * 600, 400, P.pos.z - dir.z * 600); moon.target.position.copy(P.pos);
  hemi.intensity = 0.3 - 0.1 * dayK; hemi.color.setRGB(0.8, 0.88, 1).lerp(tmpB.setRGB(0.25, 0.3, 0.5), 1 - dayK);
  stars.material.opacity = clamp(1 - dayK * 1.6, 0, 1); stars.position.copy(cam.position);
  const night = nightK = 1 - dayK;
  lampMat.emissiveIntensity = 2.5 * night;
  bldMat.emissiveIntensity = 1.1 * night; CM.lamp.emissiveIntensity = 0.6 + 3.5 * night; myCar.lights.forEach(l => l.intensity = 1800 * night * night);
  bloom.threshold = lerp(4, 0.9, night); bloom.strength = 0.02 + 0.38 * night; renderer.toneMappingExposure = 0.5 + 0.4 * night;
  ground.material.color.setScalar(0.5 + 0.5 * dayK);
  const ov = window.__ov;   // dev tuning hook
  if (ov) { if (ov.ray != null) su.rayleigh.value = ov.ray; if (ov.turb != null) su.turbidity.value = ov.turb; if (ov.exp != null) renderer.toneMappingExposure = ov.exp; if (ov.bth != null) bloom.threshold = ov.bth; if (ov.bst != null) bloom.strength = ov.bst; if (ov.fog != null) scene.fog.density = ov.fog; if (ov.sun != null) sun.intensity = ov.sun; if (ov.hemi != null) hemi.intensity = ov.hemi; if (ov.env != null) scene.environmentIntensity = ov.env; }
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
    if (P.pos.x < r.x0 || P.pos.x > r.x1 || P.pos.z < r.z0 || P.pos.z > r.z1 || (r.y ? P.pos.y < 0.6 : P.pos.y > 3)) continue;
    const p = r.p;
    for (let k = 0; k < p.length - 2; k += 2) {
      const ex = p[k + 2] - p[k], ez = p[k + 3] - p[k + 1], t = clamp(((P.pos.x - p[k]) * ex + (P.pos.z - p[k + 1]) * ez) / (ex * ex + ez * ez || 1), 0, 1), d = (P.pos.x - p[k] - ex * t) ** 2 + (P.pos.z - p[k + 1] - ez * t) ** 2;
      if (d < best) { best = d; hit = r; }
    }
  }
  return hit && { n: hit.n, s: hit.s, w: Math.round(hit.w), o: hit.o, fly: !!hit.y, tun: !!hit.t };
}
let lastStats = '';
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
  $('roadinfo').innerHTML = roadInfo ? `${roadInfo.n || 'Street'}${roadInfo.s ? ` · limit ${roadInfo.s}` : ''} <small>${roadInfo.w} m wide${roadInfo.o ? ' · one-way' : ''}${roadInfo.fly ? ' · flyover' : ''}${roadInfo.tun ? ' · underpass' : ''}</small>` : '';
  const hijack = !P.car && agents.some(a => a.on && VT[a.t].style && Math.hypot(a.x - P.pos.x, a.z - P.pos.z) < 5);
  $('prompt').textContent = blood.cover > 0 && !blood.wiping ? 'X — run the wipers to clear the blood' : nearEvent && nearEvent.id !== 'commute' ? `E — enter: ${nearEvent.title}` : !P.car && myCar.g.position.distanceTo(P.pos) < 5 && !myCar.exploded ? 'F — get in the car' : hijack ? 'F — take this car (wanted!)' : '';
  const stats = `<b>$${money.toLocaleString()}</b><span class="stars">${'★'.repeat(wanted)}<i>${'★'.repeat(5 - wanted)}</i></span><div class="bar"><u>YOU</u><em style="width:${Math.max(0, P.hp)}%"></em></div>${P.car || myCar.hp < 100 ? `<div class="bar car"><u>CAR</u><em style="width:${Math.max(0, myCar.hp)}%"></em></div>` : ''}`;
  if (stats !== lastStats) { lastStats = stats; $('stats').innerHTML = stats; }
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
function setMapZ(z) { mapZ = z; mapBig = z > 0; const m = $('map'); m.classList.toggle('big', mapBig); m.width = m.height = mapBig ? 760 : 440; }
const PLACE_K = new Set(['suburb', 'neighbourhood', 'town', 'city', 'village', 'hospital', 'university']);
function drawMap() {
  const W = mctx.canvas.width, ctx = mctx, view = P.car ? myCar.yaw + P.lookYaw : P.yaw, bw = BOUNDS.x1 - BOUNDS.x0, bh = BOUNDS.z1 - BOUNDS.z0;
  const sc = mapBig ? W / [0, 3000, 9000, 34000][mapZ] : W / 2600, cx = P.pos.x, cz = P.pos.z, half = W / 2 / sc * 1.45;   // always centred on you
  ctx.fillStyle = '#10141c'; ctx.fillRect(0, 0, W, W); ctx.save();
  ctx.translate(W / 2, W / 2); if (!mapBig) ctx.rotate(view); ctx.scale(sc, sc); ctx.translate(-cx, -cz);
  ctx.drawImage(mapBase, BOUNDS.x0, BOUNDS.z0, bw, bh);
  if (sc > W / 12000) {                       // real streets of every loaded chunk, by class
    const cols = ['#f0c878', '#e2e2ea', '#c4c8d4', '#8a93a8', '#5b6478'], wd = [4.5, 3.6, 3, 2.1, 1.4]; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let c = 4; c >= 0; c--) {
      ctx.strokeStyle = cols[c]; ctx.lineWidth = wd[c] / sc * (mapBig ? 1.25 : 1); ctx.beginPath();
      for (const r of runs) { if (r.c !== c || r.x1 < cx - half || r.x0 > cx + half || r.z1 < cz - half || r.z0 > cz + half) continue; const p = r.p; ctx.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]); }
      ctx.stroke();
    }
  }
  if (mapBig && mapZ < 3) {
    ctx.textAlign = 'center'; ctx.font = `600 ${11 / sc}px Chakra Petch, sans-serif`;
    for (const l of GL.labels) { if ((l.k !== 'road' && !PLACE_K.has(l.k)) || (l.k === 'road' && mapZ > 2) || Math.abs(l.x - cx) > half || Math.abs(l.z - cz) > half) continue; ctx.fillStyle = l.k === 'road' ? '#9fd0ff' : 'rgba(255,255,255,.8)'; ctx.fillText(l.n, l.x, l.z); }
  }
  const px = 1 / sc; ctx.lineWidth = 3 * px; ctx.lineJoin = 'round';
  for (let k = 1; k < trail.length; k++) { if (Math.hypot(trail[k][0] - trail[k - 1][0], trail[k][1] - trail[k - 1][1]) > 300) continue; ctx.strokeStyle = `hsl(${(trail[k][2] / 24) * 300 + 180},100%,60%)`; ctx.beginPath(); ctx.moveTo(trail[k - 1][0], trail[k - 1][1]); ctx.lineTo(trail[k][0], trail[k][1]); ctx.stroke(); }
  const e = activeEvent(), pulse = (7 + Math.sin(performance.now() / 200) * 3) * px;
  if (wp) { ctx.strokeStyle = '#fff'; ctx.setLineDash([8 * px, 6 * px]); ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.moveTo(P.pos.x, P.pos.z); ctx.lineTo(wp.x, wp.z); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = wp.col; ctx.beginPath(); ctx.arc(wp.x, wp.z, pulse * 1.5, 0, 7); ctx.fill(); }
  for (const k of cops) if (k.on) { ctx.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ff3030' : '#3060ff'; ctx.beginPath(); ctx.arc(k.x, k.z, 5 * px, 0, 7); ctx.fill(); }
  for (const k of pk) if (k.on) { ctx.fillStyle = k.health ? '#ff5577' : '#4cff8a'; ctx.beginPath(); ctx.arc(k.x, k.z, 3 * px, 0, 7); ctx.fill(); }
  ctx.textAlign = 'center';
  for (const s of Object.values(PLACES)) {
    const on = e && e.site === s; ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(s.x, s.z, on ? pulse * 1.3 : 5 * px, 0, 7); ctx.fill();
    if (mapBig || on) { ctx.font = `600 ${12 * px}px Chakra Petch, sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(s.n.split('·').at(-1).trim(), s.x, s.z - 12 * px); }
  }
  if (mapBig) { ctx.font = `700 ${15 * px}px Chakra Petch, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('ISLAMABAD', ...ll(33.69, 73.03)); ctx.fillText('RAWALPINDI', ...ll(33.60, 73.05)); }
  ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(P.pos.x, P.pos.z); ctx.rotate(mapBig ? -view : 0); ctx.beginPath(); ctx.moveTo(0, -11 * px); ctx.lineTo(7 * px, 8 * px); ctx.lineTo(-7 * px, 8 * px); ctx.fill(); ctx.restore();
  ctx.restore();
}

// ---------- input (keyboard + mouse + touch) ----------
const start = $('start');
let paused = true;
function setPaused(v) { paused = v; start.classList.toggle('hidden', !paused || phoneOpen || inScene); if (paused) { keys.clear(); JOY.x = JOY.y = 0; } }
function begin() {
  audioInit();
  if (TOUCH) { setPaused(false); try { document.documentElement.requestFullscreen?.().catch(() => {}); screen.orientation?.lock?.().catch(() => {}); } catch (e) { /* not allowed here */ } } else canvas.requestPointerLock();
}
start.addEventListener('click', begin); canvas.addEventListener('click', () => { if (!TOUCH) begin(); });
document.addEventListener('pointerlockchange', () => { if (!TOUCH) setPaused(document.pointerLockElement !== canvas); });
function lookBy(dx, dy, k = 0.0022) {
  if (P.car && !P.chase) P.lookYaw = clamp(P.lookYaw - dx * k, -1.8, 1.8); else if (!P.car) P.yaw -= dx * k;
  P.pitch = clamp(P.pitch - dy * k, -1.4, 1.4);
}
addEventListener('mousemove', e => { if (!paused && !TOUCH) lookBy(e.movementX, e.movementY); });
const ARROWS = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
/** one-shot actions, shared by keyboard and the touch buttons */
function act(code) {
  if (code === 'KeyT') { if (!inScene && (!paused || phoneOpen)) phoneOpen ? closePhone() : openPhone(); return; }
  if (paused || dead) return;
  if (code === 'KeyF') toggleCar();
  else if (code === 'KeyE') { if (nearEvent && nearEvent.id !== 'commute') enterEvent(nearEvent); }
  else if (code === 'KeyV') P.chase = !P.chase;
  else if (code === 'KeyN') AU.muted = !AU.muted;
  else if (code === 'KeyM') { setMapZ((mapZ + 1) % 4); }
  else if (code === 'KeyX') { if (blood.wipe() && AU.ctx) noiseHit(AU.ctx.currentTime, 0.5, 0.12, 1200, AU.out); }
  else if (code === 'KeyR') nextStation();
  else if (code === 'BracketRight') timeScale = Math.min(timeScale * 2, 240);
  else if (code === 'BracketLeft') timeScale = Math.max(timeScale / 2, 1);
}
addEventListener('keydown', e => {
  if (e.code === 'KeyT' && !e.repeat && !inScene) { act('KeyT'); return; }
  if (paused) return; keys.add(ARROWS[e.code] || e.code); if (e.code === 'Space' || ARROWS[e.code]) e.preventDefault(); if (e.repeat) return;
  act(e.code);
});
addEventListener('keyup', e => keys.delete(ARROWS[e.code] || e.code));
if (TOUCH) {
  document.body.classList.add('touch');
  const joy = $('joy'), st = $('stick'); let jid = null, jx = 0, jy = 0;
  const jm = e => {
    if (e.pointerId !== jid) return; let dx = (e.clientX - jx) / 48, dy = (e.clientY - jy) / 48; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    JOY.x = Math.abs(dx) < 0.12 ? 0 : dx; JOY.y = Math.abs(dy) < 0.12 ? 0 : -dy; st.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
  };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); const rc = joy.getBoundingClientRect(); jx = rc.left + rc.width / 2; jy = rc.top + rc.height / 2; jm(e); });
  joy.addEventListener('pointermove', jm);
  const ju = e => { if (e.pointerId !== jid) return; jid = null; JOY.x = JOY.y = 0; st.style.transform = ''; };
  joy.addEventListener('pointerup', ju); joy.addEventListener('pointercancel', ju);
  const look = $('look'); let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', e => { lid = e.pointerId; look.setPointerCapture(lid); lx = e.clientX; ly = e.clientY; });
  look.addEventListener('pointermove', e => { if (e.pointerId !== lid || paused) return; lookBy(e.clientX - lx, e.clientY - ly, 0.005); lx = e.clientX; ly = e.clientY; });
  const lu = e => { if (e.pointerId === lid) lid = null; }; look.addEventListener('pointerup', lu); look.addEventListener('pointercancel', lu);
  for (const b of document.querySelectorAll('#tbtns [data-k], #tbtns [data-hold]')) {
    const hold = b.dataset.hold;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down'); if (hold) { if (!paused) keys.add(hold); } else act(b.dataset.k); });
    const up = () => { b.classList.remove('down'); if (hold) keys.delete(hold); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  addEventListener('contextmenu', e => e.preventDefault());
}

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
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now() / 1000; crashCd -= dt;
  if (!paused) {
    if (ffTo > hour) { hour += Math.min(0.5 * dt * 2, ffTo - hour); if (ffTo - hour < 1e-3) ffTo = 0; } else hour += timeScale / 3600 * dt;
    if (dead) { deadT += dt; grade.uniforms.gray.value = Math.min(1, deadT * 0.7); P.car ? stepCar(0) : stepFoot(0); if (deadT > 4.2) respawn(); }
    else if (P.car) stepCar(dt); else stepFoot(dt);
    trailT -= dt; if (trailT <= 0) { trailT = 1; trail.push([P.pos.x, P.pos.z, hour]); if (trail.length > 6000) trail.shift(); }
    tm('traffic', () => stepTraffic(dt)); tm('peds', () => stepPeds(dt)); updateEvents(); fireIncoming();
    stepCops(dt); stepPickups(now); stepFalling(dt); stepPools(dt);
  } else if (P.car) stepCar(0); else stepFoot(0);
  animCar(dt); damageFx(dt); fx.update(dt); blood.update(dt);
  if (shake > 0.002) { cam.position.x += (Math.random() - 0.5) * shake * 0.22; cam.position.y += (Math.random() - 0.5) * shake * 0.22; cam.rotation.z += (Math.random() - 0.5) * shake * 0.05; cam.rotation.x += (Math.random() - 0.5) * shake * 0.02; shake *= Math.exp(-5 * dt); }
  flashT = Math.max(0, flashT - dt * 1.6);
  const gu = grade.uniforms; gu.spd.value = lerp(gu.spd.value, P.car ? clamp((Math.abs(myCar.speed) - 22) / 44, 0, 1) : 0, Math.min(1, 4 * dt)); gu.hurt.value = Math.max(flashT, clamp(1 - P.hp / 60, 0, 1) * 0.7); gu.t.value = now % 10;
  document.body.classList.toggle('incar', !!P.car);
  tm('stream', streamChunks);
  ground.position.set(snap(P.pos.x, TILE), 0, snap(P.pos.z, TILE));
  signT -= dt; if (signT < 0) { signT = 0.4; updateSigns(); }
  tm('sky', updateSky); updateAudio(dt, nightK); tm('hud', () => updateHud(dt)); tm('map', drawMap); governor(dt);
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  if (bigT > 0 && (bigT -= dt) <= 0 && !dead) $('big').style.opacity = 0;
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
window.__city = { VT, vehMat, ped, falling, crash, surfaceY, elev, cops, fx, blood, wasted, addWanted, get money() { return money; }, set money(v) { money = v; }, get wanted() { return wanted; }, TM, renderer, composer, sun, bloom, gtao, scene, tp: (lat, lon, car = false) => { const [x, z] = ll(lat, lon); P.pos.set(x, 0, z); myCar.g.position.set(x + 4, 0, z); myCar.speed = 0; P.car = car ? myCar : null; }, P, myCar, get hour() { return hour; }, set hour(v) { hour = v; }, teleport, PLACES, get paused() { return paused; }, set paused(v) { paused = v; start.classList.toggle('hidden', !v); }, keys, loaded, runs, agents, EV };
