import * as THREE from 'three';
import { box, cyl, sph, mesh, smooth, seg, clamp, lerp, labelSprite } from './util.js';
import { std } from './materials.js';

/* Smart home + CCTV + Raspberry Pi server, built in the living room's own (story) coordinates.
   Front door on the left wall (x 157.4) with a smart lock that unlocks when he arrives. */
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const led = (hex, k = 2.5) => new THREE.MeshStandardMaterial({ color: '#111', emissive: hex, emissiveIntensity: k });
const dark = std('#1b1e27', { roughness: 0.4, metalness: 0.5 }), steel = std('#c9ced8', { metalness: 0.9, roughness: 0.25 }), white = std('#eef0f4', { roughness: 0.35 });

export function buildSmartHome(Lr, ctx, ups, { CH, lpOf, pickables }) {
  const dyn = (p) => { const g = new THREE.Group(); g.userData.dyn = true; p.add(g); return g; };
  const flash = [];   // {m, speed, ph}

  /* ---- front door with smart lock (left wall) ---- */
  const DX = 157.4, Z0 = 0.2, Z1 = 3.4;
  const frame = std('#e8e2d6', { roughness: 0.5 });
  box(Lr, 0.3, 7.2, 0.3, frame, DX, 3.6, Z0 - 0.15); box(Lr, 0.3, 7.2, 0.3, frame, DX, 3.6, Z1 + 0.15); box(Lr, 0.3, 0.4, Z1 - Z0 + 0.6, frame, DX, 7.2, (Z0 + Z1) / 2);
  const hinge = dyn(Lr); hinge.position.set(DX, 0, Z0);
  const leaf = dyn(hinge);
  const wood = std('#6b4a32', { roughness: 0.5 });
  box(leaf, 0.22, 7.0, Z1 - Z0, wood, 0, 3.5, (Z1 - Z0) / 2).userData.dyn = true;
  for (const y of [1.9, 5.1]) box(leaf, 0.06, 2.4, 2.0, std('#7d5a3f', { roughness: 0.45 }), 0.14, y, (Z1 - Z0) / 2).userData.dyn = true;
  // smart lock: keypad escutcheon, status ring, thumb-turn, retracting deadbolt
  const lockZ = Z1 - Z0 - 0.55;
  box(leaf, 0.12, 1.5, 0.62, dark, 0.17, 3.7, lockZ).userData.dyn = true;
  const pad = cvs(128, 192), px = pad.getContext('2d');
  px.fillStyle = '#0c0f16'; px.fillRect(0, 0, 128, 192); px.fillStyle = '#1b2433';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { px.fillRect(14 + c * 36, 70 + r * 28, 30, 22); px.fillStyle = '#9fb3d1'; px.font = '16px sans-serif'; px.fillText(r < 3 ? String(r * 3 + c + 1) : ['*', '0', '#'][c], 24 + c * 36, 87 + r * 28); px.fillStyle = '#1b2433'; }
  const padMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), new THREE.MeshBasicMaterial({ map: tex(pad), toneMapped: false })); padMesh.position.set(0.24, 3.55, lockZ); padMesh.rotation.y = Math.PI / 2; leaf.add(padMesh);
  const ringM = led('#ff3b3b', 3), ring = mesh(new THREE.TorusGeometry(0.2, 0.04, 12, 32), ringM, leaf, 0.24, 4.3, lockZ, false); ring.rotation.y = Math.PI / 2; ring.userData.dyn = true;
  cyl(leaf, 0.09, 0.09, 0.22, steel, 0.2, 2.75, lockZ, undefined, 20).rotation.z = Math.PI / 2;
  const bolt = cyl(leaf, 0.13, 0.13, 0.6, steel, 0, 3.0, Z1 - Z0 + 0.1, undefined, 20); bolt.rotation.x = Math.PI / 2; bolt.userData.dyn = true;
  cyl(leaf, 0.06, 0.06, 0.5, steel, 0.22, 3.1, 0.7, undefined, 12).rotation.z = Math.PI / 2;
  // doorbell camera + intercom beside the door (outside), PIR motion sensor over the frame
  box(Lr, 0.18, 1.0, 0.45, dark, DX - 0.4, 4.6, Z1 + 0.9); const dbCam = led('#6fd1ff', 3); sph(Lr, 0.1, dbCam, DX - 0.52, 4.9, Z1 + 0.9, undefined, 12);
  sph(Lr, 0.09, ledMat('#2f7'), DX - 0.52, 4.4, Z1 + 0.9, undefined, 8);
  box(Lr, 0.4, 0.3, 0.4, white, DX + 0.2, 7.55, (Z0 + Z1) / 2);

  /* ---- CCTV: pan/tilt bullet camera over the door + dome inside + wall monitor ---- */
  const cam1 = dyn(Lr); cam1.position.set(DX - 0.9, 8.3, Z1 + 0.3);
  box(cam1, 0.3, 0.3, 0.9, steel, 0, 0.3, -0.2).userData.dyn = true;
  const head1 = dyn(cam1); head1.position.set(0, 0, 0.1);
  cyl(head1, 0.2, 0.22, 1.0, white, 0, 0, 0.3, undefined, 20).rotation.x = Math.PI / 2; cyl(head1, 0.24, 0.24, 0.5, white, 0, 0.14, 0.2, undefined, 20).rotation.x = Math.PI / 2;
  sph(head1, 0.17, std('#0a0c12', { roughness: 0.1, metalness: 0.9 }), 0, 0, 0.85, undefined, 16);
  const rec1 = led('#ff2020', 4); sph(head1, 0.05, rec1, 0.12, 0.1, 0.8, undefined, 8);
  const cam2 = dyn(Lr); cam2.position.set(187, 8.85, -3.2);
  cyl(cam2, 0.5, 0.5, 0.15, white, 0, 0.1, 0, undefined, 24).userData.dyn = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#222', transparent: true, opacity: 0.7, roughness: 0.05, clearcoat: 1 })); dome.position.y = 0.02; cam2.add(dome);
  const lens2 = dyn(cam2); sph(lens2, 0.16, std('#05070b', { metalness: 1, roughness: 0.1 }), 0, -0.12, 0.2, undefined, 12);
  const rec2 = led('#ff2020', 4); sph(lens2, 0.04, rec2, 0.16, -0.05, 0.25, undefined, 8);
  // CCTV monitor: 4 camera tiles, timestamp, REC dots
  const feed = cvs(512, 300), fx = feed.getContext('2d'), feedTex = tex(feed);
  const tiles = ['FRONT DOOR', 'LIVING', 'GARAGE', 'STREET'];
  const draw = (ts) => {
    fx.fillStyle = '#05070a'; fx.fillRect(0, 0, 512, 300);
    tiles.forEach((n, i) => {
      const x = (i % 2) * 256, y = Math.floor(i / 2) * 150;
      const g = fx.createLinearGradient(x, y, x, y + 150); g.addColorStop(0, '#2b3a4a'); g.addColorStop(1, '#10161e'); fx.fillStyle = g; fx.fillRect(x + 3, y + 3, 250, 144);
      fx.fillStyle = 'rgba(160,200,230,.18)'; fx.fillRect(x + 20 + (i * 37) % 60, y + 60, 60, 70); fx.fillRect(x + 140, y + 85, 80, 45);
      for (let k = 0; k < 40; k++) { fx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; fx.fillRect(x + 3, y + 3 + k * 3.6, 250, 1); }
      fx.fillStyle = '#d7e8ff'; fx.font = '700 15px monospace'; fx.fillText('CAM ' + (i + 1) + '  ' + n, x + 10, y + 22);
      fx.fillStyle = '#9fb3d1'; fx.font = '12px monospace'; fx.fillText(ts, x + 10, y + 140);
    });
    feedTex.needsUpdate = true;
  };
  draw('--:--:--');
  box(Lr, 4.4, 2.6, 0.2, dark, 178.4, 5.6, -4.1);
  const mon = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.35), new THREE.MeshBasicMaterial({ map: feedTex, toneMapped: false })); mon.position.set(178.4, 5.6, -3.98); Lr.add(mon);
  const recDot = led('#ff2020', 4); sph(Lr, 0.07, recDot, 176.6, 6.7, -3.95, undefined, 8);
  pickables.push({ obj: mon, onClick: () => { ctx.cctvZoom = !ctx.cctvZoom; } });

  /* ---- Raspberry Pi server rack ---- */
  const RX = 159.4, RZ = -3.2;
  box(Lr, 2.5, 5.4, 1.6, std('#14171f', { roughness: 0.45, metalness: 0.5 }), RX, 2.7, RZ);
  const bay = (y, h) => box(Lr, 2.3, h, 0.05, std('#0b0d12', { roughness: 0.3 }), RX, y, RZ + 0.83);
  // 1 router
  bay(4.7, 0.7); for (const dx of [-0.8, 0.8]) { const a = cyl(Lr, 0.03, 0.03, 0.9, '#111', RX + dx, 5.5, RZ, undefined, 6); a.rotation.z = dx * 0.25; }
  for (let i = 0; i < 4; i++) { const m = led(['#3f6', '#3f6', '#fc3', '#6cf'][i], 2.5); sph(Lr, 0.045, m, RX - 0.6 + i * 0.35, 4.7, RZ + 0.87, undefined, 8); flash.push({ m, s: 3 + i * 1.7, ph: i }); }
  // 2 switch, 8 ports
  bay(3.8, 0.6); for (let i = 0; i < 8; i++) { box(Lr, 0.16, 0.14, 0.05, std('#222'), RX - 0.9 + i * 0.26, 3.8, RZ + 0.88); const m = led(i % 3 ? '#3f6' : '#fc3', 2.2); sph(Lr, 0.025, m, RX - 0.9 + i * 0.26, 3.95, RZ + 0.9, undefined, 6); flash.push({ m, s: 5 + i, ph: i * 0.7 }); }
  // 3 three Raspberry Pis in a cluster, fan + OLED
  for (let i = 0; i < 3; i++) {
    const x = RX - 0.75 + i * 0.75;
    box(Lr, 0.66, 0.9, 0.12, std('#1f7a3a', { roughness: 0.5 }), x, 2.8, RZ + 0.84); box(Lr, 0.2, 0.2, 0.06, steel, x - 0.1, 2.9, RZ + 0.92); box(Lr, 0.3, 0.12, 0.06, dark, x + 0.12, 2.65, RZ + 0.92);
    const ma = led('#3f6', 3), mb = led('#fc3', 3); sph(Lr, 0.03, ma, x + 0.25, 3.15, RZ + 0.9, undefined, 6); sph(Lr, 0.03, mb, x + 0.18, 3.15, RZ + 0.9, undefined, 6); flash.push({ m: ma, s: 4 + i, ph: i }, { m: mb, s: 9 + i, ph: i * 2 });
  }
  const pl = labelSprite('pi-server . openHAB . MQTT', { fg: '#7ff3a8', bg: '#0b1410', font: '700 52px "Bricolage Grotesque", system-ui, sans-serif' }, 0.5); pl.position.set(RX, 5.95, RZ + 0.9); Lr.add(pl);
  // 4 NAS (two bays) + UPS
  bay(1.75, 0.9); for (let i = 0; i < 2; i++) { box(Lr, 0.95, 0.7, 0.05, std('#2b2f3a', { metalness: 0.7, roughness: 0.4 }), RX - 0.55 + i * 1.1, 1.75, RZ + 0.88); const m = led('#4af', 2.5); sph(Lr, 0.03, m, RX - 0.2 + i * 1.1, 1.5, RZ + 0.9, undefined, 6); flash.push({ m, s: 7 + i, ph: i }); }
  bay(0.7, 1.0); box(Lr, 1.0, 0.4, 0.05, std('#222'), RX, 0.7, RZ + 0.88); const upsM = led('#3f6', 2); sph(Lr, 0.04, upsM, RX + 0.8, 0.9, RZ + 0.9, undefined, 6);
  box(Lr, 0.4, 0.3, 0.4, dark, RX + 1.6, 0.15, RZ + 0.2); // power brick

  /* ---- openHAB wall tablet ---- */
  const tab = cvs(512, 340), tx = tab.getContext('2d'), tabTex = tex(tab);
  const drawTab = (locked, who) => {
    tx.fillStyle = '#0d1424'; tx.fillRect(0, 0, 512, 340); tx.fillStyle = '#e9f0ff'; tx.font = '700 28px sans-serif'; tx.fillText('VTOXI Home', 22, 44);
    tx.fillStyle = '#7f93b8'; tx.font = '16px sans-serif'; tx.fillText(who, 22, 70);
    const cell = (x, y, label, val, col) => { tx.fillStyle = '#17213a'; tx.fillRect(x, y, 228, 96); tx.fillStyle = '#7f93b8'; tx.font = '15px sans-serif'; tx.fillText(label, x + 14, y + 28); tx.fillStyle = col; tx.font = '700 26px sans-serif'; tx.fillText(val, x + 14, y + 68); };
    cell(22, 92, 'Front door', locked ? 'LOCKED' : 'UNLOCKED', locked ? '#ff6b6b' : '#5dffa0'); cell(262, 92, 'Cameras', '4 online', '#6fd1ff');
    cell(22, 206, 'Lights', locked ? 'Auto' : 'Welcome', '#ffd166'); cell(262, 206, 'Pi server', 'up 41 d', '#9ef0b0');
    tabTex.needsUpdate = true;
  };
  drawTab(true, 'Away  .  locked  .  armed');
  box(Lr, 2.3, 1.55, 0.14, dark, 162.2, 4.7, -4.12); const tabM = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.4), new THREE.MeshBasicMaterial({ map: tabTex, toneMapped: false })); tabM.position.set(162.2, 4.7, -4.04); Lr.add(tabM);
  pickables.push({ obj: tabM, onClick: () => { ctx.doorToggle = !ctx.doorToggle; } });

  /* ---- animation ---- */
  let lastLocked = true, lastSec = -1;
  ups.push((P, t) => {
    const lp = lpOf(P, 'home'), fam = lpOf(P, 'family');
    const arrived = P >= CH.home.start && P < CH.family.start + 2.2;
    const unlock = smooth(seg(lp, 0.42, 0.5)), open = smooth(seg(lp, 0.5, 0.78)) * (P < CH.family.start ? 1 : 1 - smooth(seg(P, CH.family.start + 0.3, CH.family.start + 2.2)));
    let locked = !(arrived && unlock > 0.5 && (P < CH.family.start + 1.6)); if (ctx.doorToggle) locked = !locked;
    leaf.rotation.y = open * 1.45; bolt.position.z = Z1 - Z0 + 0.1 - (1 - locked * 1) * 0.28 + (locked ? 0 : 0);
    bolt.position.z = (Z1 - Z0) + (locked ? 0.1 : -0.28);
    ringM.emissive.set(locked ? '#ff3b3b' : '#35ff7a'); ringM.emissiveIntensity = locked ? 2.5 + Math.sin(t * 6) * 1.2 * (P > CH.home.start - 1 && P < CH.home.start + 3.4 ? 1 : 0) : 3.5;
    if (locked !== lastLocked) { lastLocked = locked; drawTab(locked, locked ? 'Away  .  locked  .  armed' : 'Welcome home, Faisal  .  disarmed'); }
    const blink = Math.sin(t * 4) > 0 ? 4 : 0.2; rec1.emissiveIntensity = rec2.emissiveIntensity = recDot.emissiveIntensity = blink;
    head1.rotation.y = Math.sin(t * 0.5) * 0.55 - 0.2; lens2.rotation.y = Math.sin(t * 0.37) * 0.9; lens2.rotation.x = 0.35 + Math.sin(t * 0.8) * 0.12;
    dbCam.emissiveIntensity = 2.5 + Math.sin(t * 3) * 0.8;
    for (const f of flash) f.m.emissiveIntensity = 0.3 + (Math.sin(t * f.s + f.ph) > 0.2 ? 3 : 0);
    const sec = Math.floor(t * 2);
    if (sec !== lastSec && ctx.lookX > -10 && ctx.lookX < 30) { lastSec = sec; const d = new Date(); draw(d.toTimeString().slice(0, 8)); }
  });
  return { leaf, ring: ringM };
}
function ledMat(c) { return new THREE.MeshStandardMaterial({ color: '#111', emissive: c, emissiveIntensity: 3 }); }
