// The VTOXI lab: an original hidden electronics lab behind the living-room bookshelf.
import * as THREE from 'three';
import { mat, box, slab, cyl, sph, mesh, canvasTex, screen, labelSprite, labelTexture, wisps, batch, lerp, clamp, smooth, seg } from './util.js';
import { applyPose, SOLDER } from './figures.js';
import { CHAPTERS, L } from './story.js';
import { meState } from './actor.js';
import * as PR from './props.js';
import { std, phys, M } from './materials.js';

const HB = CHAPTERS.find((c) => c.id === 'hobby');
const BT = 1.7; // bench surface

/* ---------- screen textures ---------- */
function ledMatrix(seed) {
  return canvasTex(128, 192, (c, w, h, t) => {
    c.fillStyle = '#05070d'; c.fillRect(0, 0, w, h);
    const cols = ['#5dffb0', '#ffd24d', '#ff5d7a', '#6fd6ff'];
    for (let j = 0; j < 24; j++) for (let i = 0; i < 16; i++) {
      const v = Math.sin(i * 1.7 + j * 2.3 + t * (2 + seed % 3) + seed) + Math.sin(j * 0.9 - t * 3.1 + seed * 2);
      c.fillStyle = v > 0.85 ? cols[(i + j + seed) % 4] : '#0d121c'; c.fillRect(i * 8 + 1, j * 8 + 1, 6, 6);
    }
  });
}
function tankDash(getLevel) {
  return canvasTex(768, 450, (c, w, h, t) => {
    c.fillStyle = '#0a1128'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#9fb3ff'; c.font = '600 28px system-ui, sans-serif'; c.fillText('Smart Water Level Monitor', 32, 52);
    const lv = getLevel();
    c.fillStyle = '#fff'; c.font = '700 126px system-ui, sans-serif'; c.fillText(Math.round(lv * 100) + '%', 32, 220);
    c.fillStyle = '#18224a'; c.beginPath(); c.roundRect(32, 262, w - 64, 32, 16); c.fill();
    c.fillStyle = '#3aa0ff'; c.beginPath(); c.roundRect(32, 262, (w - 64) * lv, 32, 16); c.fill();
    c.strokeStyle = '#3ddc84'; c.lineWidth = 4; c.beginPath();
    for (let i = 0; i < 80; i++) { const x = 32 + (i / 79) * (w - 64), y = 400 - (0.5 + 0.5 * Math.sin(i * 0.18 + t * 1.2) * 0.8) * 80; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.fillStyle = '#3ddc84'; c.beginPath(); c.arc(w - 50, 44, 9, 0, 7); c.fill(); c.fillStyle = '#9fb3ff'; c.font = '20px system-ui'; c.fillText('MQTT', w - 130, 52);
    c.fillStyle = Math.floor(t * 2) % 2 ? '#ffb703' : '#776'; c.font = '600 24px system-ui'; c.fillText(lv > 0.8 ? 'Pump off' : 'Pump on', 520, 180);
  });
}
function sentinelFeed() {
  return canvasTex(600, 450, (c, w, h, t) => {
    const g = c.createLinearGradient(0, 0, 0, 190); g.addColorStop(0, '#1b2a4d'); g.addColorStop(1, '#4a5f8f'); c.fillStyle = g; c.fillRect(0, 0, w, 200);
    c.fillStyle = '#2b2f3c'; c.fillRect(0, 200, w, 250);
    c.fillStyle = '#e8e8e8'; for (let i = 0; i < 6; i++) { const k = ((i / 6 + t * 0.35) % 1), y = 200 + k * k * 250, ww = 6 + k * 40, hh = 4 + k * 34; c.fillRect(w / 2 - ww / 2, y, ww, hh); }
    c.fillStyle = '#10141f'; c.beginPath(); c.moveTo(0, 200); c.lineTo(80, 130); c.lineTo(140, 200); c.fill(); c.beginPath(); c.moveTo(w, 200); c.lineTo(w - 90, 120); c.lineTo(w - 160, 200); c.fill();
    c.fillStyle = '#9fb3ff'; c.font = '600 26px system-ui'; c.fillText('CarSentinel', 20, 42);
    if (Math.floor(t * 1.5) % 2) { c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(w - 100, 34, 10, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.font = '600 22px system-ui'; c.fillText('REC', w - 80, 42);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '19px ui-monospace, monospace'; c.fillText('motion: none   temp: 31C   gps: lock', 20, h - 20);
  });
}
function homeScreen() {
  return canvasTex(768, 450, (c, w, h, t) => {
    c.fillStyle = '#0b1220'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#9fb3ff'; c.font = '600 28px system-ui'; c.fillText('layout-map   openHAB sync', 32, 50);
    c.strokeStyle = '#6fd6ff'; c.lineWidth = 4; c.strokeRect(40, 80, 400, 300); c.beginPath(); c.moveTo(240, 80); c.lineTo(240, 250); c.moveTo(40, 250); c.lineTo(160, 250); c.moveTo(300, 250); c.lineTo(440, 250); c.stroke();
    const dev = [[110, 150, 'lamp'], [340, 150, 'fan'], [120, 320, 'door'], [360, 320, 'pump']];
    dev.forEach(([x, y, n], i) => { const on = Math.sin(t * 0.8 + i * 1.7) > -0.2; c.fillStyle = on ? '#ffd24d' : '#3a4256'; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill(); c.fillStyle = '#cfe2ff'; c.font = '18px system-ui'; c.fillText(n, x - 16, y + 40); });
    ['Living', 'Kitchen', 'Garage'].forEach((n, i) => { c.fillStyle = '#16203a'; c.beginPath(); c.roundRect(480, 100 + i * 90, 250, 70, 14); c.fill(); c.fillStyle = '#cfe2ff'; c.font = '600 24px system-ui'; c.fillText(n, 504, 144 + i * 90); c.fillStyle = Math.sin(t + i) > 0 ? '#3ddc84' : '#556'; c.beginPath(); c.arc(700, 135 + i * 90, 11, 0, 7); c.fill(); });
  });
}
const copperTex = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#b87333'; x.fillRect(0, 0, 64, 512); for (let y = 0; y < 512; y += 4) { x.fillStyle = y % 8 ? '#d28a4a' : '#8a4f22'; x.fillRect(0, y, 64, 3); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; };

export function buildLab(root, ctx, { me, ups }) {
  const X0 = L.labX0, X1 = L.labX1;
  const LZ = new THREE.Group(); root.add(LZ);
  const dynG = () => { const g = new THREE.Group(); g.userData.dyn = true; root.add(g); return g; };
  const lampMats = [];             // emissive materials scaled by lab power
  const em = (color, base) => { const m = new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: base }); lampMats.push({ m, base }); return m; };

  /* ---------- shell ---------- */
  PR.room(LZ, X0, X1, { wall: '#202b42', floor: 'concrete', floorColor: '#a3abbb', h: 12, trim: '#2f3a52', ceiling: true });
  slab(LZ, X1 - X0 - 0.6, 2.4, 0.24, M.brushed('#6f7a90'), (X0 + X1) / 2, 1.2, -4.05, 4);
  for (let x = X0 + 6; x < X1; x += 9) box(LZ, 0.18, 10, 0.2, std('#3a4766', { metalness: 0.7, roughness: 0.35 }), x, 6, -4.05);
  for (let x = X0 + 1; x < X1 - 1; x += 1.6) { box(LZ, 0.8, 0.02, 0.5, std(Math.round((x - X0) / 1.6) % 2 ? '#f2b705' : '#15171c', { roughness: 0.6 }), x, 0.01, 4.1); }
  const pipeM = std('#b87333', { metalness: 1, roughness: 0.32 }), steelM = M.brushed('#9aa4b8');
  for (const [z, r, m] of [[-3.2, 0.34, pipeM], [-2.5, 0.22, steelM]]) { const p = cyl(LZ, r, r, X1 - X0 - 1, m, (X0 + X1) / 2, 11.2, z); p.rotation.z = Math.PI / 2; for (let x = X0 + 4; x < X1; x += 8) { const f = cyl(LZ, r * 1.35, r * 1.35, 0.3, steelM, x, 11.2, z); f.rotation.z = Math.PI / 2; } }
  box(LZ, X1 - X0 - 1, 0.18, 1.0, std('#2a3042', { metalness: 0.8, roughness: 0.4 }), (X0 + X1) / 2, 11.7, -1.0);
  const stripM = [];
  for (let x = X0 + 9; x < X1 - 3; x += 14) { const m = em('#d6ecff', 4); stripM.push(m); box(LZ, 6.5, 0.14, 0.7, m, x, 11.75, 1.6).castShadow = false; }
  // neon sign
  const sign = labelTexture('vtoxi lab', { fg: '#7ff3ff', font: '800 120px "Bricolage Grotesque", system-ui, sans-serif', pad: 22 });
  const signMat = new THREE.MeshBasicMaterial({ map: sign.tex, transparent: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2), depthWrite: false });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9 * sign.aspect, 1.9), signMat); signMesh.position.set(197.6, 9.6, -3.9); root.add(signMesh);
  // blueprints
  const bp = (x, y, w, h, seed) => {
    const t = canvasTex(512, Math.round(512 * h / w), (c, W, H) => { c.fillStyle = '#16407a'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(190,225,255,.5)'; c.lineWidth = 1.5; for (let i = 0; i < W; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H); c.stroke(); } for (let j = 0; j < H; j += 32) { c.beginPath(); c.moveTo(0, j); c.lineTo(W, j); c.stroke(); } c.strokeStyle = '#d8ecff'; c.lineWidth = 3; for (let k = 0; k < 7; k++) { const px = 40 + ((k * 71 + seed * 37) % 340), py = 40 + ((k * 53 + seed * 19) % (H - 100)); c.strokeRect(px, py, 60 + (k % 3) * 30, 36 + (k % 2) * 24); c.beginPath(); c.moveTo(px + 60, py + 18); c.lineTo(px + 120, py + 18 + (k % 3) * 14); c.stroke(); } c.fillStyle = '#d8ecff'; c.font = '600 18px ui-monospace, monospace'; c.fillText('VTOXI-' + (100 + seed * 7) + '  SCHEMATIC', 24, H - 20); });
    box(LZ, w + 0.2, h + 0.2, 0.08, std('#cfd6e4', { metalness: 0.6 }), x, y, -4.05); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t.tex, color: new THREE.Color(0.9, 0.9, 0.95) })); m.position.set(x, y, -3.99); LZ.add(m);
  };
  bp(214, 7.2, 3.2, 2.2, 1); bp(218.5, 7.2, 3.2, 2.2, 2); bp(223, 7.2, 3.2, 2.2, 3);

  /* ---------- mainframe wall ---------- */
  const mats = [ledMatrix(1), ledMatrix(2), ledMatrix(3)], reels = [], dials = [];
  for (let i = 0; i < 5; i++) {
    const cx = 191.8 + i * 3.2;
    box(LZ, 3.0, 7.8, 1.9, std('#2a3347', { metalness: 0.7, roughness: 0.38 }), cx, 4.0, -3.2);
    box(LZ, 2.7, 7.4, 0.08, M.brushed('#8d98ae'), cx, 4.0, -2.22);
    const m = mats[i % 3]; const s = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.0), new THREE.MeshBasicMaterial({ map: m.tex, toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2) })); s.position.set(cx, 5.3, -2.17); LZ.add(s); s.userData.screenMat = true;
    for (let k = 0; k < 6; k++) box(LZ, 0.2, 0.34, 0.2, std('#d8dde8', { metalness: 1, roughness: 0.3 }), cx - 1.0 + k * 0.4, 3.0, -2.1);
    for (let k = 0; k < 6; k++) { const m = em(['#5dffb0', '#ff5d7a', '#ffd24d'][k % 3], 2); lampMats.push({ m, base: 2 }); sph(LZ, 0.07, m, cx - 1.0 + k * 0.4, 2.55, -2.12, undefined, 10); }
    if (i === 1 || i === 3) for (const dx of [-0.65, 0.65]) { const r = new THREE.Group(); r.position.set(cx + dx, 1.5, -2.1); r.userData.dyn = true; root.add(r); cyl(r, 0.55, 0.55, 0.1, std('#d0d4dc', { metalness: 1, roughness: 0.3 }), 0, 0, 0).rotation.x = Math.PI / 2; cyl(r, 0.14, 0.14, 0.14, std('#1a1a1f'), 0, 0, 0.06).rotation.x = Math.PI / 2; for (let k = 0; k < 3; k++) { const sp = box(r, 0.08, 0.9, 0.04, std('#2a2d35'), 0, 0, 0.06); sp.rotation.z = k * Math.PI / 3; sp.userData.dyn = true; } reels.push(r); }
    else { const d = new THREE.Group(); d.position.set(cx, 1.5, -2.1); d.userData.dyn = true; root.add(d); cyl(d, 0.42, 0.42, 0.12, std('#1a1d25', { metalness: 0.5 }), 0, 0, 0).rotation.x = Math.PI / 2; const nd = box(d, 0.05, 0.36, 0.04, '#ff5d5d', 0, 0.16, 0.08); nd.userData.dyn = true; dials.push(d); }
  }
  /* ---------- Tesla coil ---------- */
  const TC = { x: 197.2, z: -0.2 };
  box(LZ, 2.8, 0.9, 2.8, std('#252c3d', { metalness: 0.8, roughness: 0.35 }), TC.x, 0.45, TC.z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(LZ, 0.2, 0.2, 1.4, std('#cfe6f5', { transparent: true, opacity: 0.4, roughness: 0.03, clearcoat: 1 }), TC.x + dx * 0.95, 1.6, TC.z + dz * 0.95);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.16, 0.04, 10, 48), pipeM); r.rotation.x = Math.PI / 2; r.position.set(TC.x, 2.4 + i * 0.07, TC.z); r.castShadow = true; LZ.add(r); }
  const ct = copperTex(); ct.repeat.set(1, 1);
  cyl(LZ, 0.52, 0.52, 4.6, new THREE.MeshStandardMaterial({ map: ct, metalness: 0.9, roughness: 0.35 }), TC.x, 5.0, TC.z);
  const topLoad = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.46, 32, 64), std('#e4e8ef', { metalness: 1, roughness: 0.08 })); topLoad.rotation.x = Math.PI / 2; topLoad.position.set(TC.x, 7.55, TC.z); topLoad.castShadow = true; LZ.add(topLoad);
  sph(LZ, 0.3, std('#e4e8ef', { metalness: 1, roughness: 0.08 }), TC.x, 8.1, TC.z);
  const gx = TC.x + 3.6; cyl(LZ, 0.06, 0.06, 4.4, steelM, gx, 2.2, TC.z); sph(LZ, 0.34, std('#e4e8ef', { metalness: 1, roughness: 0.08 }), gx, 4.5, TC.z);
  const arcs = Array.from({ length: 5 }, () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(26 * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 1.0, 3.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); l.frustumCulled = false; root.add(l); return l; });

  /* ---------- nixie clock ---------- */
  const nixie = []; const NXx = 203.4;
  box(LZ, 6.8, 1.9, 0.9, std('#2b2f3d', { metalness: 0.8, roughness: 0.35 }), NXx + 2.5, 9.4, -3.6);
  for (let i = 0; i < 6; i++) {
    const x = NXx + i * 1.0 + (i > 1 ? 0.3 : 0) + (i > 3 ? 0.3 : 0), tex = canvasTex(64, 128, () => {}), g = new THREE.Group(); g.position.set(x, 9.4, -3.1); LZ.add(g);
    cyl(g, 0.34, 0.34, 1.4, std('#ffd9a0', { transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1 }), 0, 0, 0, undefined, 24);
    sph(g, 0.34, std('#ffd9a0', { transparent: true, opacity: 0.16, roughness: 0.04 }), 0, 0.7, 0, undefined, 24);
    cyl(g, 0.38, 0.38, 0.2, std('#3a3f4d', { metalness: 0.8 }), 0, -0.8, 0);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.0), new THREE.MeshBasicMaterial({ map: tex.tex, transparent: true, toneMapped: false, color: new THREE.Color(1.8, 1.0, 0.45), depthWrite: false })); plane.position.z = 0.02; g.add(plane);
    nixie.push({ tex, last: -1 });
  }

  /* ---------- bench A ---------- */
  const bx0 = 203, bx1 = 229, bcx = (bx0 + bx1) / 2;
  slab(LZ, bx1 - bx0, 0.26, 4.2, M.deskWood('#5a4636'), bcx, BT - 0.13, -1.5, 3);
  box(LZ, bx1 - bx0, 0.2, 4.2, steelM, bcx, 1.4, -1.5);
  for (const x of [bx0 + 0.4, bcx, bx1 - 0.4]) box(LZ, 0.3, 1.45, 3.9, std('#3b4155', { metalness: 0.8, roughness: 0.35 }), x, 0.72, -1.5);
  for (let i = 0; i < 4; i++) box(LZ, 3.0, 0.9, 0.12, std(['#3b4155', '#d24b3a', '#3b4155', '#2f6fb5'][i], { metalness: 0.6, roughness: 0.4 }), bx0 + 3.2 + i * 3.6, 0.8, 0.45);
  PR.chair(LZ, L.stoolX - 0.2, 0.2, Math.PI / 2, '#3b4a73');
  const scopeTex = PR.scopeTexture(); PR.oscilloscope(LZ, 205.4, BT, -2.0, scopeTex);
  PR.solderStation(LZ, ctx, 220.0, BT, -2.9); PR.solderSpool(LZ, 222.3, BT, -2.6); PR.multimeter(LZ, 216.7, BT, -2.8, 0.15); PR.tweezers(LZ, 214.5, BT + 0.02, 0.0, 0.5);
  PR.magnifierLamp(LZ, 211.6, BT, -2.8);
  PR.resistor(LZ, 216.3, BT + 0.06, 0.1, 0.4, ['#a52a2a', '#111', '#e08a1e', '#d6b04a']); PR.resistor(LZ, 217.1, BT + 0.06, 0.25, -0.3, ['#e08a1e', '#e08a1e', '#a52a2a', '#d6b04a']); PR.resistor(LZ, 217.8, BT + 0.06, -0.05, 1.2, ['#2f6fb5', '#111', '#a52a2a', '#d6b04a']);
  const bb = PR.breadboard(LZ, 219.4, BT, -0.1);
  const piR = PR.rpi(LZ, 224.6, BT, -1.5); const arR = PR.arduino(LZ, 227.6, BT, -1.5);
  const oledT = PR.oledTexture(); PR.oled(LZ, 223.2, BT, 0.1, oledT); PR.servo(LZ, 226.4, BT, 0.3);
  for (const [a, b, col] of [[[221.0, BT + 0.3, 0.1], [224.1, BT + 0.1, -0.5], '#ffb703'], [[221.6, BT + 0.3, 0.1], [226.2, BT + 0.1, -0.8], '#3ddc84'], [[222.2, BT + 0.3, -0.1], [227.0, BT + 0.1, -0.6], '#3b82f6']]) PR.jumper(LZ, new THREE.Vector3(...a), new THREE.Vector3(...b), col, 0.7);
  // component drawers
  const dw = box(LZ, 8.6, 3.6, 1.2, std('#2f3b55', { metalness: 0.5, roughness: 0.4 }), 224.2, 4.8, -3.55);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) { box(LZ, 0.9, 0.7, 0.08, std(['#e04a3f', '#ffb703', '#3ddc84', '#3b82f6', '#c084fc'][(r + c) % 5], { roughness: 0.4 }), 220.4 + c * 1.02, 3.6 + r * 0.85, -2.92); box(LZ, 0.3, 0.06, 0.06, steelM, 220.4 + c * 1.02, 3.52 + r * 0.85, -2.86); }
  // iron + sparks + smoke
  const iron = new THREE.Group(); me.aR.hand.add(iron); iron.userData.dyn = true; iron.rotation.x = SOLDER.iron;
  cyl(iron, 0.11, 0.11, 1.0, std('#2b2f3a', { roughness: 0.5 }), 0, -0.5, 0).userData.dyn = true; cyl(iron, 0.14, 0.14, 0.12, std('#d24b3a'), 0, -0.1, 0).userData.dyn = true; cyl(iron, 0.05, 0.05, 0.5, std('#c5ccd6', { metalness: 1, roughness: 0.25 }), 0, -1.25, 0).userData.dyn = true;
  const tipMat = new THREE.MeshStandardMaterial({ color: '#333', emissive: '#ff6a1a', emissiveIntensity: 0 });
  const tipMesh = mesh(new THREE.ConeGeometry(0.06, 0.3, 12), tipMat, iron, 0, -1.65, 0); tipMesh.rotation.x = Math.PI; tipMesh.userData.dyn = true;
  const tipMark = new THREE.Object3D(); tipMark.position.set(0, -1.82, 0); iron.add(tipMark);
  const smokeG = dynG(); const smoke = wisps(smokeG, 8, '#dddddd', 0.12, 1.8);
  const NS = 120, sPos = new Float32Array(NS * 3), sVel = new Float32Array(NS * 3), sLife = new Float32Array(NS); for (let i = 0; i < NS; i++) sPos[i * 3 + 1] = -99;
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(3, 1.8, 0.6), size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); sparks.frustumCulled = false; root.add(sparks);
  const board = PR.esp32(root, 213.6, BT + 0.03, -0.2, 1); board.g.userData.dyn = true;

  /* ---------- 3D printer + robot arm ---------- */
  const PX = 233.8;
  slab(LZ, 7, 0.26, 3.8, M.deskWood('#5a4636'), PX, BT - 0.13, -1.6, 3); for (const dx of [-3.3, 3.3]) box(LZ, 0.3, 1.6, 3.5, std('#3b4155', { metalness: 0.8 }), PX + dx, 0.8, -1.6);
  const frameM = std('#1c2030', { metalness: 0.7, roughness: 0.4 }), orange = std('#ff7a1a', { roughness: 0.4 });
  box(LZ, 3.6, 0.5, 3.2, frameM, PX, BT + 0.25, -1.6);
  for (const dx of [-1.7, 1.7]) box(LZ, 0.28, 4.8, 0.28, std('#2a2f3d', { metalness: 0.9, roughness: 0.3 }), PX + dx, BT + 2.4, -2.6);
  box(LZ, 3.9, 0.3, 0.4, std('#2a2f3d', { metalness: 0.9, roughness: 0.3 }), PX, BT + 4.9, -2.6);
  cyl(LZ, 0.9, 0.9, 0.7, orange, PX, BT + 5.6, -2.6).rotation.z = Math.PI / 2;
  const printScr = canvasTex(128, 64, (c, w, h, t) => { c.fillStyle = '#0a1a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fe8ff'; c.font = '700 16px system-ui'; c.fillText('Printing case', 8, 22); c.fillStyle = '#18324a'; c.fillRect(8, 36, 112, 12); c.fillStyle = '#3ddc84'; c.fillRect(8, 36, 112 * ((t * 0.07) % 1), 12); });
  screen(LZ, 1.0, 0.5, printScr, PX + 1.4, BT + 0.25, -0.0, 0, 1.2);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 2.6), std('#1a1d26', { roughness: 0.3, metalness: 0.5 })); bed.position.set(PX, BT + 0.55, -1.6); LZ.add(bed);
  const gantry = dynG(); gantry.position.set(PX, BT + 1.2, -1.6);
  box(gantry, 3.6, 0.28, 0.32, std('#2a2f3d', { metalness: 0.9, roughness: 0.3 }), 0, 0, -1.0).userData.dyn = true;
  const head = new THREE.Group(); head.userData.dyn = true; gantry.add(head); box(head, 0.6, 0.55, 0.5, std('#ffd24d', { roughness: 0.4 }), 0, -0.1, -0.7).userData.dyn = true; mesh(new THREE.ConeGeometry(0.1, 0.3, 12), std('#c9a45a', { metalness: 1, roughness: 0.3 }), head, 0, -0.5, -0.7).rotation.x = Math.PI;
  const part = mesh(new THREE.BoxGeometry(1.5, 1, 1.0), new THREE.MeshPhysicalMaterial({ color: '#ff7a1a', roughness: 0.35, clearcoat: 0.3 }), root, PX, BT + 0.6, -1.6); part.userData.dyn = true; part.geometry.translate(0, 0.5, 0);
  // robot arm
  const RX = 240.2; slab(LZ, 5.6, 0.26, 3.8, M.deskWood('#5a4636'), RX, BT - 0.13, -1.6, 3); for (const dx of [-2.5, 2.5]) box(LZ, 0.3, 1.6, 3.5, std('#3b4155', { metalness: 0.8 }), RX + dx, 0.8, -1.6);
  const arm = dynG(); arm.position.set(RX, BT, -1.4);
  const armM = std('#f2f4f8', { roughness: 0.3, clearcoat: 1 } ), servoM = std('#ff7a1a', { roughness: 0.35 });
  cyl(arm, 1.0, 1.2, 0.5, std('#1c2030', { metalness: 0.7, roughness: 0.4 }), 0, 0.25, 0).userData.dyn = true;
  const turret = new THREE.Group(); turret.userData.dyn = true; turret.position.y = 0.5; arm.add(turret);
  cyl(turret, 0.7, 0.7, 0.5, servoM, 0, 0.25, 0).userData.dyn = true;
  const sh = new THREE.Group(); sh.userData.dyn = true; sh.position.set(0, 0.6, 0); turret.add(sh);
  box(sh, 0.5, 2.4, 0.5, armM, 0, 1.2, 0).userData.dyn = true; cyl(sh, 0.4, 0.4, 0.7, servoM, 0, 0, 0).rotation.x = Math.PI / 2;
  const el = new THREE.Group(); el.userData.dyn = true; el.position.set(0, 2.4, 0); sh.add(el);
  cyl(el, 0.36, 0.36, 0.7, servoM, 0, 0, 0).rotation.x = Math.PI / 2; box(el, 0.42, 2.0, 0.42, armM, 0, 1.0, 0).userData.dyn = true;
  const wr = new THREE.Group(); wr.userData.dyn = true; wr.position.set(0, 2.0, 0); el.add(wr);
  cyl(wr, 0.3, 0.3, 0.6, servoM, 0, 0, 0).rotation.x = Math.PI / 2; box(wr, 0.5, 0.3, 0.5, std('#1c2030', { metalness: 0.7 }), 0, 0.3, 0).userData.dyn = true;
  const fing = [-1, 1].map((s) => { const f = box(wr, 0.12, 0.7, 0.2, std('#c4cad4', { metalness: 1, roughness: 0.3 }), s * 0.25, 0.8, 0); f.userData.dyn = true; return f; });

  /* ---------- projects: tank, car, hologram, screens ---------- */
  let tankLevel = 0.2;
  const tankDashT = tankDash(() => tankLevel), feedT = sentinelFeed(), homeT = homeScreen();
  const TKx = 247.6;
  slab(LZ, 5.4, 0.26, 3.8, M.deskWood('#5a4636'), TKx, BT - 0.13, -1.6, 3); for (const dx of [-2.4, 2.4]) box(LZ, 0.3, 1.6, 3.5, std('#3b4155', { metalness: 0.8 }), TKx + dx, 0.8, -1.6);
  const tank = new THREE.Group(); tank.position.set(TKx, BT, -0.8); LZ.add(tank);
  cyl(tank, 1.45, 1.5, 0.22, std('#252b3b', { metalness: 0.8, roughness: 0.35 }), 0, 0.11, 0); cyl(tank, 1.45, 1.45, 0.2, std('#252b3b', { metalness: 0.8, roughness: 0.35 }), 0, 3.9, 0);
  const glassM = new THREE.MeshPhysicalMaterial({ color: '#d6efff', transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2 });
  cyl(tank, 1.4, 1.4, 3.6, glassM, 0, 2.1, 0, undefined, 48);
  const waterM = new THREE.MeshPhysicalMaterial({ color: '#2d9cff', transparent: true, opacity: 0.62, roughness: 0.04, clearcoat: 1, emissive: '#0a3a8a', emissiveIntensity: 0.25, depthWrite: false });
  const water = mesh(new THREE.CylinderGeometry(1.32, 1.32, 1, 48), waterM, root, TKx, BT + 0.3, -0.8, false); water.userData.dyn = true;
  const surf = mesh(new THREE.CircleGeometry(1.32, 48), new THREE.MeshPhysicalMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.5, roughness: 0.02, clearcoat: 1, depthWrite: false }), root, TKx, BT + 1, -0.8, false); surf.rotation.x = -Math.PI / 2; surf.userData.dyn = true;
  const bubbles = Array.from({ length: 7 }, () => { const b = sph(root, 0.06, std('#e9f6ff', { transparent: true, opacity: 0.6, roughness: 0.05 }), 0, 0, 0, undefined, 10); b.userData.dyn = true; return b; });
  const tankEsp = PR.esp32(tank, 0, 4.1, 0, 0.7);
  for (const dx of [-0.35, 0.35]) { cyl(tank, 0.26, 0.26, 0.4, std('#c8ccd4', { metalness: 1, roughness: 0.3 }), dx, 3.72, 0.5); cyl(tank, 0.17, 0.17, 0.05, std('#0a0a0c'), dx, 3.5, 0.5); }
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.3, 0.5, 0), new THREE.Vector3(2.0, 0.2, 0.4), new THREE.Vector3(2.6, 0.5, 0.2)]), 20, 0.1, 10), std('#2f6fb5', { roughness: 0.4 })); hose.castShadow = true; tank.add(hose);
  const pump = cyl(root, 0.42, 0.42, 1.0, std('#d24b3a', { roughness: 0.4 }), TKx + 2.6, BT + 0.5, -0.6); pump.userData.dyn = true;
  // CarSentinel test track
  const CAx = 252.4;
  slab(LZ, 5.4, 0.12, 3.0, std('#23262e', { roughness: 0.85 }), CAx + 0.0, BT + 0.02, -1.4, 4); for (let i = 0; i < 5; i++) box(LZ, 0.6, 0.03, 0.12, std('#e8e8e8', { roughness: 0.7 }), CAx - 2 + i, BT + 0.09, -1.4);
  slab(LZ, 5.4, 0.26, 3.8, M.deskWood('#5a4636'), CAx, BT - 0.13 - 0.1, -1.6, 3); for (const dx of [-2.4, 2.4]) box(LZ, 0.3, 1.5, 3.5, std('#3b4155', { metalness: 0.8 }), CAx + dx, 0.75, -1.6);
  const toyHolder = dynG(); const toy = PR.makeCar(toyHolder, ctx, { body: '#e0e4ee' }); toy.car.scale.setScalar(0.3); toy.head.visible = toy.hair.visible = false;
  const cam = new THREE.Group(); toy.car.add(cam); box(cam, 0.8, 0.5, 0.6, std('#14161c'), 0.5, 2.55, 0).userData.dyn = true; const lens = sph(cam, 0.22, std('#05060a', { roughness: 0.05, metalness: 0.6 }), 0.95, 2.55, 0, undefined, 16); lens.userData.dyn = true; const recM = PR.ledMat('#ff3b30'); sph(cam, 0.1, recM, 0.4, 2.9, 0, undefined, 10).userData.dyn = true;
  cyl(cam, 0.03, 0.03, 0.9, std('#14161c'), -0.2, 3.0, 0, undefined, 8).userData.dyn = true;
  // hologram
  const HX = 257.0;
  cyl(LZ, 1.7, 1.9, 1.2, std('#1e2433', { metalness: 0.8, roughness: 0.3 }), HX, 0.6, 0.4); cyl(LZ, 1.5, 1.5, 0.12, em('#6fd6ff', 3), HX, 1.26, 0.4);
  const holo = dynG(); holo.position.set(HX, 2.6, 0.4);
  const cyanM = new THREE.LineBasicMaterial({ color: new THREE.Color(0.25, 2.2, 2.8), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const hp = []; const edge = (cx, cy, cz, w, h, d) => { const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2; const P = (x, y, z) => hp.push(x, y, z); for (const y of [y0, y1]) { P(x0, y, z0); P(x1, y, z0); P(x1, y, z0); P(x1, y, z1); P(x1, y, z1); P(x0, y, z1); P(x0, y, z1); P(x0, y, z0); } for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { P(x, y0, z); P(x, y1, z); } };
  const wh = 0.55, S = 1.15;
  edge(0, wh / 2, -1.5 * S, 4.2 * S, wh, 0.12); edge(0, wh / 2, 1.5 * S, 4.2 * S, wh, 0.12); edge(-2.1 * S, wh / 2, 0, 0.12, wh, 3.0 * S); edge(2.1 * S, wh / 2, 0, 0.12, wh, 3.0 * S);
  edge(-0.4 * S, wh / 2, -0.7 * S, 0.12, wh, 1.6 * S); edge(0.8 * S, wh / 2, 0.4 * S, 2.6 * S, wh, 0.12); edge(-1.3 * S, 0.2, 0.9 * S, 1.0, 0.25, 0.7); edge(1.4 * S, 0.2, -0.8 * S, 0.8, 0.25, 0.8); edge(0, 0.15, 0.9 * S, 0.9, 0.2, 0.4);
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); const lines = new THREE.LineSegments(hg, cyanM); lines.userData.dyn = true; holo.add(lines);
  const floorP = new THREE.Mesh(new THREE.PlaneGeometry(5.4 * S, 3.8 * S), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.5, 0.7), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); floorP.rotation.x = -Math.PI / 2; holo.add(floorP);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 1.5, 2.6, 40, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.9, 1.2), transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); beam.position.set(HX, 1.7, 0.4); root.add(beam);
  const scan = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.4, 3), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); scan.rotation.x = Math.PI / 2; holo.add(scan);
  const holoLabel = labelSprite('layout-map', { fg: '#7ff3ff', font: '700 64px "Bricolage Grotesque", system-ui, sans-serif' }, 0.7); holoLabel.position.set(HX, 5.2, 0.4); root.add(holoLabel);
  // wall displays
  for (const [x, w, t_] of [[247.6, 5.6, tankDashT], [252.9, 5.0, feedT], [258.0, 5.0, homeT]]) { box(LZ, w + 0.3, 3.4, 0.2, std('#10131c', { metalness: 0.5, roughness: 0.3 }), x, 6.9, -4.0); screen(LZ, w, 3.1, t_, x, 6.9, -3.86, 0, 1.15); }
  // console
  const CX = 260.4;
  box(LZ, 3.2, 1.9, 3.0, std('#252c3d', { metalness: 0.8, roughness: 0.38 }), CX, 0.95, -0.4);
  const slope = new THREE.Group(); slope.position.set(CX, 2.1, -0.2); slope.rotation.x = -0.45; LZ.add(slope);
  box(slope, 3.0, 0.2, 2.6, std('#2f394f', { metalness: 0.7, roughness: 0.35 }), 0, 0, 0);
  const btnG = dynG(); btnG.position.set(CX, 2.1, -0.2); btnG.rotation.x = -0.45;
  cyl(LZ, 0.75, 0.8, 0.14, std('#d6d9e0', { metalness: 1, roughness: 0.2 }), 0, 0.14, 0.2).position.set(0, 0, 0);
  const ringM = std('#d6d9e0', { metalness: 1, roughness: 0.2 }); const ringG = cyl(slope, 0.72, 0.78, 0.16, ringM, 0, 0.16, 0.1);
  const btnM = new THREE.MeshStandardMaterial({ color: '#8a0a0a', emissive: '#ff2418', emissiveIntensity: 0.6, roughness: 0.2 }); const btn = cyl(btnG, 0.55, 0.6, 0.3, btnM, 0, 0.3, 0.1); btn.userData.dyn = true;
  for (let i = 0; i < 6; i++) { const tg = box(slope, 0.12, 0.3, 0.12, steelM, -1.2 + i * 0.5, 0.2, 0.9); const k = sph(slope, 0.1, std(i % 2 ? '#ff5d5d' : '#e8e8e8', { roughness: 0.3 }), -1.2 + i * 0.5, 0.38, 0.9, undefined, 12); }
  for (let i = 0; i < 4; i++) { const m = em(['#5dffb0', '#ffd24d', '#ff5d7a', '#6fd6ff'][i], 2.5); box(slope, 0.2, 0.06, 0.2, m, 0.9 + (i % 2) * 0.3, 0.14, -0.5 + Math.floor(i / 2) * 0.35); }
  cyl(slope, 0.05, 0.05, 0.6, steelM, -1.1, 0.4, -0.6); sph(slope, 0.18, std('#d24b3a', { roughness: 0.3 }), -1.1, 0.75, -0.6, undefined, 16);
  const crt = box(LZ, 1.8, 1.4, 1.2, std('#c9ccd3', { roughness: 0.5 }), CX - 0.2, 3.5, -1.2);
  const crtScr = canvasTex(256, 192, (c, w, h, t) => { c.fillStyle = '#031a08'; c.fillRect(0, 0, w, h); c.fillStyle = '#5dff9a'; c.font = '600 18px ui-monospace, monospace'; c.fillText('VTOXI-LAB OS v2', 12, 28); c.fillText('> power ........ ok', 12, 58); c.fillText('> mqtt .......... ok', 12, 82); c.fillText('> tank ........... ' + Math.round(tankLevel * 100) + '%', 12, 106); c.fillText('> hologram ....... ok', 12, 130); if (Math.floor(t * 2) % 2) c.fillRect(12, 148, 12, 20); });
  screen(LZ, 1.5, 1.1, crtScr, CX - 0.2, 3.5, -0.58, 0, 1.2);

  /* ---------- lights ---------- */
  const mk = (col, dist) => { const l = new THREE.PointLight(col, 0, dist, 2); root.add(l); return l; };
  const labKey = mk('#cfe2ff', 70), teslaL = mk('#b38cff', 34), holoL = mk('#47d6ff', 30), printL = mk('#ffb36b', 24);
  const spot = new THREE.SpotLight('#fff1dc', 0, 40, 0.7, 0.6, 1.6); spot.position.set(210, 11, 5); spot.target.position.set(213.5, BT, -0.6); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; spot.shadow.normalBias = 0.03; root.add(spot, spot.target);

  batch(LZ);

  /* ---------- calibration: put the ESP32 where the iron tip lands ---------- */
  const v = new THREE.Vector3();
  const calibrate = (poseMe) => {
    const S = meState(HB.start + HB.dur * 0.55);
    poseMe(S, 1.0); iron.visible = true; root.updateMatrixWorld(true);
    tipMark.getWorldPosition(v); root.worldToLocal(v);
    board.g.position.set(v.x + 0.85, BT + 0.03, v.z - 0.05);
    tipMark.userData.rest = v.clone();
  };

  /* ---------- per-frame ---------- */
  const labT = { f: -1, m: -1 };
  const update = (P, t, dt, c, S, lookX) => {
    const hp_ = clamp((P - HB.start) / HB.dur), on = P >= HB.start - 3 && P < HB.end + 3;
    const inLab = c.near(HB.start + HB.dur * 0.2, HB.end + 4) || lookX > 186;
    iron.visible = P >= HB.start && P < HB.end;
    if (!on && lookX < 180) return;
    const powerRaw = smooth(seg(hp_, 0.3, 0.4)), flick = hp_ > 0.3 && hp_ < 0.4 ? (Math.sin(t * 40) > -0.2 ? 1 : 0.3) : 1;
    const power = powerRaw * flick;
    const surge = smooth(seg(hp_, 0.97, 1.0)), surgeP = P > HB.end - 0.5 ? 1 : surge;
    ctx.surge = surgeP;
    const gain = power * (1 + surgeP * 1.2);
    for (const l of lampMats) l.m.emissiveIntensity = l.base * gain;
    signMat.color.setScalar(2.2 * gain); signMesh.visible = true;
    // textures
    const f8 = Math.floor(t * 8);
    if (f8 !== labT.f) {
      labT.f = f8;
      if (power > 0.05) { mats.forEach((m, i) => m.redraw(t + i * 5)); scopeTex.redraw(t); tankDashT.redraw(t); feedT.redraw(t); homeT.redraw(t); crtScr.redraw(t); printScr.redraw(t); oledT.redraw(t); }
    }
    LZ.traverse((o) => { if (o.userData.screenMat) o.material.color.setScalar(1.2 * Math.max(power, 0.02)); });
    // nixie digits
    const hour = c.hour, hh = Math.floor(hour) % 24, mm = Math.floor((hour % 1) * 60), ss = Math.floor(t) % 60, digs = [Math.floor(hh / 10), hh % 10, Math.floor(mm / 10), mm % 10, Math.floor(ss / 10), ss % 10];
    nixie.forEach((n, i) => { if (n.last !== digs[i]) { n.last = digs[i]; const cx = n.tex.ctx; cx.clearRect(0, 0, 64, 128); cx.fillStyle = '#ffa24d'; cx.font = '700 104px "Bricolage Grotesque", system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.shadowColor = '#ff7a1a'; cx.shadowBlur = 14; cx.fillText(String(digs[i]), 32, 68); n.tex.tex.needsUpdate = true; } });
    // reels, dials
    reels.forEach((r, i) => (r.rotation.z -= dt * (1.4 + i * 0.4) * power)); dials.forEach((d, i) => { d.children[1].rotation.z = Math.sin(t * (1.3 + i) + i) * 0.9; });
    // tesla
    const arcOn = power > 0.5;
    arcs.forEach((a, i) => {
      a.visible = arcOn && (Math.floor(t * 14 + i * 3) % 3 !== 0);
      if (!a.visible) return;
      const p = a.geometry.attributes.position, sx = TC.x, sy = 7.55, sz = TC.z, to = i === 0 ? [gx, 4.5, TC.z] : [TC.x + Math.cos(t * 3 + i * 1.7) * (2.2 + i * 0.35), 4.6 + Math.sin(t * 2 + i) * 1.2, TC.z + Math.sin(t * 3 + i * 1.7) * (1.5 + i * 0.2)];
      for (let k = 0; k < 26; k++) { const u = k / 25, j = Math.sin(u * Math.PI) * 0.55; p.setXYZ(k, lerp(sx, to[0], u) + (Math.random() - 0.5) * j, lerp(sy, to[1], u) + (Math.random() - 0.5) * j, lerp(sz, to[2], u) + (Math.random() - 0.5) * j); }
      p.needsUpdate = true;
    });
    // lights
    const labK = ctx.labK ?? 0;
    labKey.position.set(lookX, 9, 8); labKey.intensity = Math.max(power, 0.3) * labK * (700 + surgeP * 600);
    teslaL.position.set(TC.x, 6.5, 1.5); teslaL.intensity = arcOn ? (220 + Math.random() * 300) * labK * (0.3 + 0.7 * smooth(seg(Math.abs(lookX - TC.x), 40, 10))) : 0;
    holoL.position.set(HX, 3.8, 2.4); holoL.intensity = power * 260 * labK * (1 + surgeP);
    printL.position.set(PX, 6, 2.5); printL.intensity = power * 260 * labK;
    spot.intensity = power * labK * 1800; stripM.forEach((m) => (m.emissiveIntensity = 4 * gain));
    // soldering
    const sol = S.solder;
    tipMat.emissiveIntensity = on ? 0.4 + sol * 3 : 0;
    tipMark.getWorldPosition(v); root.worldToLocal(v);
    smokeG.position.copy(v); smoke.update(t, sol);
    for (let i = 0; i < NS; i++) {
      if (sLife[i] <= 0) {
        if (sol > 0.5 && Math.random() < 0.2) { sLife[i] = 0.5 + Math.random() * 0.4; sPos[i * 3] = v.x; sPos[i * 3 + 1] = v.y; sPos[i * 3 + 2] = v.z; sVel[i * 3] = (Math.random() - 0.4) * 2.4; sVel[i * 3 + 1] = 1.5 + Math.random() * 3; sVel[i * 3 + 2] = (Math.random() - 0.5) * 1.6; } else sPos[i * 3 + 1] = -99;
      } else { sLife[i] -= dt; sVel[i * 3 + 1] -= 9 * dt; sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt; }
    }
    sg.attributes.position.needsUpdate = true;
    // board leds
    const powered = smooth(seg(hp_, 0.6, 0.66));
    board.leds[0].emissiveIntensity = powered * 3; board.leds[1].emissiveIntensity = powered * (Math.sin(t * 6) > 0 ? 3 : 0.3);
    bb.leds.forEach((m, i) => (m.emissiveIntensity = power * (Math.sin(t * 5 - i * 0.9) > 0.2 ? 3 : 0.3)));
    piR.led.emissiveIntensity = power * 3; piR.led2.emissiveIntensity = power * (Math.sin(t * 7) > 0 ? 3 : 0.2); arR.led.emissiveIntensity = power * 3; arR.ledL.emissiveIntensity = power * (Math.sin(t * 3) > 0 ? 3 : 0.4);
    // printer
    const prog = ((t * 0.07) % 1);
    part.scale.set(1, 0.05 + prog * 1.4, 1); gantry.position.y = BT + 0.9 + prog * 1.4; head.position.x = Math.sin(t * 3.2) * 0.8; head.position.z = Math.cos(t * 1.7) * 0.5;
    // robot arm
    const a1 = Math.sin(t * 0.8) * 0.5, a2 = Math.sin(t * 0.8 + 1) * 0.6;
    turret.rotation.y = Math.sin(t * 0.5) * 0.9; sh.rotation.z = 0.5 + a1 * 0.4; el.rotation.z = -1.0 + a2 * 0.6; wr.rotation.z = -0.4 + Math.sin(t * 1.6) * 0.3;
    fing.forEach((f, i) => (f.position.x = (i ? 1 : -1) * (0.18 + (Math.sin(t * 2) * 0.5 + 0.5) * 0.16)));
    // tank
    tankLevel = 0.2 + 0.7 * smooth(seg(hp_, 0.72, 0.98)) + Math.sin(t * 0.9) * 0.012;
    const wh2 = Math.max(0.05, tankLevel * 3.2); water.scale.y = wh2; water.position.y = BT + 0.22 + wh2 / 2; surf.position.y = BT + 0.22 + wh2 + 0.002; surf.rotation.z = t * 0.2;
    bubbles.forEach((b, i) => { const k = (t * 0.3 + i / bubbles.length) % 1; b.position.set(TKx + Math.sin(i * 7 + t) * 0.6, BT + 0.4 + k * wh2, -0.8 + Math.cos(i * 5) * 0.6); b.visible = k * wh2 < wh2 - 0.05; });
    tankEsp.leds[0].emissiveIntensity = power * 3; tankEsp.leds[1].emissiveIntensity = power * (Math.sin(t * 8) > 0 ? 3 : 0.3); pump.rotation.y = t * 3;
    // car + hologram
    const k = (t * 0.12) % 1, cx = CAx - 1.9 + Math.abs(Math.sin(k * Math.PI)) * 3.8; toy.car.position.set(cx, BT + 0.35, -1.4 + Math.sin(k * 6.28) * 0.3); toy.car.rotation.y = Math.cos(k * Math.PI) > 0 ? 0 : Math.PI; toy.wheels.forEach((w) => (w.rotation.z -= dt * 6)); recM.emissiveIntensity = Math.floor(t * 1.5) % 2 ? 4 : 0.2;
    holo.rotation.y = t * 0.45; scan.position.y = 0.1 + (Math.sin(t * 1.1) * 0.5 + 0.5) * 1.8; cyanM.opacity = (0.75 + 0.2 * Math.sin(t * 9)) * power; floorP.material.opacity = 0.18 * power; beam.material.opacity = 0.06 * power; scan.material.opacity = 0.85 * power; holoLabel.visible = power > 0.3; holoLabel.position.y = 5.2 + Math.sin(t * 1.4) * 0.1;
    // console button
    const pressed = smooth(seg(hp_, 0.975, 0.99)); btn.position.y = 0.3 - pressed * 0.14; btnM.emissiveIntensity = 0.6 + 2.4 * (Math.sin(t * 5) * 0.5 + 0.5) + surgeP * 3;
  };
  return { calibrate, update, setLabK(k) { ctx.labK = k; } };
}
