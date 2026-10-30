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
  peugeot: {      // Peugeot 2008 (2nd gen, 2020+ facelift): 4.30 m, short overhangs, black cladding, roof rails, lion-claw lights
    body: [[-2.15, .62, .5, .7, .9], [-2.08, .78, .42, .84, .95], [-1.8, .86, .38, .93, .96], [-1, .88, .36, .98, .97], [0, .89, .36, 1.0, .97], [1.2, .88, .36, 1.02, .97], [1.9, .84, .4, 1.0, .96], [2.1, .76, .44, .95, .94], [2.15, .62, .5, .86, .9]],
    cabin: [[-.75, .74, .98, 1.02, .9], [-.25, .72, .98, 1.4, .86], [.3, .7, .98, 1.55, .85], [1.25, .7, .98, 1.56, .85], [1.75, .74, .98, 1.4, .88], [2.0, .78, .98, 1.05, .92]],
    wheel: [.345, .215, .765, 1.3, -1.3], hy: .86, ty: 1.0, peugeot: true,
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
    if (S.peugeot) lamp.push(sph(.16, .06, .03, sx * .6, S.hy - .03, f + .075)); else { lamp.push(sph(.2, .085, .06, sx * hw * .7, S.hy, f + .06)); tail.push(sph(.2, .075, .06, sx * hw * .72, S.ty, r - .05)); }
    paint.push(box(.09, .09, .16, sx * (hw + .1), S.cabin[0][3] + .02, S.cabin[0][0] - .05));                  // mirrors
    trim.push(box(.02, .04, .18, sx * (hw + .01), S.body[3][3] - .24, 0.35 + (style === 'pickup' ? .1 : 0)));    // door handle
    trim.push(box(.18, .18, .02, sx * hw * .8, .62, f + .02));                                                   // fog light recess
  }
  {
    const cz0 = S.cabin[1][0], L = S.cabin.at(-2)[0] - cz0;
    for (const sx of [-1, 1]) {
      for (const q of [0.12, 0.5, 0.86]) trim.push(box(.012, S.body[3][3] - .45, .014, sx * (hw * 0.995 + .004), (S.body[3][3] + .4) / 2 - .05, cz0 + L * q));    // door seams
      paint.push(box(.06, .52, .09, sx * (S.cabin[2][1] - .02), S.cabin[2][3] - .26, cz0 + L * 0.5));                                                             // B pillar
      trim.push(box(.012, .035, L * 0.9, sx * (hw * 0.99 + .004), S.body[3][3] - .06, cz0 + L * 0.5));                                                            // belt-line trim
      chrome.push(box(.014, .03, L * 0.84, sx * (S.cabin[2][1] + .01), S.cabin[2][2] + .04, cz0 + L * 0.5));                                                      // window sill
    }
  }
  trim.push(box(hw * 1.9, .15, .16, 0, .5, f + .05), box(hw * 1.9, .15, .16, 0, .5, r - .05), box(hw * 1.2, .13, .05, 0, S.hy - .14, f + .02));   // bumpers + grille
  chrome.push(box(hw * 1.1, .03, .04, 0, S.hy - .08, f + .02), box(hw * 1.1, .03, .04, 0, S.hy - .2, f + .02));
  trim.push(new THREE.CylinderGeometry(.04, .04, .3, 8).rotateX(Math.PI / 2).translate(hw * .55, .38, r + .1));  // exhaust
  if (S.peugeot) {
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) lamp.push(box(.024, .24 - k * .035, .03, sx * (.5 + k * .05), S.hy - .02 - k * .0, f + .035));             // lion-claw LED signature (front)
      for (let k = 0; k < 3; k++) tail.push(box(.03, .2 - k * .03, .03, sx * (.78 - k * .06), S.ty + .02, r - .0));                          // three-claw tail lights
      trim.push(new THREE.TorusGeometry(.345 + .07, .04, 6, 18, Math.PI).rotateY(Math.PI / 2).translate(sx * (hw + .005), .345, -1.3), new THREE.TorusGeometry(.345 + .07, .04, 6, 18, Math.PI).rotateY(Math.PI / 2).translate(sx * (hw + .005), .345, 1.3));   // black arch cladding
      trim.push(box(.05, .15, 2.1, sx * (hw + .002), .46, 0));                                                                              // sill cladding
      chrome.push(box(.045, .045, 1.9, sx * .6, 1.6, .55));                                                                                 // roof rails
      paint.push(box(.045, .06, .05, sx * .6, 1.575, -.35), box(.045, .06, .05, sx * .6, 1.575, 1.45));
    }
    tail.push(box(hw * 1.3, .04, .03, 0, S.ty + .06, r - .0));                                                                              // light band
    trim.push(box(hw * 1.15, .22, .045, 0, S.hy - .2, f + .02), box(hw * 1.5, .06, .1, 0, 1.55, 1.98), box(hw * .9, .2, .03, 0, .62, r + .0));   // grille, roof spoiler, rear bumper insert
    chrome.push(new THREE.CylinderGeometry(.065, .065, .02, 18).rotateX(Math.PI / 2).translate(0, S.hy - .2, f - .005), new THREE.CylinderGeometry(.05, .05, .02, 18).rotateX(Math.PI / 2).translate(0, S.ty + .32, r + .01));   // lion badge, rear badge
    chrome.push(box(hw * 1.2, .012, .05, 0, S.hy - .08, f + .02));
  }
  const [wr, ww, hx, zf, zr] = S.wheel, wheels = [[-hx, wr, zf, wr, ww], [hx, wr, zf, wr, ww], [-hx, wr, zr, wr, ww], [hx, wr, zr, wr, ww]];
  return { paint, glass, trim, chrome, lamp, tail, wheels, len: r - f, f, r, hw, S };
}

const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const WH = [1, 1, 1];
/** single vertex-coloured geometry for instanced traffic (paint stays white so instanceColor tints it) */
export function trafficGeo(style, paintCol = WH, extra = []) {
  const p = carParts(style), out = [];
  const add = (list, c, mask = 0) => { for (const g of list) { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); n.setAttribute('paintMask', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count).fill(mask), 1)); out.push(col(n, c)); } };
  add(p.paint, paintCol, 1); for (const [g, c] of extra) add([g], c, 0); add(p.glass, [.09, .12, .16]); add(p.trim, [.05, .05, .05]); add(p.chrome, [.6, .6, .62]); add(p.lamp, [1, .93, .75]); add(p.tail, [.8, .06, .06]);
  for (const [x, y, z, r, w] of p.wheels) { const { tyre, rim } = wheelGeos(r, w); add([tyre.clone().translate(x, y, z)], [.04, .04, .04]); add([rim.clone().translate(x + Math.sign(x) * .02, y, z)], [.55, .56, .58]); }
  return mergeGeometries(out);
}

/** pakistani number plate texture */
export function plateTex(txt = 'ICT-' + (1000 + Math.floor(Math.random() * 8999)), head = 'ISLAMABAD') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#f3f1e8'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(2, 2, 252, 60);
  x.fillStyle = '#16301e'; x.font = '700 38px sans-serif'; x.textAlign = 'center'; x.fillText(txt, 128, 42); x.font = '600 10px sans-serif'; x.fillText(head, 128, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const colorize = col;

// ---------- other vehicles (instanced traffic): vertex coloured, paintMask = 1 where the instance tint applies ----------
const W3 = [1, 1, 1], K = [.05, .05, .05], S = [.62, .63, .66], GL = [.09, .12, .16], LAMP = [1, .93, .75], RED = [.8, .06, .06], SKIN = [.55, .38, .28];
const WOODA = [.5, .34, .17], WOODB = [.38, .25, .12], GREYD = [.5, .46, .42];
const wrap = list => mergeGeometries(list.map(([g, c, m]) => {
  const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  n.setAttribute('paintMask', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count).fill(m ? 1 : 0), 1)); return col(n, c);
}));
const B = (w, h, d, x, y, z, c, rx = 0, p = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); return [g.translate(x, y, z), c, p]; };
const E = (sx, sy, sz, x, y, z, c, p = 0, rx = 0) => { const g = new THREE.SphereGeometry(1, 10, 8).scale(sx, sy, sz); if (rx) g.rotateX(rx); return [g.translate(x, y, z), c, p]; };
const CY = (r0, r1, h, x, y, z, c, rx = 0, rz = 0) => [new THREE.CylinderGeometry(r0, r1, h, 10).rotateX(rx).rotateZ(rz).translate(x, y, z), c, 0];
const WHL = (x, y, z, r, w) => { const { tyre, rim } = wheelGeos(r, w); return [[tyre.translate(x, y, z), [.04, .04, .04], 0], [rim.translate(x, y, z), [.6, .6, .62], 0]]; };
/** seated person facing -z; (x, y, z) = seat position */
const PERSON = (x, y, z, shirt, pants = [.2, .2, .24], lean = 0.2) => [
  E(.2, .3, .13, x, y + 0.5, z, shirt, 0, -lean), E(.11, .13, .115, x, y + 0.92, z - lean * .4, SKIN), E(.12, .075, .12, x, y + 0.99, z - lean * .4 + .01, [.05, .05, .06]),
  ...[-1, 1].map(s => B(.1, .6, .1, x + s * .23, y + 0.38, z - .2, shirt, -1.9)),
  ...[-1, 1].map(s => B(.14, .36, .14, x + s * .12, y + 0.05, z - .1, pants, -2.0)), ...[-1, 1].map(s => B(.12, .42, .12, x + s * .18, y - .2, z - .32, pants, 2.9)),
];
export function bikeGeo(qingqi = false) {
  const rz = qingqi ? 0.35 : 0.62, parts = [
    ...WHL(0, .3, -.62, .3, .09), ...(qingqi ? [] : WHL(0, .3, rz, .3, .09)),
    B(.04, .66, .05, 0, .62, -.6, S, .22), B(.12, .1, .85, 0, .52, .05, K), B(.18, .26, .3, 0, .44, 0, [.35, .35, .38]),
    E(.14, .1, .26, 0, .84, -.2, W3, 1), B(.2, .08, .55, 0, .78, .3, K), B(.5, .02, .03, 0, 1.0, -.5, K), B(.03, .03, .3, 0, 1.0, -.5, K),
    E(.09, .09, .06, 0, .95, -.72, LAMP), E(.05, .04, .03, 0, .74, rz, RED), E(.07, .03, .3, 0, .62, -.62, W3, 1),
    CY(.04, .05, .8, .14, .3, .25, S, Math.PI / 2), B(.04, .1, .04, .3, 1.04, -.5, S), B(.04, .1, .04, -.3, 1.04, -.5, S),
    ...PERSON(0, .55, .25, [.84, .82, .76]),
  ];
  if (qingqi) parts.push(...WHL(-.6, .3, .95, .3, .12), ...WHL(.6, .3, .95, .3, .12), B(1.5, .08, 1.5, 0, .72, 1.05, K), B(.06, .35, 1.5, -.74, .92, 1.05, W3, 0, 1), B(.06, .35, 1.5, .74, .92, 1.05, W3, 0, 1), B(1.5, .35, .06, 0, .92, 1.8, W3, 0, 1), B(1.5, .35, .06, 0, .92, .3, W3, 0, 1), E(.4, .25, .4, 0, 1.0, 1.1, [.78, .7, .5]), E(.3, .2, .3, .3, 1.05, 1.5, [.7, .62, .45]));
  return wrap(parts);
}
export const qingqiGeo = () => bikeGeo(true);
export function rickGeo() {
  return wrap([
    ...WHL(0, .25, -.95, .25, .12), ...WHL(-.65, .25, .9, .25, .12), ...WHL(.65, .25, .9, .25, .12),
    B(1.3, .5, 1.5, 0, .62, .55, W3, 0, 1), E(.62, .34, .62, 0, .72, -.5, W3, 1), B(1.1, .1, .5, 0, .95, -.1, K),
    B(1.16, .72, .04, 0, 1.28, -.46, GL, -.28), B(.06, .95, .06, -.62, 1.22, -.2, K), B(.06, .95, .06, .62, 1.22, -.2, K), B(.06, .95, .06, -.62, 1.22, 1.15, K), B(.06, .95, .06, .62, 1.22, 1.15, K),
    E(.72, .08, 1.05, 0, 1.7, .4, [.08, .08, .08]), B(.9, .3, .03, 0, 1.4, 1.17, GL), B(1.1, .12, .6, 0, 1.0, .75, [.16, .1, .08]), B(1.1, .5, .1, 0, 1.28, 1.1, [.16, .1, .08]),
    E(.1, .1, .08, 0, .85, -1.05, LAMP), E(.2, .05, .36, 0, .6, -.95, W3, 1), B(.04, .5, .04, 0, .5, -.9, S), B(.7, .03, .03, 0, 1.02, -.55, K),
    ...PERSON(.18, .96, .15, [.72, .74, .8], [.8, .78, .7], 0.05),
  ]);
}
export function vanGeo() {
  return wrap([
    ...WHL(-.7, .29, -1.15, .29, .2), ...WHL(.7, .29, -1.15, .29, .2), ...WHL(-.7, .29, 1.1, .29, .2), ...WHL(.7, .29, 1.1, .29, .2),
    B(1.5, .72, 3.8, 0, .76, 0, W3, 0, 1), B(1.46, .6, 3.1, 0, 1.4, .3, W3, 0, 1), B(1.3, .55, .04, 0, 1.34, -1.2, GL, -.5), B(1.48, .34, 2.5, 0, 1.46, .45, GL), B(.06, .6, .08, -.75, 1.4, .1, W3, 0, 1), B(.06, .6, .08, .75, 1.4, .1, W3, 0, 1), B(.06, .6, .08, -.75, 1.4, 1.2, W3, 0, 1), B(.06, .6, .08, .75, 1.4, 1.2, W3, 0, 1),
    B(1.5, .06, 3.2, 0, 1.73, .3, W3, 0, 1), B(1.44, .6, .1, 0, 1.0, -1.88, W3, 0, 1), B(1.56, .16, .14, 0, .52, -1.9, K), B(1.56, .16, .14, 0, .52, 1.9, K),
    E(.18, .1, .05, -.5, .96, -1.93, LAMP), E(.18, .1, .05, .5, .96, -1.93, LAMP), E(.12, .08, .04, -.6, .9, 1.92, RED), E(.12, .08, .04, .6, .9, 1.92, RED), B(.5, .12, .03, 0, .78, -1.93, S),
    B(.012, .55, .014, .755, 1.0, -.3, K), B(.012, .55, .014, -.755, 1.0, -.3, K), B(.012, .55, .014, .755, 1.0, .6, K), B(.012, .55, .014, -.755, 1.0, .6, K),
  ]);
}
export function truckGeo() {
  const panels = [[.85, .2, .1], [.1, .55, .25], [.95, .75, .1], [.15, .3, .75]], out = [
    ...WHL(-1, .52, -2.6, .52, .3), ...WHL(1, .52, -2.6, .52, .3),
    ...[1.9, 2.65].flatMap(z => [...WHL(-1, .52, z, .52, .3), ...WHL(1, .52, z, .52, .3)]),
    B(2.1, 1.5, 1.7, 0, 1.55, -3.1, W3, 0, 1), B(1.9, .55, .04, 0, 1.95, -3.96, GL), B(.04, .5, .8, -1.06, 1.95, -3.2, GL), B(.04, .5, .8, 1.06, 1.95, -3.2, GL), B(1.6, .55, .05, 0, 1.15, -3.97, S), B(2.2, .22, .22, 0, .66, -4.0, S),
    E(.15, .1, .05, -.75, 1.15, -3.99, LAMP), E(.15, .1, .05, .75, 1.15, -3.99, LAMP), B(1.4, .06, 1.4, 0, 2.33, -3.1, W3, 0, 1),
    B(1.2, .26, 7.6, 0, .78, -.4, K), B(2.4, .12, 5.6, 0, 1.25, .9, WOODA), B(2.4, 1.0, .08, 0, 1.8, -1.9, W3, 0, 1), E(.9, .32, .05, 0, 2.5, -1.88, [.95, .75, .1]),
    CY(.06, .06, 1.8, 1.12, 2.2, -2.3, S), CY(.26, .26, .9, -1.0, .95, -.8, S, 0, Math.PI / 2), B(.1, .1, .35, -1.3, 1.9, -3.9, S), B(.1, .1, .35, 1.3, 1.9, -3.9, S),
    B(2.4, .9, .08, 0, 1.75, 3.65, panels[0]), B(.9, .35, .06, 0, 2.3, 3.66, panels[2]),
  ];
  for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) out.push(B(.08, .65, 1.05, sx * 1.2, 1.6, -1.3 + k * 1.1, panels[(k + (sx > 0 ? 1 : 0)) % 4]), B(.1, .12, 1.1, sx * 1.2, 1.97, -1.3 + k * 1.1, [.9, .9, .85]));
  return wrap(out);
}
export function cartGeo() {
  const out = [], spokeWheel = x => {
    const ring = new THREE.TorusGeometry(.48, .045, 6, 18).rotateY(Math.PI / 2).translate(x, .5, .6); out.push([ring, [.3, .2, .1], 0], CY(.07, .07, .14, x, .5, .6, S, 0, Math.PI / 2));
    for (let k = 0; k < 4; k++) out.push(B(.04, .94, .04, x, .5, .6, WOODB, k * Math.PI / 4));
  };
  spokeWheel(-.82); spokeWheel(.82);
  out.push(B(1.5, .1, 2.5, 0, .95, .5, WOODA), B(.06, .32, 2.5, -.75, 1.16, .5, WOODB), B(.06, .32, 2.5, .75, 1.16, .5, WOODB), B(1.5, .32, .06, 0, 1.16, -.75, WOODB), B(1.5, .32, .06, 0, 1.16, 1.75, WOODB),
    B(.06, .06, 2.7, -.38, .9, -1.9, WOODB, .04), B(.06, .06, 2.7, .38, .9, -1.9, WOODB, .04),
    E(.35, .22, .4, -.3, 1.2, 1.2, [.78, .7, .5]), E(.3, .2, .35, .3, 1.2, 1.3, [.7, .62, .45]), E(.3, .2, .3, 0, 1.4, 1.2, [.74, .66, .48]));
  const G = GREYD;                                                       // donkey
  out.push(E(.27, .3, .62, 0, 1.08, -2.9, G), E(.17, .26, .2, 0, 1.38, -3.35, G, 0, -.5), E(.12, .15, .26, 0, 1.55, -3.72, G, 0, .3), E(.08, .08, .1, 0, 1.45, -3.95, [.2, .18, .16]),
    B(.04, .22, .04, -.07, 1.75, -3.7, G, 0, 0, .2), B(.04, .22, .04, .07, 1.75, -3.7, G, 0, 0, -.2), B(.03, .45, .03, 0, .95, -2.25, G, .3));
  for (const x of [-.14, .14]) for (const z of [-2.6, -3.2]) out.push(B(.09, .78, .09, x, .4, z, G), B(.1, .06, .12, x, .03, z, [.1, .1, .1]));
  out.push(...PERSON(0, 1.05, -.2, [.8, .78, .7], [.76, .74, .66], 0.05));
  return wrap(out);
}
