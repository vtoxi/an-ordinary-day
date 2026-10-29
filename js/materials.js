// Procedural PBR textures (no downloads) + a small material library
import * as THREE from 'three';

let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + rnd() * (b - a);
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function tex(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/** height canvas (grayscale) -> tangent-space normal map canvas */
function normalFrom(src, strength = 2) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h), octx = out.getContext('2d'), o = octx.createImageData(w, h);
  const H = (x, y) => d[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    o.data[i] = (-dx / len * 0.5 + 0.5) * 255; o.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; o.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; o.data[i + 3] = 255;
  }
  octx.putImageData(o, 0, 0);
  return out;
}
function speckle(ctx, w, h, n, a, light = true, size = 1.4) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${rr(0.02, a)})`;
    ctx.fillRect(rnd() * w, rnd() * h, rr(0.6, size), rr(0.6, size));
  }
}

const memo = {};
const once = (k, f) => memo[k] || (memo[k] = f());

/* ---------- texture sets: {map, normalMap, roughnessMap?} ---------- */
export function woodSet(kind = 'floor') {
  return once('wood-' + kind, () => {
    const W = 1024, c = cv(W, W), x = c.getContext('2d'), hc = cv(W, W), hx = hc.getContext('2d'), rc = cv(W, W), rx = rc.getContext('2d');
    const rows = kind === 'floor' ? 8 : 4, ph = W / rows;
    const tones = kind === 'floor' ? ['#a87445', '#b8814f', '#9c6a3e', '#b07a48', '#a06c40'] : ['#d3b58a', '#c9a97c', '#dcbf94', '#c4a273'];
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, W); rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, W, W);
    for (let r = 0; r < rows; r++) {
      let off = rnd() * W * 0.5;
      x.fillStyle = tones[0]; x.fillRect(0, r * ph, W, ph);
      for (let seg = 0; seg < 2; seg++) {
        const px0 = seg * W * 0.5 + off, pw = W * 0.5;
        const px = px0 >= W ? px0 - W : px0;
        x.fillStyle = tones[(rnd() * tones.length) | 0]; x.fillRect(px, r * ph, pw, ph); if (px + pw > W) x.fillRect(px - W, r * ph, pw, ph);
        // grain
        for (let g = 0; g < 70; g++) {
          const gy = r * ph + rnd() * ph, amp = rr(0.4, 2.2), fr = rr(0.004, 0.012), ph0 = rnd() * 6;
          x.strokeStyle = `rgba(${rnd() > 0.5 ? '60,35,15' : '255,220,170'},${rr(0.03, 0.12)})`; x.lineWidth = rr(0.6, 1.8);
          x.beginPath();
          for (let i = 0; i <= pw; i += 16) { const yy = gy + Math.sin(i * fr + ph0) * amp; i ? x.lineTo(px + i, yy) : x.moveTo(px, yy); }
          x.stroke();
          hx.strokeStyle = `rgba(${rnd() > 0.5 ? 70 : 150},${rnd() > 0.5 ? 70 : 150},${rnd() > 0.5 ? 70 : 150},0.12)`; hx.lineWidth = 1; hx.beginPath(); hx.moveTo(px, gy); hx.lineTo(px + pw, gy + amp); hx.stroke();
        }
        // seams
        x.fillStyle = 'rgba(30,18,8,.65)'; x.fillRect(px - 1.5, r * ph, 3, ph); hx.fillStyle = '#202020'; hx.fillRect(px - 2, r * ph, 4, ph); rx.fillStyle = '#d0d0d0'; rx.fillRect(px - 2, r * ph, 4, ph);
      }
      x.fillStyle = 'rgba(30,18,8,.7)'; x.fillRect(0, r * ph - 1.5, W, 3); hx.fillStyle = '#1a1a1a'; hx.fillRect(0, r * ph - 2, W, 4);
    }
    speckle(x, W, W, 5000, 0.07, false);
    return { map: tex(c), normalMap: tex(normalFrom(hc, 3), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
  });
}
export function plasterSet() {
  return once('plaster', () => {
    const W = 512, c = cv(W, W), x = c.getContext('2d'), hc = cv(W, W), hx = hc.getContext('2d');
    x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, W, W); hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, W);
    for (let i = 0; i < 260; i++) { const r = rr(8, 60), px = rnd() * W, py = rnd() * W; const g = x.createRadialGradient(px, py, 0, px, py, r); const v = rnd() > 0.5 ? '255,255,255' : '190,190,200'; g.addColorStop(0, `rgba(${v},0.07)`); g.addColorStop(1, `rgba(${v},0)`); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    speckle(x, W, W, 6000, 0.05, false); speckle(hx, W, W, 9000, 0.35, true, 2.2); speckle(hx, W, W, 9000, 0.35, false, 2.2);
    return { map: tex(c), normalMap: tex(normalFrom(hc, 1.6), { srgb: false }) };
  });
}
export function fabricSet(tight = 6) {
  return once('fabric' + tight, () => {
    const W = 512, c = cv(W, W), x = c.getContext('2d'), hc = cv(W, W), hx = hc.getContext('2d');
    x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, W, W); hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, W);
    const s = tight;
    for (let j = 0; j < W / s; j++) for (let i = 0; i < W / s; i++) {
      const over = (i + j) % 2 === 0;
      x.fillStyle = over ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.14)'; x.fillRect(i * s, j * s, s, s);
      const gr = hx.createLinearGradient(i * s, j * s, over ? i * s + s : i * s, over ? j * s : j * s + s); gr.addColorStop(0, '#303030'); gr.addColorStop(0.5, '#e0e0e0'); gr.addColorStop(1, '#303030'); hx.fillStyle = gr; hx.fillRect(i * s, j * s, s - 1, s - 1);
    }
    speckle(x, W, W, 4000, 0.08, false);
    return { map: tex(c), normalMap: tex(normalFrom(hc, 2.4), { srgb: false }) };
  });
}
export function brushedSet() {
  return once('brushed', () => {
    const W = 512, c = cv(W, W), x = c.getContext('2d'), hc = cv(W, W), hx = hc.getContext('2d'), rc = cv(W, W), rx = rc.getContext('2d');
    x.fillStyle = '#cfd3da'; x.fillRect(0, 0, W, W); hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, W); rx.fillStyle = '#707070'; rx.fillRect(0, 0, W, W);
    for (let i = 0; i < 1400; i++) { const y = rnd() * W, l = rr(60, 400), px = rnd() * W, v = rr(0.04, 0.18); x.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '40,45,55'},${v})`; x.fillRect(px, y, l, 1); hx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${v})`; hx.fillRect(px, y, l, 1); rx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${v})`; rx.fillRect(px, y, l, 1); }
    return { map: tex(c), normalMap: tex(normalFrom(hc, 1.4), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
  });
}
export function concreteSet(base = '#5a5f6d') {
  return once('concrete' + base, () => {
    const W = 1024, c = cv(W, W), x = c.getContext('2d'), hc = cv(W, W), hx = hc.getContext('2d'), rc = cv(W, W), rx = rc.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, W, W); hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, W); rx.fillStyle = '#808080'; rx.fillRect(0, 0, W, W);
    for (let i = 0; i < 160; i++) { const r = rr(20, 140), px = rnd() * W, py = rnd() * W, g = x.createRadialGradient(px, py, 0, px, py, r), v = rnd() > 0.5 ? '255,255,255' : '0,0,0'; g.addColorStop(0, `rgba(${v},0.07)`); g.addColorStop(1, `rgba(${v},0)`); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); const g2 = rx.createRadialGradient(px, py, 0, px, py, r); g2.addColorStop(0, `rgba(${v},0.2)`); g2.addColorStop(1, `rgba(${v},0)`); rx.fillStyle = g2; rx.fillRect(px - r, py - r, r * 2, r * 2); }
    speckle(x, W, W, 14000, 0.14, true, 2); speckle(x, W, W, 14000, 0.14, false, 2); speckle(hx, W, W, 16000, 0.4, true, 2.6); speckle(hx, W, W, 16000, 0.4, false, 2.6);
    x.strokeStyle = 'rgba(0,0,0,.35)'; hx.strokeStyle = '#303030'; x.lineWidth = hx.lineWidth = 2; for (const p of [256, 512, 768]) { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, W); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(W, p); x.stroke(); hx.beginPath(); hx.moveTo(p, 0); hx.lineTo(p, W); hx.stroke(); hx.beginPath(); hx.moveTo(0, p); hx.lineTo(W, p); hx.stroke(); }
    return { map: tex(c), normalMap: tex(normalFrom(hc, 2.2), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
  });
}
export function asphaltSet() {
  return once('asphalt', () => {
    const W = 512, c = cv(W, W), x = c.getContext('2d'), hc = cv(W, W), hx = hc.getContext('2d');
    x.fillStyle = '#3b3e47'; x.fillRect(0, 0, W, W); hx.fillStyle = '#707070'; hx.fillRect(0, 0, W, W);
    for (let i = 0; i < 24000; i++) { const v = (rr(70, 170)) | 0; x.fillStyle = `rgba(${v},${v},${v + 6},${rr(0.2, 0.7)})`; const s = rr(0.8, 2.6); x.fillRect(rnd() * W, rnd() * W, s, s); hx.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},0.5)`; hx.fillRect(rnd() * W, rnd() * W, s, s); }
    return { map: tex(c), normalMap: tex(normalFrom(hc, 2.6), { srgb: false }) };
  });
}
export function leafTexture(c1 = '#2f9e5f', c2 = '#1e7a45') {
  return once('leaf' + c1, () => {
    const c = cv(128, 256), x = c.getContext('2d');
    x.beginPath(); x.moveTo(64, 254); x.bezierCurveTo(8, 200, 0, 90, 64, 4); x.bezierCurveTo(128, 90, 120, 200, 64, 254); x.closePath();
    const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, c2); g.addColorStop(0.5, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 2; x.beginPath(); x.moveTo(64, 250); x.lineTo(64, 12); x.stroke();
    for (let i = 0; i < 9; i++) { const y = 40 + i * 22; x.beginPath(); x.moveTo(64, y + 20); x.lineTo(16 + (i % 2) * 4, y); x.moveTo(64, y + 20); x.lineTo(112 - (i % 2) * 4, y); x.stroke(); }
    return tex(c);
  });
}

/* ---------- material library ---------- */
const cache = new Map();
export function std(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!cache.has(key)) cache.set(key, new ('clearcoat' in o ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ color, roughness: 0.62, metalness: 0, ...o }));
  return cache.get(key);
}
export function phys(color, o = {}) {
  const key = 'P' + color + JSON.stringify(o);
  if (!cache.has(key)) cache.set(key, new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0, ...o }));
  return cache.get(key);
}
const withSet = (name, set, color, o = {}) => {
  const key = name + color + JSON.stringify(o);
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, map: set.map, normalMap: set.normalMap, ...(set.roughnessMap ? { roughnessMap: set.roughnessMap } : {}), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1, 1), ...o }));
  return cache.get(key);
};
export const M = {
  floorWood: (c = '#ffffff') => withSet('fw', woodSet('floor'), c, { roughness: 0.55 }),
  deskWood: (c = '#ffffff') => withSet('dw', woodSet('desk'), c, { roughness: 0.5 }),
  plaster: (c = '#ffffff') => withSet('pl', plasterSet(), c, { roughness: 0.92 }),
  fabric: (c, tight = 6, o = {}) => withSet('fb' + tight, fabricSet(tight), c, { roughness: 0.95, ...o }),
  brushed: (c = '#ffffff', o = {}) => withSet('br', brushedSet(), c, { metalness: 1, roughness: 0.45, ...o }),
  concrete: (c = '#ffffff', base) => withSet('cc' + (base || ''), concreteSet(base), c, { roughness: 0.75 }),
  asphalt: () => withSet('as', asphaltSet(), '#ffffff', { roughness: 0.9 }),
};
