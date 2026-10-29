import * as THREE from 'three';
import { ROUTE } from './route.js';
import { clamp, lerp, smooth } from './util.js';
import { std } from './materials.js';
import * as PR from './props.js';

/* Home <-> office drive on the real GPX route (metres). Left-hand traffic, divided road, traffic, lights,
   street lamps, a right-hand-drive compact-SUV cockpit (own design, no brand marks), chase + bird's-eye cams. */
const OFF = 5000, DS = 3, LANE = [1.9, 5.4];
const rnd = (() => { let s = 20261030; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/* ---------- route: smooth, resample, curvature ---------- */
function chaikin(p, it) { for (let k = 0; k < it; k++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(p[p.length - 1]); p = q; } return p; }
const sm = chaikin(ROUTE, 3), cum = [0]; for (let i = 1; i < sm.length; i++) cum.push(cum[i - 1] + Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]));
const LEN = cum[cum.length - 1], N = Math.floor(LEN / DS) + 1;
const X = new Float32Array(N), Z = new Float32Array(N), TX = new Float32Array(N), TZ = new Float32Array(N), K = new Float32Array(N);
{ let j = 0; for (let i = 0; i < N; i++) { const s = i * DS; while (j < sm.length - 2 && cum[j + 1] < s) j++; const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]); X[i] = lerp(sm[j][0], sm[j + 1][0], f); Z[i] = lerp(sm[j][1], sm[j + 1][1], f); }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2), dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; }
  const raw = new Float32Array(N); for (let i = 1; i < N; i++) { let d = Math.atan2(TZ[i], TX[i]) - Math.atan2(TZ[i - 1], TX[i - 1]); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; raw[i] = d / DS; }
  for (let i = 0; i < N; i++) { let a = 0, c = 0; for (let k = -4; k <= 4; k++) { const q = raw[clamp(i + k, 0, N - 1) | 0]; a += q; c++; } K[i] = a / c; } }
const at = (s) => { const f = clamp(s / DS, 0, N - 1.001), i = f | 0, u = f - i; return { x: lerp(X[i], X[i + 1], u), z: lerp(Z[i], Z[i + 1], u), tx: lerp(TX[i], TX[i + 1], u), tz: lerp(TZ[i], TZ[i + 1], u), k: lerp(K[i], K[i + 1], u) }; };
const lanePos = (s, a) => { const p = at(s); return { x: p.x + p.tz * a, z: p.z - p.tx * a, tx: p.tx, tz: p.tz, k: p.k }; };   // a>0 = left of the forward direction

/* ---------- speed profiles (both trip directions), traffic-light stops ---------- */
const LIGHTS = [0.04, 0.11, 0.27, 0.45, 0.61, 0.83, 0.95].map((f) => Math.round(f * N));
function profile(dir) {
  const v = new Float32Array(N), lightAt = new Set(LIGHTS.map((l) => (dir > 0 ? l : N - 1 - l)));
  for (let j = 0; j < N; j++) { const i = dir > 0 ? j : N - 1 - j, s = i * DS, urban = s < 2500 || s > LEN - 2500; v[j] = Math.min(urban ? 11 : 21.5, Math.sqrt(2.6 / Math.max(Math.abs(K[i]), 1e-4)), 24); if (lightAt.has(j)) v[j] = 0; }
  v[0] = 0; v[N - 1] = 0;
  for (let j = 0; j < N - 1; j++) v[j + 1] = Math.min(v[j + 1], Math.sqrt(v[j] * v[j] + 2 * 2.0 * DS));
  for (let j = N - 1; j > 0; j--) v[j - 1] = Math.min(v[j - 1], Math.sqrt(v[j] * v[j] + 2 * 3.0 * DS));
  const A = new Float32Array(N), Dp = new Float32Array(N), dwell = new Float32Array(N); let t = 0;
  for (let j = 0; j < N; j++) { A[j] = t; dwell[j] = lightAt.has(j) ? 8 : 0; Dp[j] = t + dwell[j]; t = Dp[j] + (j < N - 1 ? 2 * DS / Math.max(0.8, v[j] + v[j + 1]) : 0); }
  const stops = [...lightAt].map((j) => ({ j, a: A[j], d: Dp[j] }));
  return { v, A, Dp, total: t, stops };
}
const PROF = { 1: profile(1), '-1': profile(-1) };
function sample(dir, u) {
  const P = PROF[dir], T = u * P.total; let lo = 0, hi = N - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P.A[m] <= T) lo = m; else hi = m - 1; }
  const j = lo; if (T < P.Dp[j] || j >= N - 1) return { j, f: 0, v: 0, T };
  const f = clamp((T - P.Dp[j]) / Math.max(1e-4, P.A[j + 1] - P.Dp[j]), 0, 1);
  return { j, f, v: lerp(P.v[j], P.v[j + 1], f), T };
}

/* ---------- builder ---------- */
export function createDrive({ scene, camera, getStation }) {
  const W = new THREE.Group(); W.position.set(OFF, 0, 0); W.visible = false; scene.add(W);
  const api = { active: false, mode: 'fpv', speed: 0, blink: 0 };

  // ground + road ribbon
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std('#7d8a5a', { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; W.add(ground);
  const rc = document.createElement('canvas'); rc.width = 512; rc.height = 256; { const g = rc.getContext('2d'), U = (a) => (a + 9.5) / 19 * 512;
    g.fillStyle = '#8a7a5c'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#3d4046'; g.fillRect(U(-7.7), 0, U(7.7) - U(-7.7), 256);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() * 0.05})`; g.fillRect(rnd() * 512, rnd() * 256, 1.5, 1.5); }
    g.fillStyle = '#e8e8e2'; g.fillRect(U(-7.5), 0, 5, 256); g.fillRect(U(7.5) - 5, 0, 5, 256);
    g.fillStyle = '#f1c40f'; g.fillRect(U(-0.22), 0, 4, 256); g.fillRect(U(0.22) - 4, 0, 4, 256);
    g.fillStyle = '#e8e8e2'; for (const a of [-3.65, 3.65]) for (let y = 0; y < 256; y += 128) g.fillRect(U(a) - 2.5, y, 5, 64); }
  const roadTex = new THREE.CanvasTexture(rc); roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.colorSpace = THREE.SRGBColorSpace; roadTex.anisotropy = 8;
  { const pos = [], uv = [], idx = [], HW = 9.5; for (let i = 0; i < N; i++) { const p = at(i * DS); pos.push(p.x + p.tz * HW, 0, p.z - p.tx * HW, p.x - p.tz * HW, 0, p.z + p.tx * HW); uv.push(1, i * DS / 24, 0, i * DS / 24); if (i < N - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const road = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 })); road.receiveShadow = true; road.frustumCulled = false; W.add(road); }

  // instanced scenery
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; W.add(m); return m; };
  const place = (m, x, y, z, sx, sy, sz, ry, c) => { dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix(); m.setMatrixAt(m.count, dummy.matrix); if (c) m.setColorAt(m.count, col.set(c)); m.count++; };
  const fc = document.createElement('canvas'), fe = document.createElement('canvas'); fc.width = fe.width = 128; fc.height = fe.height = 256;
  { const a = fc.getContext('2d'), b = fe.getContext('2d'); a.fillStyle = '#e6e2da'; a.fillRect(0, 0, 128, 256); b.fillStyle = '#000'; b.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 250; y += 26) for (let x = 8; x < 120; x += 24) { a.fillStyle = '#5e7a96'; a.fillRect(x, y, 14, 16); if (rnd() > 0.55) { b.fillStyle = rnd() > 0.5 ? '#ffd9a0' : '#cfe4ff'; b.fillRect(x, y, 14, 16); } } }
  const ft = new THREE.CanvasTexture(fc), fet = new THREE.CanvasTexture(fe); ft.colorSpace = fet.colorSpace = THREE.SRGBColorSpace;
  const bMat = new THREE.MeshStandardMaterial({ map: ft, emissiveMap: fet, emissive: '#fff', emissiveIntensity: 0, roughness: 0.8 });
  const bld = inst(new THREE.BoxGeometry(1, 1, 1), bMat, 4200), trunk = inst(new THREE.CylinderGeometry(0.18, 0.26, 3, 6), std('#5a4130', { roughness: 1 }), 3200), crown = inst(new THREE.SphereGeometry(2.2, 10, 8), std('#3f7d4a', { roughness: 1 }), 3200);
  const barrier = inst(new THREE.BoxGeometry(6, 0.8, 0.5), std('#b9bcc2', { roughness: 0.8 }), 5200), pole = inst(new THREE.CylinderGeometry(0.09, 0.13, 9, 8), std('#2a2f3d', { metalness: 0.7, roughness: 0.4 }), 900);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fff3d0', toneMapped: false }), lamps = inst(new THREE.BoxGeometry(1.1, 0.14, 0.4), lampMat, 1800);
  for (let s = 20; s < LEN - 20; s += 14 + rnd() * 18) {
    const urban = s < 3500 || s > LEN - 3500 ? 1 : 0.35 + 0.35 * Math.sin(s / 1900), p = at(s), ry = Math.atan2(-p.tz, p.tx);
    for (const side of [-1, 1]) { if (rnd() > 0.45 + urban * 0.5) continue; const a = side * (14 + rnd() * (urban > 0.7 ? 14 : 36)), c = lanePos(s, a), h = 5 + rnd() * (urban > 0.7 ? 26 : 9);
      if (bld.count < 4200) place(bld, c.x, h / 2, c.z, 9 + rnd() * 14, h, 9 + rnd() * 12, ry, ['#d8cfc2', '#c9d3da', '#e8e0d2', '#bfc7b8', '#dccfc0'][(rnd() * 5) | 0]); }
  }
  for (let s = 10; s < LEN - 10; s += 11 + rnd() * 16) for (const side of [-1, 1]) { if (rnd() > 0.55 || trunk.count >= 3200) continue; const c = lanePos(s, side * (10.5 + rnd() * 5)), h = 0.8 + rnd() * 0.6; place(trunk, c.x, 1.5, c.z, 1, 1, 1, 0); place(crown, c.x, 4.2 + h, c.z, h, h * 0.9, h, rnd() * 3, ['#3f7d4a', '#4f8f52', '#2f6b3f'][(rnd() * 3) | 0]); }
  for (let s = 3; s < LEN - 6; s += 6) { const c = lanePos(s, 0), ry = Math.atan2(-c.tz, c.tx); if (barrier.count < 5200) place(barrier, c.x, 0.4, c.z, 1, 1, 1, ry); }
  for (let s = 18; s < LEN - 10; s += 38) { const c = lanePos(s, 0), ry = Math.atan2(-c.tz, c.tx); if (pole.count >= 900) break; place(pole, c.x, 4.5, c.z, 1, 1, 1, 0); for (const a of [-1, 1]) { const l = lanePos(s, a * 0.9); place(lamps, l.x, 8.9, l.z, 1, 1, 1, ry + Math.PI / 2); } }
  for (const m of [bld, trunk, crown, barrier, pole, lamps]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

  // traffic lights
  const lightHeads = LIGHTS.map((j) => { const s = j * DS, g = new THREE.Group(), p = lanePos(s, 8.6), q = lanePos(s, -8.6);
    for (const [c, face] of [[p, 1], [q, -1]]) { const pg = new THREE.Group(); pg.position.set(c.x, 0, c.z); pg.rotation.y = Math.atan2(-c.tz, c.tx) + (face > 0 ? Math.PI : 0) + Math.PI / 2 * 0; const mk = (y, hex) => { const m = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }); const d = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), m); d.position.set(0, y, 0.2); pg.add(d); return m; };
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6.2, 8), std('#2a2f3d', { metalness: 0.7, roughness: 0.4 })); pl.position.y = 3.1; pg.add(pl);
      const bx = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.4), std('#111', { roughness: 0.5 })); bx.position.set(0, 5.4, 0); pg.add(bx);
      pg.userData.r = mk(5.8, '#330000'); pg.userData.y = mk(5.4, '#332200'); pg.userData.g = mk(5.0, '#003300'); g.add(pg); }
    W.add(g); return g; });

  // traffic
  const TN = 70, tcars = Array.from({ length: TN }, (_, i) => ({ opp: i >= 26, lane: (rnd() * 2) | 0, b: rnd() * 900, k: i >= 26 ? -(0.75 + rnd() * 0.4) : 0.78 + rnd() * 0.5, type: rnd() < 0.12 ? 'truck' : rnd() < 0.3 ? 'bike' : 'car', color: ['#c9ccd2', '#2b2f3a', '#8b1d1d', '#1f4a8a', '#e8e6df', '#3a5a40', '#d2a02a'][(rnd() * 7) | 0] }));
  const cBody = inst(new THREE.BoxGeometry(1, 1, 1), std('#fff', { roughness: 0.35, metalness: 0.4 }), TN), cCab = inst(new THREE.BoxGeometry(1, 1, 1), std('#1b2630', { roughness: 0.15, metalness: 0.6 }), TN);
  const cLamp = inst(new THREE.BoxGeometry(0.3, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false }), TN * 4);

  /* ---------- our car: exterior + cockpit ---------- */
  const car = new THREE.Group(); W.add(car);
  const ext = PR.makeCar(car, { glows: [] }, { body: '#aab3bd' }); ext.car.scale.setScalar(0.38); ext.car.rotation.y = Math.PI / 2; ext.car.position.set(0, 0, 0); ext.head.visible = ext.hair.visible = false;
  const dashG = new THREE.Group(); car.add(dashG);
  const D = (g, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); dashG.add(m); return m; };
  const soft = std('#15171b', { roughness: 0.85 }), trim = std('#8c929c', { metalness: 0.85, roughness: 0.3 }), glossB = std('#0a0b0e', { roughness: 0.2, metalness: 0.4 });
  const HEAD = new THREE.Vector3(0.38, 1.2, 0.2);
  D(new THREE.BoxGeometry(1.56, 0.2, 0.55), soft, 0, 0.93, -0.8); D(new THREE.BoxGeometry(1.56, 0.5, 0.2), soft, 0, 0.75, -0.55); D(new THREE.BoxGeometry(1.4, 0.04, 0.05), trim, 0, 0.88, -0.52);
  for (const x of [-0.45, -0.05]) D(new THREE.BoxGeometry(0.16, 0.05, 0.03), glossB, x, 0.9, -0.54);
  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, g: c.getContext('2d'), t }; };
  const clu = cvs(512, 160), scr = cvs(512, 320);
  D(new THREE.PlaneGeometry(0.5, 0.155), new THREE.MeshBasicMaterial({ map: clu.t, toneMapped: false }), 0.38, 1.1, -0.76, -0.2, 0, 0); D(new THREE.BoxGeometry(0.53, 0.18, 0.04), glossB, 0.38, 1.1, -0.785, -0.2);
  D(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshBasicMaterial({ map: scr.t, toneMapped: false }), 0.0, 1.04, -0.78, -0.18, 0.35, 0); D(new THREE.BoxGeometry(0.43, 0.28, 0.04), glossB, 0.0, 1.04, -0.805, -0.18, 0.35);
  const wheel = new THREE.Group(); wheel.position.set(0.38, 0.98, -0.5); wheel.rotation.x = -0.5; dashG.add(wheel);
  const wm = std('#101114', { roughness: 0.7 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 12, 48), wm); rim.scale.set(1, 0.88, 1); wheel.add(rim);
  for (const a of [Math.PI, 0, -Math.PI / 2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.02), wm); sp.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0); sp.rotation.z = a; wheel.add(sp); }
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20), std('#2a2d33', { metalness: 0.8, roughness: 0.3 })).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) { D(new THREE.BoxGeometry(0.06, 0.75, 0.1), soft, s * 0.74, 1.33, -0.55, 0.0, 0, s * 0.35).rotation.x = -0.65; D(new THREE.BoxGeometry(0.1, 0.1, 0.9), glossB, s * 0.86, 1.0, -0.1); D(new THREE.BoxGeometry(0.16, 0.1, 0.1), soft, s * 0.98, 1.05, -0.75); }
  D(new THREE.BoxGeometry(1.5, 0.05, 0.9), soft, 0, 1.72, -0.1); D(new THREE.BoxGeometry(1.5, 0.08, 0.1), soft, 0, 1.64, -0.58);
  D(new THREE.BoxGeometry(0.24, 0.07, 0.03), glossB, 0.05, 1.5, -0.62); D(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6), trim, 0.05, 1.56, -0.6);
  const hood = D(new THREE.BoxGeometry(1.6, 0.06, 1.5), std('#7e8791', { metalness: 0.9, roughness: 0.25 }), 0, 0.93, -1.6, -0.06);
  const wipers = [0.0, 0.4].map((x) => D(new THREE.BoxGeometry(0.6, 0.015, 0.02), glossB, -0.1 + x, 0.97, -1.1));
  for (const x of [-0.3, 0.0, 0.3, 0.6]) D(new THREE.BoxGeometry(0.07, 0.014, 0.03), trim, x - 0.15, 0.95, -0.56);
  for (const m of [ext.car]) m.visible = false;
  const hl = [-0.6, 0.6].map((x) => { const s = new THREE.SpotLight('#fff4dc', 0, 90, 0.55, 0.5, 1.2); s.position.set(x, 0.8, -1.9); car.add(s); const t = new THREE.Object3D(); t.position.set(x * 0.5, 0.3, -30); car.add(t); s.target = t; return s; });

  // ---- per-frame ----
  let steer = 0, hAng = 0, lastH = 0, blinkT = 0, scrT = 0, odo = 0, lastFx = 0, camPos = new THREE.Vector3(), camInit = false;
  const hourStr = (h) => String(Math.floor(h) % 24).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0');
  const arrow = (g, x, y, ang, col) => { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 12); g.lineTo(0, 7); g.lineTo(-10, 12); g.closePath(); g.fill(); g.restore(); };
  function drawCluster(kmh, rpm, gear, bl, hour) {
    const g = clu.g; g.fillStyle = '#05070b'; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#1b2433'; g.lineWidth = 12; g.beginPath(); g.arc(256, 150, 108, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.strokeStyle = kmh > 100 ? '#ff6b6b' : '#6fd1ff'; g.beginPath(); g.arc(256, 150, 108, Math.PI * 1.1, Math.PI * (1.1 + 0.8 * clamp(kmh / 140))); g.stroke();
    g.fillStyle = '#e9f0ff'; g.font = '700 64px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center'; g.fillText(String(Math.round(kmh)), 256, 112); g.font = '16px sans-serif'; g.fillStyle = '#7f93b8'; g.fillText('km/h', 256, 134);
    g.textAlign = 'left'; g.font = '700 26px sans-serif'; g.fillStyle = '#ffd166'; g.fillText(gear, 30, 56); g.font = '14px sans-serif'; g.fillStyle = '#7f93b8'; g.fillText(Math.round(rpm) + ' rpm', 30, 84); g.fillText(hourStr(hour), 30, 120);
    g.textAlign = 'right'; g.fillStyle = '#9ef0b0'; g.fillText((odo / 1000).toFixed(1) + ' km', 482, 56); g.fillText('ECO', 482, 84);
    if (bl) { g.fillStyle = '#35ff7a'; g.font = '700 38px sans-serif'; g.textAlign = 'center'; g.fillText(bl < 0 ? '<' : '>', bl < 0 ? 70 : 442, 130); }
    clu.t.needsUpdate = true;
  }
  function drawScreen(j, dir, kmh, ahead, hour, remain) {
    const g = scr.g; g.fillStyle = '#0c1220'; g.fillRect(0, 0, 512, 320);
    g.save(); g.beginPath(); g.rect(0, 40, 512, 220); g.clip(); g.translate(256, 210);
    const ci = dir > 0 ? j : N - 1 - j, hx = dir > 0 ? TX[ci] : -TX[ci], hz = dir > 0 ? TZ[ci] : -TZ[ci], sc = 0.28, ang = Math.atan2(hx, -hz);   // heading up
    g.strokeStyle = '#2a3a58'; g.lineWidth = 16; g.lineJoin = g.lineCap = 'round'; g.beginPath(); let first = true;
    for (let q = -60; q < 260; q += 2) { const k = clamp(ci + q * dir, 0, N - 1) | 0, dx = X[k] - X[ci], dz = Z[k] - Z[ci], rx = dx * Math.cos(ang) - dz * Math.sin(ang), rz = dx * Math.sin(ang) + dz * Math.cos(ang); const px = rx * sc, py = rz * sc; first ? g.moveTo(px, py) : g.lineTo(px, py); first = false; } g.stroke();
    g.strokeStyle = '#4aa8ff'; g.lineWidth = 6; g.stroke(); g.restore();
    arrow(g, 256, 210, 0, '#ffffff');
    g.fillStyle = '#121a2e'; g.fillRect(0, 0, 512, 40); g.fillStyle = '#e9f0ff'; g.font = '700 20px sans-serif'; g.textAlign = 'left'; g.fillText(getStation().name, 14, 27); g.textAlign = 'right'; g.fillStyle = '#7f93b8'; g.font = '16px sans-serif'; g.fillText(getStation().title, 498, 27);
    g.fillStyle = '#121a2e'; g.fillRect(0, 260, 512, 60); g.textAlign = 'left'; g.fillStyle = '#e9f0ff'; g.font = '700 22px sans-serif'; g.fillText((remain / 1000).toFixed(1) + ' km', 14, 296); g.fillStyle = '#7f93b8'; g.font = '16px sans-serif'; g.fillText('ETA ' + hourStr(hour + remain / 13000), 130, 296);
    g.textAlign = 'right'; g.fillStyle = ahead ? '#ffd166' : '#6fd1ff'; g.font = '700 22px sans-serif'; g.fillText(ahead ? (ahead < 0 ? 'Turn left' : 'Turn right') : 'Keep straight', 498, 296);
    scr.t.needsUpdate = true;
  }
  const v3 = new THREE.Vector3(), look = new THREE.Vector3(), mat4 = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);

  api.update = (dir, u, dt, t, view, mode, dark, hour, rain) => {
    api.active = true; W.visible = true; api.mode = mode;
    const sm_ = sample(dir, u), j = sm_.j, i = dir > 0 ? j : N - 1 - j, f = sm_.f, ii = clamp(dir > 0 ? i + f : i - f, 0, N - 1.001), s = ii * DS;
    const a = dir > 0 ? LANE[0] : -LANE[0], p = lanePos(s, a), tx = dir > 0 ? p.tx : -p.tx, tz = dir > 0 ? p.tz : -p.tz;
    const hd = Math.atan2(-tx, -tz), kmh = sm_.v * 3.6; api.speed = kmh;
    car.position.set(p.x, 0, p.z); car.rotation.y = hd;
    let dh = hd - lastH; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; lastH = hd; hAng += (dh / Math.max(dt, 1e-3) * 0.02 - hAng) * Math.min(1, dt * 4);
    steer += ((-p.k * (dir > 0 ? 1 : -1)) * 28 * Math.min(1, kmh / 30 + 0.2) - steer) * Math.min(1, dt * 6); wheel.rotation.z = clamp(steer, -2.4, 2.4);
    odo = (dir > 0 ? s : LEN - s) * 1; 
    // upcoming turn for the indicator + nav
    let ahead = 0; for (let q = 10; q < 70; q += 6) { const k = clamp(ci2(i, dir, q), 0, N - 1) | 0; const kk = K[k] * (dir > 0 ? 1 : -1); if (Math.abs(kk) > 0.012) { ahead = kk > 0 ? 1 : -1; break; } }
    ahead = -ahead; api.blink = ahead;
    blinkT += dt; const bl = ahead && Math.floor(blinkT * 2.5) % 2 ? ahead : 0;
    // cockpit view / cameras
    const showDash = mode === 'fpv'; dashG.visible = showDash; ext.car.visible = !showDash;
    car.updateMatrixWorld(true);
    if (mode === 'fpv') {
      v3.copy(HEAD); v3.y += Math.sin(s * 0.9) * 0.004 * Math.min(1, kmh / 40) + Math.sin(t * 2.3) * 0.003; car.localToWorld(v3);
      const yaw = hd + view.yaw, pit = -view.pitch * 0.9 - 0.03 + (kmh > 1 ? Math.sin(s * 0.7) * 0.0015 : 0);
      camera.position.copy(v3); look.set(-Math.sin(yaw) * Math.cos(pit), Math.sin(pit), -Math.cos(yaw) * Math.cos(pit)).add(v3); camera.lookAt(look); camera.rotateZ(clamp(-hAng * 1.2, -0.05, 0.05));
    } else {
      const yaw = hd + (mode === 'bird' ? view.yaw : view.yaw), back = mode === 'bird' ? 12 : 9.5, up = mode === 'bird' ? 36 : 3.4, tgt = new THREE.Vector3(p.x - 0, 1, p.z);
      v3.set(p.x + Math.sin(yaw) * back, up + view.pitch * 8, p.z + Math.cos(yaw) * back); if (!camInit) { camPos.copy(v3); camInit = true; } camPos.lerp(v3, Math.min(1, dt * 5)); camera.position.copy(camPos); look.set(p.x - Math.sin(hd) * (mode === 'bird' ? 3 : 4), 1.2, p.z - Math.cos(hd) * (mode === 'bird' ? 3 : 4)); camera.lookAt(look);
    }
    // instruments @ ~10 Hz
    if (t - lastFx > 0.1) { lastFx = t; const rpm = 800 + kmh * 28 + (kmh > 1 ? 150 : 0), gear = kmh < 1 ? 'N' : 'D' + Math.min(6, 1 + Math.floor(kmh / 22)); drawCluster(kmh, rpm, gear, bl, hour); drawScreen(j, dir, kmh, ahead, hour, LEN - odo); }
    wipers.forEach((w, k) => { w.rotation.z = rain > 0.1 ? Math.sin(t * 4.5 + k * 0.1) * 0.7 - 0.4 : -0.05; });
    hl.forEach((h) => (h.intensity = dark * 900));
    // lights, windows, lamps
    bMat.emissiveIntensity = dark * 1.4; lampMat.color.set('#fff3d0').multiplyScalar(0.25 + dark * 3);
    const tNow = sm_.T, P = PROF[dir];
    lightHeads.forEach((g, k) => { const stop = P.stops.find((st) => st.j === (dir > 0 ? LIGHTS[k] : N - 1 - LIGHTS[k])); const red = stop && tNow > stop.a - 9 && tNow < stop.d; g.children.forEach((pg) => { pg.userData.r.color.set(red ? '#ff2a2a' : '#330000'); pg.userData.y.color.set('#332200'); pg.userData.g.color.set(red ? '#003300' : '#2dff6a'); }); });
    // traffic
    const prog = dir > 0 ? s : LEN - s; let bi = 0, li = 0; cBody.count = cCab.count = 0; cLamp.count = 0;
    for (const c of tcars) {
      let rel = ((c.b + (c.k - 1) * prog) % 900 + 900) % 900 - 300; let lane = c.lane; if (!c.opp && lane === 0 && Math.abs(rel) < 14) lane = 1;
      const tr = prog + rel; if (tr < 5 || tr > LEN - 5 || Math.abs(rel) > 420) continue;
      const fs = dir > 0 ? tr : LEN - tr, sign = (c.opp ? -1 : 1) * (dir > 0 ? 1 : -1), pos = lanePos(fs, sign * LANE[lane]), ry = Math.atan2(-pos.tz, pos.tx) + (sign > 0 ? 0 : Math.PI);
      const [L_, W_, H_, Y_] = c.type === 'truck' ? [9, 2.5, 3, 1.9] : c.type === 'bike' ? [1.9, 0.7, 1.2, 0.7] : [4.4, 1.8, 1.4, 0.8];
      dummy.position.set(pos.x, Y_, pos.z); dummy.rotation.set(0, ry, 0); dummy.scale.set(L_, H_ * (c.type === 'car' ? 0.62 : 0.9), W_); dummy.updateMatrix(); cBody.setMatrixAt(bi, dummy.matrix); cBody.setColorAt(bi, col.set(c.color));
      dummy.position.set(pos.x - Math.cos(ry) * 0.2 * (c.type === 'car' ? 1 : 0), Y_ + H_ * 0.5, pos.z + Math.sin(ry) * 0.2 * (c.type === 'car' ? 1 : 0)); dummy.scale.set(c.type === 'car' ? L_ * 0.5 : 0.01, c.type === 'car' ? H_ * 0.45 : 0.01, W_ * 0.9); dummy.updateMatrix(); cCab.setMatrixAt(bi, dummy.matrix); bi++;
      for (const [fx, sy, hex] of [[L_ / 2, 1, '#fff6d8'], [-L_ / 2, 1, '#ff2020']]) for (const sz of [-1, 1]) { dummy.position.set(pos.x + Math.cos(ry) * fx, Y_ + 0.1, pos.z - Math.sin(ry) * fx + Math.cos(ry) * sz * W_ * 0.36); dummy.rotation.set(0, ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); cLamp.setMatrixAt(li, dummy.matrix); cLamp.setColorAt(li, col.set(hex)); li++; }
    }
    cBody.count = cCab.count = bi; cLamp.count = li; for (const m of [cBody, cCab, cLamp]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    ground.position.x = camera.position.x - OFF; ground.position.z = camera.position.z;
    return { x: camera.position.x, y: camera.position.y };
  };
  const ci2 = (i, dir, q) => i + q * dir;
  api.hide = () => { api.active = false; W.visible = false; camInit = false; };
  api.length = LEN;
  return api;
}
