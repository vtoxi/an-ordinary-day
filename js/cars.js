/** Car bodies lofted from cross-section stations (smooth curved panels instead of extruded slabs). z: front = negative, rear = positive. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const sgn = v => (v < 0 ? -1 : 1);
/** stations: [z, halfWidth, yBottom, yTop, topWidthFactor]; rounded-rectangle rings joined into a closed hull */
export function loft(st, n = 20, cap = true) {
  const pos = [], idx = [];
  for (const [z, hw, yb, yt, tf] of st) for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), ex = sgn(c) * Math.abs(c) ** 0.42, ey = sgn(s) * Math.abs(s) ** 0.42, v = (ey + 1) / 2;
    pos.push(hw * ex * (1 + (tf - 1) * v), yb + (yt - yb) * v, z);
  }
  for (let k = 0; k < st.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n; idx.push(a, b, c, b, d, c);
  }
  if (cap) for (const [k, flip] of [[0, true], [st.length - 1, false]]) {
    const c = pos.length / 3, [z, , yb, yt] = st[k]; pos.push(0, (yb + yt) / 2, z);
    for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n; idx.push(...(flip ? [c, b, a] : [c, a, b])); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const sph = (sx, sy, sz, x, y, z) => new THREE.SphereGeometry(1, 12, 8).scale(sx, sy, sz).translate(x, y, z);

export function wheelGeos(r, w) {
  const prof = [[r * 0.5, -w / 2], [r * 0.88, -w / 2], [r * 0.98, -w * 0.38], [r, -w * 0.1], [r, w * 0.1], [r * 0.98, w * 0.38], [r * 0.88, w / 2], [r * 0.5, w / 2]].map(([x, y]) => new THREE.Vector2(x, y));
  const tyre = new THREE.LatheGeometry(prof, 24).rotateZ(Math.PI / 2);
  const parts = [new THREE.CylinderGeometry(r * 0.64, r * 0.64, w * 0.86, 20).rotateZ(Math.PI / 2)];
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; parts.push(box(w * 0.9, r * 0.1, r * 0.56, 0, 0, 0).translate(0, 0, r * 0.3).rotateX(a)); }
  return { tyre, rim: mergeNI(parts) };
}
export const mergeNI = parts => mergeGeometries(parts.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }));

const STYLE = {
  sedan: {
    body: [[-2.3, .62, .46, .58, .9], [-2.22, .78, .4, .74, .95], [-1.9, .85, .36, .84, .96], [-1, .88, .34, .93, .97], [.2, .89, .34, .97, .97], [1.3, .88, .34, .98, .97], [1.95, .84, .38, .95, .96], [2.2, .76, .42, .88, .94], [2.3, .62, .46, .78, .9]],
    cabin: [[-.75, .72, .94, 1, .9], [-.3, .7, .94, 1.32, .86], [.2, .68, .94, 1.44, .85], [.95, .68, .94, 1.44, .85], [1.35, .72, .94, 1.2, .88], [1.65, .76, .94, 1, .92]],
    wheel: [.31, .22, .86, 1.4, -1.4], hy: .78, ty: .86,
  },
  hatch: {
    body: [[-1.8, .6, .46, .6, .92], [-1.72, .72, .4, .76, .95], [-1.35, .76, .36, .86, .96], [-.6, .77, .34, .92, .97], [.6, .77, .34, .96, .97], [1.45, .76, .36, .98, .96], [1.75, .68, .42, .92, .94], [1.8, .58, .46, .8, .9]],
    cabin: [[-.55, .66, .92, .98, .9], [-.15, .64, .92, 1.45, .86], [.45, .64, .92, 1.52, .85], [1.2, .64, .92, 1.5, .85], [1.62, .68, .92, 1, .92]],
    wheel: [.27, .2, .7, 1.1, -1.1], hy: .76, ty: .84,
  },
  pickup: {
    body: [[-2.6, .7, .6, .78, .92], [-2.5, .88, .5, .94, .95], [-2, .92, .46, 1.1, .96], [-1, .93, .44, 1.14, .97], [.1, .93, .44, 1.16, .97], [.6, .93, .44, 1.1, .97], [.9, .93, .44, 1.08, .97], [2.5, .9, .46, 1.08, .96], [2.6, .82, .5, 1, .94]],
    cabin: [[-.95, .78, 1.14, 1.2, .9], [-.45, .76, 1.14, 1.75, .86], [.45, .76, 1.14, 1.8, .86], [.85, .8, 1.14, 1.28, .92]],
    wheel: [.37, .26, .92, 1.65, -1.65], hy: 1, ty: 1.05, bed: [.9, 2.5],
  },
};

/** {paint, glass, trim, chrome, lamp, tail: geometry[], wheels: [[x,y,z,r,w]], len} for a style */
export function carParts(style) {
  const S = STYLE[style], f = S.body[0][0], r = S.body.at(-1)[0], hw = S.body[3][1], paint = [loft(S.body)], glass = [], trim = [], chrome = [], lamp = [], tail = [];
  glass.push(loft(S.cabin));
  const mid = S.cabin.slice(1, -1).map(([z, w, yb, yt, tf]) => [z, w + 0.012, yt - 0.05, yt + 0.012, tf]);
  paint.push(loft(mid, 16));
  if (S.bed) { const [z0, z1] = S.bed, y = S.body.at(-2)[3]; for (const sx of [-1, 1]) paint.push(box(.07, .32, z1 - z0, sx * (hw - .03), y + .14, (z0 + z1) / 2)); paint.push(box(hw * 2 - .1, .32, .07, 0, y + .14, z1), box(hw * 2 - .1, .32, .07, 0, y + .14, z0)); }
  for (const sx of [-1, 1]) {
    lamp.push(sph(.2, .085, .06, sx * hw * .7, S.hy, f + .06)); tail.push(sph(.2, .075, .06, sx * hw * .72, S.ty, r - .05));
    paint.push(box(.09, .09, .16, sx * (hw + .1), S.cabin[0][3] + .02, S.cabin[0][0] - .05));                  // mirrors
    trim.push(box(.02, .04, .18, sx * (hw + .01), S.body[3][3] - .24, 0.35 + (style === 'pickup' ? .1 : 0)));    // door handle
    trim.push(box(.18, .18, .02, sx * hw * .8, .62, f + .02));                                                   // fog light recess
  }
  trim.push(box(hw * 1.9, .15, .16, 0, .5, f + .05), box(hw * 1.9, .15, .16, 0, .5, r - .05), box(hw * 1.2, .13, .05, 0, S.hy - .14, f + .02));   // bumpers + grille
  chrome.push(box(hw * 1.1, .03, .04, 0, S.hy - .08, f + .02), box(hw * 1.1, .03, .04, 0, S.hy - .2, f + .02));
  trim.push(new THREE.CylinderGeometry(.04, .04, .3, 8).rotateX(Math.PI / 2).translate(hw * .55, .38, r + .1));  // exhaust
  const [wr, ww, hx, zf, zr] = S.wheel, wheels = [[-hx, wr, zf, wr, ww], [hx, wr, zf, wr, ww], [-hx, wr, zr, wr, ww], [hx, wr, zr, wr, ww]];
  return { paint, glass, trim, chrome, lamp, tail, wheels, len: r - f, f, r, hw, S };
}

const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const WH = [1, 1, 1];
/** single vertex-coloured geometry for instanced traffic (paint stays white so instanceColor tints it) */
export function trafficGeo(style, paintCol = WH, extra = []) {
  const p = carParts(style), out = [];
  const add = (list, c) => { for (const g of list) { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); out.push(col(n, c)); } };
  add(p.paint, paintCol); for (const [g, c] of extra) add([g], c); add(p.glass, [.09, .12, .16]); add(p.trim, [.05, .05, .05]); add(p.chrome, [.6, .6, .62]); add(p.lamp, [1, .93, .75]); add(p.tail, [.8, .06, .06]);
  for (const [x, y, z, r, w] of p.wheels) { const { tyre, rim } = wheelGeos(r, w); add([tyre.clone().translate(x, y, z)], [.04, .04, .04]); add([rim.clone().translate(x + Math.sign(x) * .02, y, z)], [.55, .56, .58]); }
  return mergeGeometries(out);
}

/** pakistani number plate texture */
export function plateTex(txt = 'ICT-' + (1000 + Math.floor(Math.random() * 8999))) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#f3f1e8'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(2, 2, 252, 60);
  x.fillStyle = '#16301e'; x.font = '700 38px sans-serif'; x.textAlign = 'center'; x.fillText(txt, 128, 42); x.font = '600 10px sans-serif'; x.fillText('ISLAMABAD', 128, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const colorize = col;
