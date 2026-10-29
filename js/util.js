import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { std } from './materials.js';
export { THREE };

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
/** local progress of p inside [a,b], clamped 0..1 */
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/** shared smooth PBR material from a colour (or pass-through for a material) */
export const mat = (c, o) => (typeof c === 'string' ? std(c, o) : c);

export function mesh(geo, m, parent, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  if (shadow) { o.castShadow = true; o.receiveShadow = true; }
  if (parent) parent.add(o);
  return o;
}
/** bevelled box; flat BoxGeometry for very thin pieces */
export function box(p, w, h, d, c, x = 0, y = 0, z = 0, o) {
  const mn = Math.min(w, h, d), r = Math.min(0.07, mn * 0.3);
  const g = mn < 0.045 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 3, r);
  return mesh(g, mat(c, o), p, x, y, z);
}
/** large textured slab with world-scaled UVs (texWorld = world units per texture tile) */
export function slab(p, w, h, d, material, x = 0, y = 0, z = 0, texWorld = 4) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / texWorld, uv.getY(k) * dims[f][1] / texWorld);
  }
  return mesh(g, material, p, x, y, z);
}
export const cyl = (p, rt, rb, h, c, x = 0, y = 0, z = 0, o, seg = 32) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, o), p, x, y, z);
export const sph = (p, r, c, x = 0, y = 0, z = 0, o, seg = 32) => mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), mat(c, o), p, x, y, z);

/** canvas-backed texture with a redraw function */
export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const api = { cv, ctx, tex, w, h, redraw(t = 0) { draw(ctx, w, h, t); tex.needsUpdate = true; } };
  api.redraw(0);
  return api;
}
/** a self-lit screen plane (slightly over-bright so bloom picks it up) */
export function screen(parent, w, h, ct, x, y, z, ry = 0, glow = 1.15) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false, color: new THREE.Color(glow, glow, glow) }));
  m.position.set(x, y, z); m.rotation.y = ry;
  parent.add(m);
  return m;
}

export function labelTexture(text, { fg = '#fff', bg = null, font = '700 64px "Bricolage Grotesque", system-ui, sans-serif', pad = 28 } = {}) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = 120;
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  if (bg) { c.fillStyle = bg; c.beginPath(); c.roundRect(0, 0, w, h, 28); c.fill(); }
  c.font = font; c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, aspect: w / h };
}
export function labelSprite(text, opts = {}, height = 1) {
  const { tex, aspect } = labelTexture(text, opts);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(height * aspect, height, 1);
  return s;
}

/** rising soft puffs (steam / smoke) */
export function wisps(parent, n, color, size = 0.22, rise = 2.2) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    m.userData.dyn = true;
    parent.add(m);
    items.push({ m, off: i / n });
  }
  return {
    update(t, strength = 1) {
      for (const it of items) {
        const k = (t * 0.35 + it.off) % 1;
        it.m.position.set(Math.sin(k * 7 + it.off * 9) * 0.25, k * rise, Math.cos(k * 5 + it.off * 4) * 0.12);
        it.m.scale.setScalar(0.6 + k * 1.6);
        it.m.material.opacity = Math.sin(k * Math.PI) * 0.35 * strength;
      }
    },
  };
}

/**
 * Merge all static meshes inside `group` that share a material into single draw calls.
 * Anything tagged userData.dyn (or non-indexed / instanced) is left alone.
 */
export const SOLIDS = [];   // world-space boxes the walking body must not pass through
export function batch(group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.userData.dyn || o.isInstancedMesh || !o.geometry.index || Array.isArray(o.material)) return;
    let p = o.parent, skip = false;
    while (p && p !== group) { if (p.userData.dyn) { skip = true; break; } p = p.parent; }
    if (skip) return;
    if (!o.material.transparent) {
      const b = new THREE.Box3().setFromObject(o), sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
      if (sx < 14 && sy < 8.5 && sy > 0.45 && sz > 0.08 && sx > 0.08 && sz < 6) SOLIDS.push(b);
    }
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    (buckets.get(key) || buckets.set(key, []).get(key)).push(o);
  });
  let n = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      const g = m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, list[0].material);
    mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow;
    group.add(mm);
    for (const m of list) { m.parent.remove(m); m.geometry.dispose(); }
    n++;
  }
  return n;
}
