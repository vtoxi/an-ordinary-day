// Furniture, electronics and screen textures
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, box, slab, cyl, sph, mesh, canvasTex, screen, clamp, lerp } from './util.js';
import { std, phys, M, leafTexture } from './materials.js';

/* ============================== lighting helpers ============================== */
export function emissiveMat(color, intensity = 1) {
  return new THREE.MeshStandardMaterial({ color: '#1a1a1a', emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
}
export function ledMat(color) {
  return new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: color, emissiveIntensity: 0, roughness: 0.25 });
}
const GOLD = () => std('#d6b04a', { metalness: 1, roughness: 0.28 });
const SILVER = () => std('#c8ccd4', { metalness: 1, roughness: 0.3 });
const BLACKP = () => std('#17181c', { roughness: 0.55 });
const rbox = (p, w, h, d, m, x, y, z, r = 0.02) => mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45)), m, p, x, y, z);

/* ============================== architecture ============================== */
/** room shell with real window openings in the back wall */
export function room(root, x0, x1, { wall = '#dfe3f2', floor = 'wood', h = 9, trim = '#ffffff', left = true, right = true, windows = [], doors = [], ceiling = false, floorColor, gap = null, dress = null } = {}) {
  const w = x1 - x0, cx = (x0 + x1) / 2, wm = M.plaster(wall);
  const fm = floor === 'wood' ? M.floorWood(floorColor || '#ffffff') : floor === 'concrete' ? M.concrete(floorColor || '#ffffff') : floor === 'carpet' ? M.fabric(floorColor || '#59607f', 3, { roughness: 1 }) : std(floor);
  if (gap) { slab(root, gap[0] - x0, 0.5, 9.6, fm, (x0 + gap[0]) / 2, -0.25, 0.1, 5); slab(root, x1 - gap[1], 0.5, 9.6, fm, (gap[1] + x1) / 2, -0.25, 0.1, 5); }
  else slab(root, w, 0.5, 9.6, fm, cx, -0.25, 0.1, floor === 'wood' ? 4 : 5);
  // back wall assembled around window openings
  const z = -4.4, t = 0.4, ws = [...windows, ...doors.map((d) => ({ x: d.x, w: d.w, y: d.h / 2, h: d.h, door: true }))].sort((a, b) => a.x - b.x);
  let cur = x0;
  for (const win of ws) {
    const wx0 = win.x - win.w / 2, wx1 = win.x + win.w / 2;
    if (wx0 > cur) slab(root, wx0 - cur, h, t, wm, (cur + wx0) / 2, h / 2, z, 4);
    if (!win.door) slab(root, win.w, win.y - win.h / 2, t, wm, win.x, (win.y - win.h / 2) / 2, z, 4);
    slab(root, win.w, h - (win.y + win.h / 2), t, wm, win.x, win.y + win.h / 2 + (h - win.y - win.h / 2) / 2, z, 4);
    cur = wx1;
    if (win.door) { box(root, 0.3, win.h, 0.5, std('#e8e2d6'), win.x - win.w / 2 - 0.05, win.h / 2, z + 0.1); box(root, 0.3, win.h, 0.5, std('#e8e2d6'), win.x + win.w / 2 + 0.05, win.h / 2, z + 0.1); box(root, win.w + 0.6, 0.3, 0.5, std('#e8e2d6'), win.x, win.h + 0.1, z + 0.1); continue; }
    // frame, mullions, sill, glass
    const fr = std('#f4f1ea', { roughness: 0.4 });
    box(root, win.w + 0.5, 0.26, 0.5, fr, win.x, win.y - win.h / 2 - 0.1, z + 0.12);
    box(root, win.w + 0.3, 0.2, 0.3, fr, win.x, win.y + win.h / 2 + 0.05, z + 0.05);
    box(root, 0.18, win.h, 0.2, fr, win.x - win.w / 2, win.y, z + 0.05); box(root, 0.18, win.h, 0.2, fr, win.x + win.w / 2, win.y, z + 0.05);
    box(root, 0.12, win.h, 0.14, fr, win.x, win.y, z + 0.06); box(root, win.w, 0.12, 0.14, fr, win.x, win.y, z + 0.06);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.MeshPhysicalMaterial({ color: '#cfe6f7', transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0, clearcoat: 1, depthWrite: false, envMapIntensity: 1.6 }));
    glass.position.set(win.x, win.y, z + 0.1); root.add(glass);
    if (dress) dress(root, win);
  }
  if (x1 > cur) slab(root, x1 - cur, h, t, wm, (cur + x1) / 2, h / 2, z, 4);
  box(root, w, 0.4, 0.22, std(trim, { roughness: 0.4 }), cx, 0.2, -4.08);
  if (left) slab(root, 0.5, h, 9.6, wm, x0, h / 2, 0.1, 4);
  if (right) slab(root, 0.5, h, 9.6, wm, x1, h / 2, 0.1, 4);
  if (ceiling) slab(root, w, 0.6, 9.6, std('#2a2f3d', { roughness: 0.8 }), cx, h + 0.3, 0.1);
}

export function curtains(root, x, y, winW, h, color = '#5b6fa8', panelW = 1.5, pleats = 8) {
  // sheer voile across the whole window + two heavy drapes that overlap the glass + rod, finials, valance, tie-backs
  const sg = new THREE.PlaneGeometry(winW + 0.5, h, 40, 2), sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(sp.getX(i) * 5.2) * 0.05);
  sg.computeVertexNormals();
  const sheer = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.38, roughness: 1, side: THREE.DoubleSide, depthWrite: false }));
  sheer.position.set(x, y, -3.95); root.add(sheer);
  const pw = Math.max(panelW, winW * 0.34);
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(pw, h, 60, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i); p.setZ(i, Math.sin(u / pw * Math.PI * 2 * pleats) * 0.11); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.fabric(color, 8, { side: THREE.DoubleSide }));
    m.position.set(x + s * (winW / 2 + pw / 2 - winW * 0.2), y, -3.78); m.castShadow = m.receiveShadow = true; root.add(m);
    const tb = cyl(root, 0.07, 0.07, 0.5, '#c8a96a', x + s * winW * 0.3, y - h * 0.12, -3.62, { metalness: 0.8, roughness: 0.35 }); tb.rotation.z = Math.PI / 2;
    sph(root, 0.14, std('#c8a96a', { metalness: 0.9, roughness: 0.25 }), x + s * (winW / 2 + pw * 1.05), y + h / 2 + 0.1, -3.7, undefined, 14);
  }
  cyl(root, 0.06, 0.06, winW + pw * 2.1, '#2a2f3d', x, y + h / 2 + 0.1, -3.7, { metalness: 0.8, roughness: 0.3 }).rotation.z = Math.PI / 2;
  box(root, winW + pw * 1.6, 0.55, 0.45, M.fabric(color, 8), x, y + h / 2 + 0.55, -3.7);
}

/** horizontal slat blinds, lowered most of the way, with head rail, bottom bar, tilt wand and pull cord */
export function blinds(root, x, y, w, h, { color = '#e9edf4', drop = 0.78 } = {}) {
  const mat = std(color, { roughness: 0.45, metalness: 0.1 }), top = y + h / 2 + 0.05, n = Math.round(h * drop / 0.3);
  box(root, w + 0.2, 0.28, 0.36, std('#cfd5df', { roughness: 0.4, metalness: 0.5 }), x, top + 0.08, -4.05);
  for (let i = 0; i < n; i++) { const s = box(root, w - 0.1, 0.05, 0.34, mat, x, top - 0.3 - i * 0.3, -4.0); s.rotation.x = 0.55; }
  const bottom = top - 0.3 - n * 0.3;
  box(root, w - 0.05, 0.12, 0.3, std('#b8bfcc', { metalness: 0.6, roughness: 0.4 }), x, bottom - 0.1, -4.0);
  for (const k of [-1, 1]) cyl(root, 0.012, 0.012, n * 0.3 + 0.2, '#9aa3b2', x + k * w * 0.32, top - n * 0.15 - 0.1, -3.94);
  cyl(root, 0.025, 0.025, 2.6, '#c9ced8', x + w / 2 - 0.25, top - 1.3, -3.88);
  cyl(root, 0.012, 0.012, 1.6, '#9aa3b2', x - w / 2 + 0.3, bottom - 0.9, -3.9); sph(root, 0.06, '#9aa3b2', x - w / 2 + 0.3, bottom - 1.7, -3.9, undefined, 8);
}

/** stair flight: steps + stringers + handrail, rising from (x0,y0) to (x1,y1), width along z */
export function stairs(root, x0, x1, y0, y1, zc = 1.7, wz = 3.4, n = 18) {
  const wood = std('#8a6a52', { roughness: 0.55 }), metal = std('#2a2f3d', { metalness: 0.8, roughness: 0.35 });
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n;
  for (let i = 0; i < n; i++) box(root, dx * 1.04, 0.22, wz, wood, x0 + dx * (i + 0.5), y0 + dy * (i + 1) - 0.11, zc);
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  for (const s of [-1, 1]) {
    const st = box(root, len, 0.4, 0.14, metal, (x0 + x1) / 2, (y0 + y1) / 2 - 0.2, zc + s * wz / 2); st.rotation.z = ang;
    const rl = box(root, len, 0.08, 0.08, std('#c9ced8', { metalness: 0.9, roughness: 0.25 }), (x0 + x1) / 2, (y0 + y1) / 2 + 2.4, zc + s * wz / 2); rl.rotation.z = ang;
    for (let i = 0; i <= n; i += 3) box(root, 0.07, 2.4, 0.07, metal, x0 + dx * i, y0 + dy * i + 1.2, zc + s * wz / 2);
  }
}

/* ============================== furniture ============================== */
export function chair(root, x, z, ry = 0, color = '#3b4a73') {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  const m = M.fabric(color, 6, { roughness: 0.9 });
  rbox(g, 1.7, 0.26, 1.7, m, 0, 0.55, 0, 0.1); rbox(g, 1.65, 1.05, 0.22, m, 0, 1.2, -0.85, 0.1);
  cyl(g, 0.1, 0.1, 0.45, '#2a2f3d', 0, 0.3, 0, { metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const l = box(g, 0.14, 0.08, 0.8, '#2a2f3d', Math.sin(a) * 0.4, 0.1, Math.cos(a) * 0.4); l.rotation.y = a; cyl(g, 0.07, 0.07, 0.1, '#111', Math.sin(a) * 0.78, 0.05, Math.cos(a) * 0.78); }
  return g;
}
export function deskUnit(root, x, z, w = 12, top = '#ffffff') {
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  slab(g, w, 0.24, 3.2, M.deskWood(top), 0, 1.75, 0, 3);
  for (const s of [-1, 1]) { box(g, 0.2, 1.65, 3, std('#3b3f4d', { metalness: 0.6, roughness: 0.35 }), s * (w / 2 - 0.3), 0.85, 0); }
  box(g, w - 0.6, 0.12, 0.2, std('#3b3f4d', { metalness: 0.6, roughness: 0.35 }), 0, 1.3, -1.4);
  return g;
}
export function monitor(root, x, y, z, w, h, ct, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
  rbox(g, w + 0.18, h + 0.18, 0.16, std('#16181f', { roughness: 0.35, metalness: 0.4 }), 0, 0, 0, 0.05);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
  s.position.z = 0.09; g.add(s);
  box(g, 0.3, h * 0.4, 0.22, std('#2a2f3d', { metalness: 0.8, roughness: 0.3 }), 0, -h / 2 - 0.3, -0.15);
  rbox(g, 1.6, 0.09, 1.0, std('#2a2f3d', { metalness: 0.8, roughness: 0.3 }), 0, -h / 2 - 0.55, -0.05, 0.04);
  return g;
}
export function keyboard(root, x, y, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
  rbox(g, 2.8, 0.09, 0.95, std('#262a33', { roughness: 0.5 }), 0, 0, 0, 0.04);
  const km = std('#3a3f4b', { roughness: 0.45 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) rbox(g, 0.16, 0.06, 0.16, km, -1.2 + c * 0.2, 0.07, -0.3 + r * 0.2, 0.02);
  rbox(g, 1.3, 0.06, 0.16, km, 0, 0.07, 0.5, 0.02);
  rbox(g, 0.36, 0.09, 0.55, std('#262a33', { roughness: 0.4 }), 1.9, 0, 0.1, 0.05);
  return g;
}
export function mug(root, x, y, z, color = '#f4f1ea') {
  const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
  cyl(g, 0.3, 0.26, 0.5, std(color, { roughness: 0.2, clearcoat: 1 }), 0, 0.25, 0);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 10, 20, Math.PI), std(color, { roughness: 0.2 })); h.position.set(0.3, 0.25, 0); h.rotation.z = -Math.PI / 2; h.castShadow = true; g.add(h);
  cyl(g, 0.255, 0.255, 0.02, '#3a2417', 0, 0.48, 0, { roughness: 0.15 });
  return g;
}
export function plant(root, x, z, s = 1, pot = '#c9795a') {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
  cyl(g, 0.58, 0.4, 0.85, std(pot, { roughness: 0.75 }), 0, 0.42, 0); cyl(g, 0.52, 0.52, 0.04, '#3a2a1f', 0, 0.84, 0, { roughness: 1 });
  const lm = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 });
  const geo = new THREE.PlaneGeometry(0.62, 1.4, 1, 6); geo.translate(0, 0.7, 0);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, y * y * 0.28); } geo.computeVertexNormals();
  for (let i = 0; i < 14; i++) {
    const l = new THREE.Mesh(geo, lm), a = i * 2.4, tilt = 0.25 + (i % 5) * 0.12;
    l.position.set(Math.cos(a) * 0.12, 0.85, Math.sin(a) * 0.12); l.rotation.set(-tilt - 0.1, a, 0, 'YXZ'); l.scale.setScalar(0.9 + (i % 4) * 0.18);
    l.castShadow = true; g.add(l);
  }
  return g;
}
export function bed(root, x) {
  const g = new THREE.Group(); g.position.set(x, 0, 0); root.add(g);
  const wood = M.deskWood('#8a6a52');
  rbox(g, 6.8, 0.5, 5, wood, 0, 0.3, -0.5, 0.1);
  rbox(g, 6.4, 0.34, 4.7, std('#f4f1ea', { roughness: 0.95 }), 0, 0.72, -0.5, 0.15);
  rbox(g, 0.35, 2.6, 5, wood, -3.3, 1.5, -0.5, 0.12);
  for (const dz of [-0.9, 0.2]) rbox(g, 1.4, 0.36, 1.5, M.fabric('#ffffff', 8), -2.4, 1.05, dz - 0.4, 0.16);
  const blanket = rbox(g, 4.3, 0.66, 4.8, M.fabric('#5b7fd1', 5, { roughness: 1 }), 1.0, 1.0, -0.5, 0.25);
  return { g, blanket };
}
export function sofa(root, x, z, color = '#4768b8') {
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  const m = M.fabric(color, 5, { roughness: 0.95 });
  rbox(g, 7, 0.4, 2.8, m, 0, 0.2, 0, 0.1);
  for (const dx of [-1.55, 0, 1.55]) rbox(g, 2.05, 0.34, 2.3, M.fabric('#5a7ccf', 5, { roughness: 0.95 }), dx, 0.52, 0.15, 0.14);
  rbox(g, 7, 1.9, 0.8, m, 0, 1.35, -1.1, 0.25);
  for (const s of [-1, 1]) rbox(g, 0.8, 1.2, 2.8, m, s * 3.5, 0.85, 0, 0.25);
  for (const dx of [-2.3, 2.3]) { const c = rbox(g, 1.0, 1.0, 0.36, M.fabric(dx < 0 ? '#ffb703' : '#e0e4ee', 8), dx, 1.25, -0.4, 0.2); c.rotation.set(-0.2, dx < 0 ? 0.3 : -0.3, dx < 0 ? 0.1 : -0.1); }
  return g;
}
export function lampFloor(root, ctx, x, z, h = 5) {
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  cyl(g, 0.55, 0.65, 0.1, '#2a2f3d', 0, 0.05, 0, { metalness: 0.8, roughness: 0.3 });
  cyl(g, 0.06, 0.06, h, '#2a2f3d', 0, h / 2, 0, { metalness: 0.8, roughness: 0.3 });
  const m = new THREE.MeshStandardMaterial({ color: '#f7e7c4', emissive: '#ffd08a', emissiveIntensity: 1, roughness: 0.9, side: THREE.DoubleSide });
  cyl(g, 0.55, 0.9, 0.95, m, 0, h + 0.2, 0, undefined, 40).castShadow = false;
  ctx.glows.push({ m, base: 1.6, min: 0.15 });
  return g;
}
export function bookshelf(root, x, y0, w, h, z = -3.5, rows = 4) {
  const wood = M.deskWood('#8a6a52');
  rbox(root, w, h, 1.3, wood, x, y0 + h / 2, z, 0.05);
  const inner = std('#3a2c22', { roughness: 0.9 });
  box(root, w - 0.3, h - 0.3, 0.1, inner, x, y0 + h / 2, z - 0.55);
  const cols = ['#d4476b', '#2f6fb5', '#ffb703', '#2f9e5f', '#6c5ce7', '#e9e3d5', '#c9506b', '#1fa5a0'];
  for (let r = 0; r < rows; r++) {
    const sy = y0 + 0.2 + r * ((h - 0.3) / rows);
    box(root, w - 0.1, 0.12, 1.2, wood, x, sy, z);
    let px = x - w / 2 + 0.3;
    for (let i = 0; px < x + w / 2 - 0.5; i++) { const bw = 0.2 + ((i * 7 + r * 3) % 5) * 0.06, bh = 1.0 + ((i * 3 + r) % 4) * 0.22; const b = rbox(root, bw, bh, 0.8, std(cols[(i + r * 2) % cols.length], { roughness: 0.7 }), px + bw / 2, sy + 0.06 + bh / 2, z + 0.05, 0.02); b.rotation.z = (i % 7 === 3) ? 0.12 : 0; px += bw + 0.02; }
  }
}
export function frame(root, x, y, w, h, color, z = -4.05) {
  box(root, w + 0.3, h + 0.3, 0.14, std('#2a2420', { roughness: 0.5 }), x, y, z); box(root, w + 0.1, h + 0.1, 0.05, std('#f6f2ea'), x, y, z + 0.06);
  box(root, w, h, 0.05, std(color, { roughness: 0.6 }), x, y, z + 0.09);
}

/* ============================== electronics ============================== */
const gl = (color, ...a) => color;
function pcbCanvas(w, h, base, draw) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    // faint copper traces
    c.strokeStyle = 'rgba(255,255,255,.055)'; c.lineWidth = 3;
    for (let i = 0; i < 46; i++) { c.beginPath(); let x = (i * 53) % w, y = (i * 97) % h; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += ((i * (k + 3)) % 5 - 2) * 26; c.lineTo(x, y); y += ((i * (k + 5)) % 5 - 2) * 20; c.lineTo(x, y); } c.stroke(); }
    draw(c, w, h);
  });
}
function pinsRow(parent, x0, z, n, pitch = 0.134, y = 0.04, pinH = 0.2) {
  box(parent, n * pitch, 0.1, 0.14, BLACKP(), x0 + (n - 1) * pitch / 2, y + 0.05, z);
  for (let i = 0; i < n; i++) box(parent, 0.035, pinH, 0.035, GOLD(), x0 + i * pitch, y + 0.1 + pinH / 2 - 0.02, z);
}

export function esp32(parent, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  const W = 2.9, D = 1.42;
  const tex = pcbCanvas(1024, 502, '#14161c', (c, w, h) => {
    c.fillStyle = '#d6b04a';
    for (let i = 0; i < 19; i++) { c.beginPath(); c.arc(40 + i * 48.5, 28, 7, 0, 7); c.fill(); c.beginPath(); c.arc(40 + i * 48.5, h - 28, 7, 0, 7); c.fill(); }
    c.fillStyle = '#e8e8e8'; c.font = '600 22px ui-monospace, Consolas, monospace'; c.textAlign = 'center';
    const L = ['EN', '36', '39', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND', '13', 'D2', 'D3', 'CMD', '5V'];
    const Rr = ['GND', '23', '22', 'TX', 'RX', '21', 'GND', '19', '18', '5', '17', '16', '4', '0', '2', '15', 'D1', 'D0', 'CLK'];
    L.forEach((t, i) => c.fillText(t, 40 + i * 48.5, 62)); Rr.forEach((t, i) => c.fillText(t, 40 + i * 48.5, h - 44));
    c.textAlign = 'left'; c.font = '700 30px ui-monospace, Consolas, monospace'; c.fillStyle = '#f1f1f1'; c.fillText('ESP32-DevKitC', 360, 270);
    c.font = '500 18px ui-monospace, monospace'; c.fillText('VTOXI lab  rev 4', 360, 300);
    c.strokeStyle = '#e8e8e8'; c.lineWidth = 3; c.strokeRect(332, 236, 300, 84);
    // antenna meander
    c.strokeStyle = '#d6b04a'; c.lineWidth = 5; c.beginPath(); let ax = 820, ay = 120; c.moveTo(ax, ay); for (let i = 0; i < 7; i++) { c.lineTo(ax + 120, ay); c.lineTo(ax + 120, ay + 28); c.lineTo(ax, ay + 28); c.lineTo(ax, ay + 56); ay += 56; } c.stroke();
  });
  rbox(g, W, 0.07, D, std('#14161c', { roughness: 0.4 }), 0, 0, 0, 0.05);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02), new THREE.MeshStandardMaterial({ map: tex.tex, roughness: 0.4, metalness: 0.1 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.04; g.add(top);
  // module shield + label
  const sh = rbox(g, 1.0, 0.13, 1.18, M.brushed('#d8dce4'), 0.05, 0.1, 0, 0.02);
  box(g, 0.8, 0.012, 0.5, std('#1b1b1f'), 0.05, 0.172, 0.0);
  rbox(g, 0.12, 0.07, 0.4, std('#c9ced6', { metalness: 1, roughness: 0.4 }), 0.58, 0.12, 0, 0.01);
  // USB micro
  rbox(g, 0.5, 0.2, 0.62, SILVER(), -W / 2 + 0.2, 0.14, 0, 0.03); box(g, 0.06, 0.1, 0.42, '#0b0b0d', -W / 2 - 0.04, 0.14, 0);
  // CP2102 + passives
  rbox(g, 0.32, 0.05, 0.32, BLACKP(), -0.85, 0.06, 0.28, 0.01);
  for (let i = 0; i < 10; i++) rbox(g, 0.1, 0.04, 0.06, std(i % 3 ? '#8b6a3d' : '#2a2a30', { roughness: 0.6 }), -1.0 + i * 0.13, 0.06, -0.35 - (i % 2) * 0.1, 0.01);
  rbox(g, 0.16, 0.05, 0.2, std('#17181c'), -0.4, 0.06, -0.3, 0.01);
  for (const dx of [-1.05, -0.62]) { rbox(g, 0.2, 0.08, 0.2, std('#d8d8d8', { roughness: 0.35 }), dx, 0.08, -0.55, 0.02); sph(g, 0.06, '#111', dx, 0.13, -0.55, undefined, 12); }
  const l1 = ledMat('#ff3b30'), l2 = ledMat('#3b82f6');
  box(g, 0.09, 0.05, 0.06, l1, -0.3, 0.07, 0.5); box(g, 0.09, 0.05, 0.06, l2, -0.15, 0.07, 0.5);
  pinsRow(g, -1.2, -D / 2 + 0.12, 19); pinsRow(g, -1.2, D / 2 - 0.12, 19);
  return { g, leds: [l1, l2], top: sh };
}
export function rpi(parent, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  const W = 3.4, D = 2.24;
  const tex = pcbCanvas(1024, 675, '#0f7a45', (c, w, h) => {
    c.fillStyle = '#e8e8e8'; c.font = '700 34px system-ui, sans-serif'; c.fillText('Raspberry Pi 4 Model B', 120, 560); c.font = '500 20px system-ui'; c.fillText('(c) 2019   Made in the UK', 120, 596);
    c.strokeStyle = '#d6b04a'; c.lineWidth = 4; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(60 + (i % 2) * 40, 80 + i * 36, 10, 0, 7); c.stroke(); }
    c.fillStyle = '#d6b04a'; for (let i = 0; i < 20; i++) { c.beginPath(); c.arc(300 + i * 28, 54, 6, 0, 7); c.fill(); c.beginPath(); c.arc(300 + i * 28, 90, 6, 0, 7); c.fill(); }
  });
  rbox(g, W, 0.07, D, std('#0f7a45', { roughness: 0.42 }), 0, 0, 0, 0.1);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02), new THREE.MeshStandardMaterial({ map: tex.tex, roughness: 0.42 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.04; g.add(top);
  rbox(g, 0.78, 0.13, 0.78, M.brushed('#cfd3da'), -0.3, 0.11, 0.05, 0.03); box(g, 0.5, 0.01, 0.5, std('#2a2a2e'), -0.3, 0.18, 0.05);
  rbox(g, 0.55, 0.06, 0.42, BLACKP(), 0.55, 0.07, -0.3, 0.01);
  for (const dz of [-0.62, 0.38]) { rbox(g, 1.15, 0.58, 0.98, SILVER(), W / 2 - 0.55, 0.33, dz, 0.03); box(g, 0.05, 0.14, 0.78, '#1a6bd6', W / 2 - 0.02, 0.3, dz); box(g, 0.05, 0.14, 0.78, '#0d0d10', W / 2 - 0.02, 0.5, dz); }
  rbox(g, 1.1, 0.6, 1.0, SILVER(), W / 2 - 0.55, 0.34, 0.95 - 0.0, 0.03).visible = false;
  rbox(g, 0.75, 0.52, 0.95, SILVER(), W / 2 - 0.4, 0.31, 0.92, 0.03);
  rbox(g, 0.42, 0.22, 0.44, SILVER(), -W / 2 + 0.55, 0.15, D / 2 - 0.16, 0.03); rbox(g, 0.3, 0.14, 0.34, SILVER(), -W / 2 + 1.0, 0.11, D / 2 - 0.12, 0.03); rbox(g, 0.3, 0.14, 0.34, SILVER(), -W / 2 + 1.38, 0.11, D / 2 - 0.12, 0.03);
  rbox(g, 0.3, 0.3, 0.3, std('#1a1a1a'), -W / 2 + 1.85, 0.2, D / 2 - 0.2, 0.03);
  rbox(g, 2.8, 0.14, 0.3, BLACKP(), 0.0, 0.1, -D / 2 + 0.2, 0.02);
  for (let i = 0; i < 20; i++) for (const dz of [-0.07, 0.07]) box(g, 0.035, 0.22, 0.035, GOLD(), -1.26 + i * 0.134, 0.22, -D / 2 + 0.2 + dz);
  const led = ledMat('#3ddc84'), led2 = ledMat('#ff3b30'); box(g, 0.08, 0.05, 0.05, led, -W / 2 + 0.3, 0.07, -D / 2 + 0.55); box(g, 0.08, 0.05, 0.05, led2, -W / 2 + 0.3, 0.07, -D / 2 + 0.65);
  return { g, led, led2 };
}
export function arduino(parent, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  const W = 3.25, D = 2.5;
  const tex = pcbCanvas(1024, 788, '#007f87', (c, w, h) => {
    c.fillStyle = '#f2f2f2'; c.font = '800 54px system-ui, sans-serif'; c.fillText('ARDUINO', 400, 420); c.font = '700 40px system-ui'; c.fillText('UNO', 640, 470);
    c.font = '600 22px ui-monospace, monospace'; c.fillText('DIGITAL (PWM~)', 360, 90); c.fillText('POWER', 360, h - 66); c.fillText('ANALOG IN', 700, h - 66);
    c.lineWidth = 6; c.strokeStyle = '#f2f2f2'; c.beginPath(); c.arc(330, 440, 38, 0.3, 5.9); c.stroke(); c.beginPath(); c.moveTo(300, 440); c.lineTo(360, 440); c.stroke();
    c.strokeStyle = '#d6b04a'; c.lineWidth = 3; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(60 + i * 24, 740, 5, 0, 7); c.stroke(); }
  });
  rbox(g, W, 0.07, D, std('#007f87', { roughness: 0.42 }), 0, 0, 0, 0.06);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02), new THREE.MeshStandardMaterial({ map: tex.tex, roughness: 0.42 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.04; g.add(top);
  rbox(g, 0.95, 0.55, 0.95, SILVER(), -W / 2 + 0.35, 0.33, -D / 2 + 0.75, 0.03);
  rbox(g, 0.85, 0.5, 0.9, BLACKP(), -W / 2 + 0.3, 0.3, D / 2 - 0.75, 0.04);
  rbox(g, 1.5, 0.13, 0.5, BLACKP(), 0.55, 0.1, 0.1, 0.02);
  for (let i = 0; i < 14; i++) for (const sz of [-1, 1]) box(g, 0.03, 0.08, 0.03, SILVER(), -0.15 + i * 0.134, 0.06, 0.1 + sz * 0.3);
  rbox(g, 0.2, 0.1, 0.42, std('#d8d8d8', { metalness: 1, roughness: 0.3 }), -0.85, 0.1, 0.0, 0.03);
  rbox(g, 0.26, 0.14, 0.26, std('#c23b32', { roughness: 0.4 }), -1.05, 0.11, -0.62, 0.04);
  pinsRowFemale(g, -0.2, -D / 2 + 0.14, 10); pinsRowFemale(g, 1.0, -D / 2 + 0.14, 8); pinsRowFemale(g, -0.05, D / 2 - 0.14, 8); pinsRowFemale(g, 1.15, D / 2 - 0.14, 6);
  const led = ledMat('#3ddc84'), ledL = ledMat('#ffb703'); box(g, 0.08, 0.05, 0.05, led, 0.9, 0.07, 0.75); box(g, 0.08, 0.05, 0.05, ledL, 0.9, 0.07, 0.6);
  return { g, led, ledL };
}
function pinsRowFemale(g, x0, z, n) {
  const p = 0.134; box(g, n * p, 0.22, 0.14, BLACKP(), x0 + (n - 1) * p / 2, 0.15, z);
  for (let i = 0; i < n; i++) box(g, 0.05, 0.02, 0.05, '#050505', x0 + i * p, 0.265, z);
}

const bandCache = {};
function resistorMat(bands) {
  const k = bands.join();
  return bandCache[k] || (bandCache[k] = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d');
    x.fillStyle = '#d9b982'; x.fillRect(0, 0, 128, 32);
    bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(26 + i * 18, 0, 8, 32); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
  })());
}
export function resistor(parent, x, y, z, ry = 0, bands = ['#a52a2a', '#111', '#e08a1e', '#d6b04a']) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const b = cyl(g, 0.06, 0.06, 0.34, resistorMat(bands), 0, 0, 0); b.rotation.z = Math.PI / 2;
  const e = (sx) => { sph(g, 0.075, resistorMat(bands), sx * 0.15, 0, 0, undefined, 12).scale.set(1, 1, 1); };
  e(-1); e(1);
  for (const sx of [-1, 1]) { const l = cyl(g, 0.012, 0.012, 0.4, SILVER(), sx * 0.34, -0.03, 0); l.rotation.z = Math.PI / 2; }
  return g;
}
export function led5(parent, x, y, z, mat_) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  cyl(g, 0.11, 0.11, 0.16, mat_, 0, 0.08, 0, undefined, 20); sph(g, 0.11, mat_, 0, 0.16, 0, undefined, 20);
  cyl(g, 0.125, 0.125, 0.03, mat_, 0, 0.01, 0, undefined, 20);
  for (const dx of [-0.045, 0.045]) cyl(g, 0.008, 0.008, 0.2, SILVER(), dx, -0.09, 0);
  return g;
}
export function jumper(parent, a, b, color, lift = 0.5) {
  const mid = a.clone().lerp(b, 0.5); mid.y += lift;
  const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(0, 0.12, 0)), mid, b.clone().add(new THREE.Vector3(0, 0.12, 0)), b]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.032, 8, false), std(color, { roughness: 0.4 }));
  m.castShadow = true; parent.add(m);
  for (const p of [a, b]) cyl(parent, 0.04, 0.04, 0.16, SILVER(), p.x, p.y + 0.0, p.z, undefined, 10);
}
export function breadboard(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const t = canvasTex(1024, 384, (c, w, h) => {
    c.fillStyle = '#eceae4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2d2d2a';
    for (let i = 0; i < 30; i++) for (let j = 0; j < 10; j++) { if (j === 5) continue; c.fillRect(44 + i * 30.5, 92 + j * 22 + (j > 5 ? 20 : 0) - 24, 9, 9); }
    for (const [yy, col] of [[16, '#d33'], [38, '#33d'], [h - 38, '#d33'], [h - 16, '#33d']]) { c.fillStyle = col; c.fillRect(20, yy - 1, w - 40, 3); }
    c.fillStyle = '#2d2d2a'; for (let i = 0; i < 25; i++) for (const yy of [22, 40, h - 40, h - 22]) c.fillRect(44 + i * 36 + (i > 11 ? 14 : 0), yy - 5, 8, 8);
    c.fillStyle = '#a7a59d'; c.fillRect(0, h / 2 - 8, w, 16); c.font = '600 14px system-ui'; c.fillStyle = '#6b6a64'; for (let i = 5; i <= 30; i += 5) c.fillText(String(i), 40 + (i - 1) * 30.5, 106);
  });
  rbox(g, 5.1, 0.28, 1.9, std('#eceae4', { roughness: 0.5 }), 0, 0.14, 0, 0.05);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.88), new THREE.MeshStandardMaterial({ map: t.tex, roughness: 0.5 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.285; g.add(top);
  const cols = ['#ff3b30', '#ffb703', '#3ddc84', '#3b82f6', '#c084fc'];
  const leds = cols.map((c, i) => { const m = ledMat(c); led5(g, -1.55 + i * 0.7, 0.28, 0.2, m); return m; });
  resistor(g, -1.2, 0.36, -0.28, 0, ['#a52a2a', '#111', '#e08a1e', '#d6b04a']); resistor(g, -0.5, 0.36, -0.28, 0, ['#e08a1e', '#e08a1e', '#a52a2a', '#d6b04a']); resistor(g, 0.2, 0.36, -0.28, 0, ['#a52a2a', '#111', '#111', '#d6b04a']);
  // DIP IC + electrolytic + button
  rbox(g, 0.5, 0.14, 0.34, BLACKP(), 1.9, 0.33, -0.25, 0.02); for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) box(g, 0.03, 0.05, 0.05, SILVER(), 1.75 + i * 0.1, 0.3, -0.25 + sz * 0.2);
  cyl(g, 0.14, 0.14, 0.34, std('#1b2a4a', { roughness: 0.4 }), 2.3, 0.45, 0.35); cyl(g, 0.14, 0.14, 0.02, SILVER(), 2.3, 0.63, 0.35);
  rbox(g, 0.22, 0.14, 0.22, std('#222'), 2.25, 0.34, -0.2, 0.03); cyl(g, 0.06, 0.06, 0.08, std('#c23b32'), 2.25, 0.44, -0.2);
  return { g, leds, a: g };
}
export function oled(parent, x, y, z, ct) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  rbox(g, 1.0, 0.06, 0.8, std('#0b3c8a', { roughness: 0.4 }), 0, 0, 0, 0.03);
  rbox(g, 0.82, 0.04, 0.5, std('#050505', { roughness: 0.2 }), 0, 0.05, 0.04, 0.01);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.38), new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.076, 0.04); g.add(s);
  pinsRow(g, -0.2, -0.33, 4, 0.1, 0.02, 0.15);
  return g;
}
export function oledTexture() {
  return canvasTex(256, 128, (c, w, h, t) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fe8ff'; c.font = '700 22px ui-monospace, monospace'; c.fillText('VTOXI LAB', 12, 30);
    c.font = '16px ui-monospace, monospace'; c.fillText('tank   ' + (62 + Math.round(Math.sin(t) * 6)) + '%', 12, 62); c.fillText('pump   ' + (Math.sin(t) > 0 ? 'ON ' : 'OFF'), 12, 86); c.fillText('mqtt   ok', 12, 110);
  });
}
export function servo(parent, x, y, z, color = '#2f6fb5') {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  rbox(g, 1.1, 0.8, 0.5, std(color, { roughness: 0.45 }), 0, 0.4, 0, 0.05); rbox(g, 1.6, 0.08, 0.5, std(color), 0, 0.55, 0, 0.03);
  cyl(g, 0.17, 0.17, 0.2, std('#e9e9e9'), 0.25, 0.9, 0); const horn = box(g, 0.9, 0.06, 0.16, '#f4f4f4', 0.25, 1.02, 0); g.userData.horn = horn;
  return g;
}

/* ---------------- bench instruments ---------------- */
export function scopeTexture(getT) {
  return canvasTex(512, 384, (c, w, h, t) => {
    c.fillStyle = '#05110a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(80,255,150,.18)'; c.lineWidth = 1; for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(i * w / 10, 0); c.lineTo(i * w / 10, h); c.stroke(); } for (let j = 0; j <= 8; j++) { c.beginPath(); c.moveTo(0, j * h / 8); c.lineTo(w, j * h / 8); c.stroke(); }
    const tt = getT ? getT() : t;
    c.strokeStyle = '#4dff9a'; c.shadowColor = '#4dff9a'; c.shadowBlur = 8; c.lineWidth = 2.5; c.beginPath();
    for (let i = 0; i <= w; i += 3) { const x = i / w, y = h / 2 + Math.sin(x * 22 + tt * 3) * 56 * (0.7 + 0.3 * Math.sin(tt)) + Math.sin(x * 70 + tt * 5) * 10; i ? c.lineTo(i, y) : c.moveTo(i, y); } c.stroke();
    c.strokeStyle = '#ffd24d'; c.beginPath(); for (let i = 0; i <= w; i += 3) { const x = i / w, s = Math.sin(x * 14 + tt * 2) > 0 ? 1 : -1; const y = h * 0.78 - s * 24; i ? c.lineTo(i, y) : c.moveTo(i, y); } c.stroke(); c.shadowBlur = 0;
    c.fillStyle = '#4dff9a'; c.font = '600 14px ui-monospace, monospace'; c.fillText('CH1 1.00V  CH2 2.00V  M 500us', 12, h - 12);
  });
}
export function oscilloscope(parent, x, y, z, ct) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const body = std('#2a2f38', { roughness: 0.45, metalness: 0.3 });
  rbox(g, 3.6, 2.6, 2.4, body, 0, 1.3, 0, 0.1);
  rbox(g, 3.1, 1.9, 0.1, std('#06080c', { roughness: 0.1 }), -0.2, 1.45, 1.2, 0.04);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.7), new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) })); s.position.set(-0.2, 1.45, 1.27); g.add(s);
  for (let i = 0; i < 4; i++) cyl(g, 0.17, 0.17, 0.16, std('#d0d3d9', { metalness: 1, roughness: 0.35 }), 1.5, 2.05 - i * 0.5, 1.28).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { cyl(g, 0.12, 0.12, 0.1, SILVER(), -1.3 + i * 0.35, 0.28, 1.25).rotation.x = Math.PI / 2; }
  box(g, 0.5, 0.18, 0.06, std('#ffb703'), 1.5, 0.28, 1.22);
  const probe = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.2, 0.3, 1.3), new THREE.Vector3(-1.4, 0.0, 2.3), new THREE.Vector3(-2.4, 0.0, 2.9), new THREE.Vector3(-3.4, 0.05, 2.6)]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(probe, 30, 0.04, 8), BLACKP()); tube.castShadow = true; g.add(tube);
  return g;
}
export function multimeter(parent, x, y, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  rbox(g, 1.2, 0.22, 2.3, std('#f0b429', { roughness: 0.55 }), 0, 0.11, 0, 0.08);
  rbox(g, 0.9, 0.04, 0.62, std('#9fb89a', { roughness: 0.3 }), 0, 0.23, -0.65, 0.01);
  const c = canvasTex(128, 64, (cx) => { cx.fillStyle = '#b6c9b0'; cx.fillRect(0, 0, 128, 64); cx.fillStyle = '#1a2a1a'; cx.font = '700 38px ui-monospace, monospace'; cx.fillText('4.98', 6, 46); cx.font = '14px monospace'; cx.fillText('V', 100, 30); });
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.42), new THREE.MeshBasicMaterial({ map: c.tex })); sc.rotation.x = -Math.PI / 2; sc.position.set(0, 0.255, -0.65); g.add(sc);
  cyl(g, 0.38, 0.38, 0.1, std('#2a2a2a'), 0, 0.25, 0.3); box(g, 0.08, 0.06, 0.3, '#fff', 0, 0.31, 0.22);
  for (const dx of [-0.35, 0, 0.35]) cyl(g, 0.09, 0.09, 0.08, std('#111'), dx, 0.25, 0.85);
  return g;
}
export function solderStation(parent, ctx, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  rbox(g, 2.2, 1.0, 1.7, std('#2a2d35', { roughness: 0.45 }), 0, 0.5, 0, 0.1);
  rbox(g, 2.2, 0.2, 1.7, std('#d24b3a', { roughness: 0.4 }), 0, 1.0, 0, 0.08);
  const dsp = canvasTex(128, 64, (c, w, h, t) => { c.fillStyle = '#150404'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3b2a'; c.shadowColor = '#ff3b2a'; c.shadowBlur = 8; c.font = '700 40px ui-monospace, monospace'; c.fillText('350', 22, 46); c.font = '16px monospace'; c.fillText('C', 98, 30); });
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: dsp.tex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })); sc.position.set(-0.3, 0.5, 0.86); g.add(sc);
  cyl(g, 0.2, 0.2, 0.12, std('#bbb', { metalness: 1, roughness: 0.3 }), 0.7, 0.55, 0.88).rotation.x = Math.PI / 2;
  // iron stand with coil
  const stand = new THREE.Group(); stand.position.set(1.9, 0, 0.2); g.add(stand);
  rbox(stand, 0.9, 0.2, 1.4, std('#2a2d35', { roughness: 0.4 }), 0, 0.1, 0, 0.05);
  const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 60 }, (_, i) => { const a = i * 0.9; return new THREE.Vector3(Math.cos(a) * 0.22, 0.22 + i * 0.016, Math.sin(a) * 0.22 + 0.2); })), 160, 0.018, 6), std('#b9bec8', { metalness: 1, roughness: 0.3 })); coil.castShadow = true; stand.add(coil);
  return g;
}
export function solderSpool(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const a = cyl(g, 0.45, 0.45, 0.06, std('#b81c1c', { roughness: 0.5 }), 0, 0.5, 0); a.rotation.z = Math.PI / 2; a.position.x = -0.2;
  const b = cyl(g, 0.45, 0.45, 0.06, std('#b81c1c', { roughness: 0.5 }), 0.2, 0.5, 0); b.rotation.z = Math.PI / 2;
  const w = cyl(g, 0.3, 0.3, 0.34, M.brushed('#c9ced6'), 0, 0.5, 0, { metalness: 1, roughness: 0.25 }); w.rotation.z = Math.PI / 2;
  return g;
}
export function magnifierLamp(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  cyl(g, 0.55, 0.65, 0.12, '#2a2f3d', 0, 0.06, 0, { metalness: 0.8, roughness: 0.3 });
  cyl(g, 0.07, 0.07, 2.6, '#c8ccd4', 0, 1.4, 0, { metalness: 1, roughness: 0.3 });
  const arm = cyl(g, 0.06, 0.06, 2.2, '#c8ccd4', 0.9, 2.8, 0, { metalness: 1, roughness: 0.3 }); arm.rotation.z = Math.PI / 2 - 0.15;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 16, 48), std('#2a2f3d', { metalness: 0.6, roughness: 0.3 })); ring.position.set(1.9, 2.6, 0.0); ring.rotation.x = 0.35; ring.castShadow = true; g.add(ring);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.93, 40), new THREE.MeshPhysicalMaterial({ color: '#dff3ff', transparent: true, opacity: 0.14, roughness: 0.02, clearcoat: 1, depthWrite: false })); lens.position.copy(ring.position); lens.rotation.copy(ring.rotation); g.add(lens);
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 8, 48), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff7e0', emissiveIntensity: 3 })); led.position.copy(ring.position); led.rotation.copy(ring.rotation); g.add(led);
  return g;
}
export function tweezers(parent, x, y, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  for (const s of [-1, 1]) { const a = cyl(g, 0.018, 0.012, 1.3, SILVER(), 0.5, 0.07, s * 0.03); a.rotation.z = Math.PI / 2; a.rotation.y = s * 0.03; }
  return g;
}

/* ---------------- screen textures ---------------- */
const KW = new Set(['public', 'class', 'async', 'await', 'return', 'var', 'const', 'import', 'new', 'private', 'using', 'namespace', 'interface', 'export', 'from', 'if', 'else', 'let']);
const CS = [
  'using Azure.Messaging.ServiceBus;', 'namespace Orders.Api.Controllers;', '', 'public class OrdersController : ControllerBase', '{',
  '  private readonly IMediator _bus;', '  [HttpPost("orders")]', '  public async Task<IActionResult> Create(CreateOrder cmd)', '  {',
  '    var id = await _bus.Send(cmd);', '    return Accepted(new { id });', '  }', '', '  // retry with backoff, then dead-letter', '  [HttpGet("health")]',
  '  public IActionResult Health() => Ok();', '}',
];
const TS = [
  "import { Component } from '@angular/core';", "import { toSignal } from '@angular/core/rxjs-interop';", '', '@Component({ selector: "app-orders" })',
  'export class OrdersComponent {', '  orders = toSignal(this.api.list());', '  total = computed(() => this.orders().length);', '',
  '  async submit(cmd: CreateOrder) {', '    const { id } = await this.api.create(cmd);', '    this.router.navigate(["/orders", id]);', '  }', '}', '',
  '// signals, not subscriptions', 'const ready = true;',
];
export function codeScreen(kind) {
  const lines = kind === 'ts' ? TS : CS;
  return canvasTex(768, 480, (c, w, h, t) => {
    c.fillStyle = '#0f1424'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b2240'; c.fillRect(0, 0, w, 34);
    ['#ff5f56', '#ffbd2e', '#27c93f'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(22 + i * 26, 17, 7, 0, 7); c.fill(); });
    c.fillStyle = '#1b2240'; c.fillRect(0, 34, 44, h);
    c.font = '20px ui-monospace, Consolas, monospace'; c.textBaseline = 'top';
    const scroll = t * 1.1, base = Math.floor(scroll), frac = scroll - base;
    for (let i = 0; i < 17; i++) {
      const line = lines[(base + i) % lines.length], y = 46 + i * 26 - frac * 26;
      c.fillStyle = '#3a4468'; c.fillText(String(((base + i) % 99) + 1).padStart(2, ' '), 8, y);
      let x = 60;
      if (line.trim().startsWith('//')) { c.fillStyle = '#5c6a8f'; c.fillText(line, x, y); continue; }
      for (const tok of line.split(/(\s+)/)) {
        c.fillStyle = KW.has(tok) ? '#c792ea' : /^["'].*["']/.test(tok) || tok.startsWith('"') ? '#c3e88d' : /^[A-Z]/.test(tok) ? '#ffcb6b' : '#a6accd';
        c.fillText(tok, x, y); x += c.measureText(tok).width;
      }
    }
    c.fillStyle = 'rgba(255,255,255,.85)'; if (Math.floor(t * 2) % 2) c.fillRect(420, 46 + 6 * 26, 10, 22);
  });
}

const PEOPLE = [['Netherlands', '#f4b183'], ['USA', '#8fb8ff'], ['Saudi Arabia', '#c3e88d'], ['Pakistan', '#ffd166'], ['UAE', '#ff9eb5'], ['Germany', '#b8a1ff']];
export function videoWall() {
  return canvasTex(1536, 768, (c, w, h, t) => {
    c.fillStyle = '#0a0f1f'; c.fillRect(0, 0, w, h);
    const tw = w / 3, th = h / 2, speaker = Math.floor(t * 0.45) % 6;
    PEOPLE.forEach(([name, col], i) => {
      const x = (i % 3) * tw, y = Math.floor(i / 3) * th;
      const g = c.createLinearGradient(x, y, x, y + th); g.addColorStop(0, '#2b3a6b'); g.addColorStop(1, '#141b36');
      c.fillStyle = g; c.beginPath(); c.roundRect(x + 8, y + 8, tw - 16, th - 16, 14); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(x + tw / 2, y + th * 0.42, 56, 0, 7); c.fill();
      c.beginPath(); c.ellipse(x + tw / 2, y + th * 0.92, 108, 92, 0, Math.PI, 0); c.fill();
      c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.roundRect(x + 22, y + th - 62, 220, 38, 8); c.fill();
      c.fillStyle = '#fff'; c.font = '600 24px system-ui, sans-serif'; c.fillText(name, x + 36, y + th - 36);
      if (i === speaker) {
        c.strokeStyle = '#ffb703'; c.lineWidth = 7; c.beginPath(); c.roundRect(x + 10, y + 10, tw - 20, th - 20, 14); c.stroke();
        c.fillStyle = '#ffb703'; for (let k = 0; k < 4; k++) { const a = Math.abs(Math.sin(t * 9 + k)); c.fillRect(x + tw - 78 + k * 13, y + 36 + (3 - k) * 4 - a * 12, 8, 16 + a * 12); }
      }
    });
  });
}

/* ============================== car ============================== */
export function makeCar(parent, ctx, { body = '#1fa5a0', glassTint = '#9fc9e6' } = {}) {
  const car = new THREE.Group(); parent.add(car);
  const wheels = [];
  const paint = new THREE.MeshPhysicalMaterial({ color: body, metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: glassTint, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.38, clearcoat: 1, depthWrite: false });
  const dark = std('#14161c', { roughness: 0.5 });
  const R = (w, h, d, m, x, y, z, r = 0.2) => { const o = mesh(new RoundedBoxGeometry(w, h, d, 4, r), m, car, x, y, z); return o; };
  R(6.5, 1.0, 3.3, paint, 0, 0.95, 0, 0.3);                // lower body
  R(3.3, 1.15, 3.0, paint, -0.4, 1.95, 0, 0.4);             // cabin shell
  R(3.0, 0.82, 3.06, glass, -0.4, 2.0, 0, 0.3);              // glass band
  for (const dx of [-1.55, 0.7]) R(0.14, 1.1, 3.1, paint, dx, 2.0, 0, 0.05);
  R(6.52, 0.08, 3.32, dark, 0, 0.55, 0, 0.03);              // sill
  R(0.12, 0.5, 3.3, dark, 3.28, 0.7, 0, 0.05); R(0.12, 0.5, 3.3, dark, -3.28, 0.7, 0, 0.05); // bumpers
  const hl = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff2c4', emissiveIntensity: 0.3 }), tl = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2a1a', emissiveIntensity: 0.6 });
  R(0.14, 0.34, 0.8, hl, 3.28, 1.1, 1.0, 0.05); R(0.14, 0.34, 0.8, hl, 3.28, 1.1, -1.0, 0.05);
  R(0.14, 0.3, 0.8, tl, -3.28, 1.1, 1.0, 0.05); R(0.14, 0.3, 0.8, tl, -3.28, 1.1, -1.0, 0.05);
  ctx.glows.push({ m: hl, base: 6, min: 0.3 });
  for (const sz of [-1, 1]) R(0.3, 0.2, 0.3, paint, 0.9, 1.7, sz * 1.72, 0.06);
  const tire = std('#0e0f12', { roughness: 0.85 }), rim = std('#d4d8df', { metalness: 1, roughness: 0.22 });
  for (const [x, z] of [[-2.1, 1.7], [2.1, 1.7], [-2.1, -1.7], [2.1, -1.7]]) {
    const w = new THREE.Group(); w.position.set(x, 0.68, z); car.add(w);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.24, 18, 36), tire); t.castShadow = true; w.add(t);
    const r = cyl(w, 0.42, 0.42, 0.34, rim, 0, 0, 0, undefined, 32); r.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const sp = box(w, 0.08, 0.72, 0.06, rim, 0, 0, 0.12); sp.rotation.z = i * Math.PI / 5; }
    cyl(w, 0.12, 0.12, 0.4, '#555', 0, 0, 0, { metalness: 1 }).rotation.x = Math.PI / 2;
    wheels.push(w);
  }
  const head = sph(car, 0.4, '#d6a07a', 0.3, 2.3, 1.25, undefined, 24);
  const hair = mesh(new THREE.SphereGeometry(0.43, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), std('#15151b'), car, 0.28, 2.36, 1.2);
  head.userData.dyn = hair.userData.dyn = true;
  return { car, wheels, head, hair };
}
