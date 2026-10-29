import * as THREE from 'three';
import { clamp, smooth, seg } from './util.js';
import { CHAPTERS, TOTAL, chapterAt, hourAt } from './story.js';
import { createSky } from './sky.js';
import { createGfx } from './gfx.js';
import { buildWorld } from './scenes.js';
import { createGame } from './game.js';
import { createDrive } from './drive.js';
import { SOLIDS } from './util.js';

const gsap = window.gsap;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);

/* ---------- renderer / scene ---------- */
const canvas = $('stage');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2600);
const gfx = createGfx(canvas, scene, camera, { lock: q.has('q') ? +q.get('q') : null });
const sky = createSky(scene, gfx.renderer);
const world = buildWorld(scene, sky);

let baseFov = 38, fps = false;
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  gfx.resize(w, h);
  camera.aspect = a;
  baseFov = a >= 1.6 ? 38 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * (a < 1 ? 1.05 : 1.6) / a));
  camera.fov = fps ? 76 : baseFov; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ---------- the camera rail: one GSAP timeline scrubbed by the day ---------- */
const norm = (c) => ({ yaw: 0, pitch: 0, ...c });
const cam = norm(CHAPTERS[0].cam);
const OVERVIEW = norm({ x: 52, y: 14, z: 178, lx: 52, ly: 4 });
const TRAVEL = 3.2;
const tl = gsap.timeline({ paused: true, defaults: { ease: 'none', immediateRender: false } });
tl.set(cam, { ...norm(CHAPTERS[0].cam) }, 0);
CHAPTERS.forEach((c, i) => {
  let end = norm(c.cam);
  if (c.keys) {
    // several authored angles inside one chapter
    let prev = norm(c.cam), tPrev = 0;
    for (const k of c.keys) {
      const { at, ...to } = k, dest = norm(to);
      tl.fromTo(cam, { ...prev }, { ...dest, duration: (at - tPrev) * c.dur, ease: 'power2.inOut' }, c.start + tPrev * c.dur);
      prev = dest; tPrev = at;
    }
    end = prev;
  }
  const next = CHAPTERS[i + 1];
  if (next) tl.fromTo(cam, { ...end }, { ...norm(next.cam), duration: TRAVEL, ease: 'power3.inOut' }, c.end - 1.5);
});
tl.fromTo(cam, { ...norm(CHAPTERS[CHAPTERS.length - 1].cam) }, { ...OVERVIEW, duration: 5.2, ease: 'power2.inOut' }, TOTAL - 5.7);
tl.duration(TOTAL);

/* ---------- virtual scroll + free look ---------- */
let target = 0, cur = 0, playing = false;
const setTarget = (v) => { target = clamp(v); };
const nudge = (d) => { playing && stopPlay(); setTarget(target + d); };
const view = { yaw: 0, pitch: 0, ty: 0, tp: 0 };        // user orbit (smoothed toward ty/tp)
const orbit = (dx, dy) => { const Y = fps ? 3.0 : 0.95; view.ty = clamp(view.ty - dx * 0.006, -Y, Y); view.tp = clamp(view.tp + dy * 0.004, fps ? -0.9 : -0.22, fps ? 0.9 : 0.5); };
const resetView = () => { view.ty = 0; view.tp = 0; };

addEventListener('wheel', (e) => { e.preventDefault(); nudge((e.deltaY + e.deltaX) * 0.00015); }, { passive: false });
// mouse / pen drag = look around
let drag = null;
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); });
addEventListener('pointermove', (e) => {
  ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = -((e.clientY / innerHeight) * 2 - 1);
  if (drag) { orbit(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; }
});
const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
canvas.addEventListener('dblclick', resetView);
// touch: vertical swipe = time, horizontal swipe = look around
let tp = null;
addEventListener('touchstart', (e) => { tp = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t0 = e.touches[0];
  if (tp) { const dx = t0.clientX - tp.x, dy = t0.clientY - tp.y; if (Math.abs(dx) > Math.abs(dy) * 1.2) orbit(dx * 1.3, 0); else nudge(-dy * 0.0026); }
  tp = { x: t0.clientX, y: t0.clientY };
}, { passive: false });
addEventListener('touchend', () => { tp = null; });
const held = new Set(); addEventListener('keydown', (e) => held.add(e.key.toLowerCase())); addEventListener('keyup', (e) => held.delete(e.key.toLowerCase())); addEventListener('blur', () => held.clear());
const DRIVE_MODES = ['fpv', 'chase', 'bird', 'side']; let driveMode = 'fpv';
addEventListener('keydown', (e) => {
  const k = e.key;
  if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(k) && !e.target.closest('a,button')) { e.preventDefault(); nudge(k === 'PageDown' || k === ' ' ? 0.045 : 0.016); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); nudge(k === 'PageUp' ? -0.045 : -0.016); }
  else if (k === 'Home') setTarget(0);
  else if (k === 'End') setTarget(1);
  else if (k === 'p' || k === 'P') togglePlay();
  else if (!fps && (k === 'a' || k === 'A')) orbit(-24, 0);
  else if (!fps && (k === 'd' || k === 'D')) orbit(24, 0);
  else if (!fps && (k === 'w' || k === 'W')) orbit(0, -24);
  else if (!fps && (k === 's' || k === 'S')) orbit(0, 24);
  else if (k === 'c' || k === 'C') driveMode = DRIVE_MODES[(DRIVE_MODES.indexOf(driveMode) + 1) % DRIVE_MODES.length];
  else if (k === 'n' || k === 'N') game.nextStation();
  else if (k === 't' || k === 'T' || k === 'Escape') world.ctx.free = null;
  else if (k === 'r' || k === 'R') resetView();
  else if (k === 'v' || k === 'V') setFps(!fps);
  else if (k === 'm' || k === 'M') game.toggleMute();
});

/* ---------- pointer parallax / nudging toys ---------- */
const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.8), hit = new THREE.Vector3();

/* ---------- HUD ---------- */
const clockEl = $('clock'), titleEl = $('ch-title'), textEl = $('ch-text'), words = document.querySelector('.words');
const fill = $('arc-fill'), dot = $('arc-dot'), list = $('arc-list'), intro = $('intro'), cta = $('cta'), caption = $('caption'), playBtn = $('play');
const srList = $('sr-list');
const lis = CHAPTERS.map((c) => {
  const li = document.createElement('li');
  li.style.left = ((c.start / TOTAL) * 100) + '%';
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.label = c.title; b.setAttribute('aria-label', 'Jump to: ' + c.title);
  b.addEventListener('click', () => { stopPlay(); setTarget((c.start + 0.6) / TOTAL); });
  li.appendChild(b); list.appendChild(li);
  const s = document.createElement('li'); s.innerHTML = `<strong>${c.title}.</strong> ${c.text}`; srList.appendChild(s);
  return li;
});
let shownChapter = -1;
function setChapter(i) {
  if (i === shownChapter) return;
  const first = shownChapter < 0; shownChapter = i;
  lis.forEach((l, k) => l.classList.toggle('on', k === i));
  titleEl.textContent = CHAPTERS[i].title; textEl.textContent = CHAPTERS[i].text;
  if (!first && !reduced) { words.classList.remove('swap'); void words.offsetWidth; words.classList.add('swap'); }
}
const fmt = (h) => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5; return String(hh % 24).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
function stopPlay() { playing = false; playBtn.setAttribute('aria-pressed', 'false'); playBtn.textContent = 'Autoplay the day'; }
function togglePlay() {
  if (playing) return stopPlay();
  if (target > 0.995) setTarget(0);
  playing = true; playBtn.setAttribute('aria-pressed', 'true'); playBtn.textContent = 'Pause';
}
playBtn.addEventListener('click', togglePlay);
const fpsBtn = document.createElement('button'); fpsBtn.className = 'chip play'; fpsBtn.id = 'fps'; fpsBtn.type = 'button'; fpsBtn.setAttribute('aria-pressed', 'false'); fpsBtn.textContent = 'FPS view (V)';
playBtn.insertAdjacentElement('afterend', fpsBtn);
function setFps(on) { if (!on) world.ctx.free = null; fps = on; resetView(); fpsBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); fpsBtn.textContent = on ? 'Back to map view (V)' : 'FPS view (V)'; camera.near = on ? 0.1 : 0.5; camera.fov = on ? 76 : baseFov; camera.updateProjectionMatrix(); if (!on) world.me.head.visible = true; }
fpsBtn.addEventListener('click', () => setFps(!fps));
const game = createGame({ scene, camera, world, canvas });
const drive = createDrive({ scene, camera, getStation: () => game.station() });
const CHI = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
const driveWin = (P) => { const c = CHI.commute, h = CHI.home; if (P >= c.start && P < c.end) { const lp = (P - c.start) / c.dur; return lp >= 0.22 ? { dir: 1, u: (lp - 0.22) / 0.78 } : null; } if (P >= h.start && P < h.end) { const lp = (P - h.start) / h.dur; return lp < 0.5 ? { dir: -1, u: lp / 0.5 } : null; } return null; };
// free-roam walking (FPS view): rooms/levels the player can stand on
const AREAS = { 0: [-30, 140, -3.6, 12.5], 9.6: [-8, 25.3, -3.6, 4.6], 11: [62, 136, -3.6, 4.6], '-13': [24, 97, -3.6, 5] };
function roam(fr, mv, st, run, dt) {
  const sp = (run ? 17 : 9) * dt, fx = Math.sin(fr.ry), fz = Math.cos(fr.ry);
  let nx = fr.x + (fx * mv - fz * st) * sp, nz = fr.z + (fz * mv + fx * st) * sp;
  const onS = (x, z) => x > 25.4 && x < 33.6 && z > -0.1 && z < 3.3;
  if (fr.level !== 'S' && (fr.level === 9.6 || fr.level === 0) && onS(nx, nz) && (fr.level === 9.6 ? nx > 25.3 : nx < 33.4)) fr.level = 'S';
  if (fr.level === 'S') { if (!onS(nx, nz)) { if (nx <= 25.4) fr.level = 9.6; else if (nx >= 33.6) fr.level = 0; else { nx = fr.x; nz = fr.z; } } }
  else { const A = AREAS[fr.level]; nx = clamp(nx, A[0] + 0.6, A[1] - 0.6); nz = clamp(nz, A[2] + 0.6, A[3] - 0.6); }
  const yy = fr.level === 'S' ? 9.6 * (1 - clamp((nx - 25.5) / 8)) : fr.level;
  if (fr.level !== 'S') for (let it = 0; it < 2; it++) for (const b of SOLIDS) {
    if (yy + 6.5 < b.min.y + 0.2 || yy + 0.35 > b.max.y) continue;
    const cx = clamp(nx, b.min.x, b.max.x), cz = clamp(nz, b.min.z, b.max.z), dx = nx - cx, dz = nz - cz, d = Math.hypot(dx, dz);
    if (d < 0.5) { if (d > 1e-4) { nx = cx + dx / d * 0.5; nz = cz + dz / d * 0.5; } else { const ex = Math.min(nx - b.min.x, b.max.x - nx), ez = Math.min(nz - b.min.z, b.max.z - nz); if (ex < ez) nx += (nx - b.min.x < b.max.x - nx ? -1 : 1) * (ex + 0.5); else nz += (nz - b.min.z < b.max.z - nz ? -1 : 1) * (ez + 0.5); } }
  }
  const moved = Math.hypot(nx - fr.x, nz - fr.z); fr.x = nx; fr.z = nz; fr.y = yy; fr.walk = moved > 1e-4 ? 1 : 0; fr.ph += moved * 2.4;
}
$('replay').addEventListener('click', () => { stopPlay(); setTarget(0); resetView(); });

/* ---------- main loop ---------- */
let last = performance.now(), simT = 0;
const base = new THREE.Vector3(), look = new THREE.Vector3(), off = new THREE.Vector3(), hp = new THREE.Vector3(), fd = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
function frame() {
  const now = performance.now(), dtMs = now - last; last = now;
  const dt = Math.min(dtMs / 1000, 0.05);
  simT += dt;
  if (playing) { setTarget(target + dt / 100); if (target >= 1) stopPlay(); }
  cur += (target - cur) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
  if (Math.abs(target - cur) < 1e-5) cur = target;
  const P = cur * TOTAL;
  tl.time(P);

  const k = 1 - Math.exp(-dt * 7);
  view.yaw += (view.ty - view.yaw) * k; view.pitch += (view.tp - view.pitch) * k;
  ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-dt * 3)); ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-dt * 3));
  const par = reduced ? 0 : 1, finale = smooth(seg(P, TOTAL - 5.7, TOTAL - 0.5));
  // orbit the authored camera around its look target
  base.set(cam.x, cam.y, cam.z); look.set(cam.lx, cam.ly, 0); off.copy(base).sub(look);
  const r = off.length(), th = Math.atan2(off.x, off.z) + cam.yaw + view.yaw + ptr.sx * 0.05 * par, ph = Math.asin(clamp(off.y / r, -1, 1)) + cam.pitch + view.pitch + ptr.sy * 0.025 * par + (reduced ? 0 : Math.sin(simT * 0.5) * 0.004);
  camera.position.set(look.x + r * Math.cos(ph) * Math.sin(th), look.y + r * Math.sin(ph), look.z + r * Math.cos(ph) * Math.cos(th));
  camera.lookAt(look);
  if (fps && world.me.group.visible) {
    const me = world.me; me.head.visible = false; me.head.getWorldPosition(hp); me.head.getWorldDirection(fd);
    fd.y = 0; fd.normalize(); fd.applyAxisAngle(UPV, view.yaw); fd.y = -view.pitch * 1.2 - 0.04; fd.normalize();
    hp.addScaledVector(fd, 0.2); camera.position.lerp(hp, 1 - Math.exp(-dt * 24)); look.copy(camera.position).addScaledVector(fd, 6); camera.lookAt(look);
  } else if (fps) world.me.head.visible = true;

  ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera);
  world.setPointer(ray.ray.intersectPlane(plane, hit) ? hit : null);

  const hour = hourAt(P);
  const dw = driveWin(P), drv = !!dw && driveMode !== 'side';
  if (fps && !drv) {
    const mv = (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') ? 1 : 0), st = (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0);
    if ((mv || st) && !world.ctx.free) { const g = world.me.group, lv = [-13, 0, 9.6, 11].reduce((a, b) => (Math.abs(b - g.position.y) < Math.abs(a - g.position.y) ? b : a)); world.ctx.free = { x: g.position.x, y: lv, z: g.position.z, ry: g.rotation.y, level: lv, walk: 0, ph: 0 }; }
    const fr = world.ctx.free; if (fr) { fr.ry += view.yaw; view.ty = view.yaw = 0; roam(fr, mv, st, held.has('shift'), dt); }
  }
  if (drv) { drive.update(dw.dir, dw.u, dt, simT, view, driveMode, sky.dark ?? 0, hour, game.rainK); } else drive.hide();
  const labK = smooth(clamp((-(fps ? camera.position.y : cam.ly) - 3) / 4));
  const camXw = fps || drv ? camera.position.x : cam.lx, camYw = fps || drv ? camera.position.y : cam.ly;
  sky.update(hour, camXw, labK, camYw);
  world.update(P, simT, dt, drv ? cam.lx : camXw, hour, drv ? cam.ly : camYw);
  game.update(P, simT, dt, world.S, hour, camXw, camYw, labK, drv ? { speed: drive.speed, blink: drive.blink, z: camera.position.z } : null);
  gfx.render();
  gfx.tick(dtMs);

  // HUD
  setChapter(chapterAt(P));
  clockEl.textContent = fmt(hour);
  const pct = cur * 100;
  fill.style.width = pct + '%'; dot.style.left = pct + '%';
  intro.classList.toggle('gone', cur > 0.012);
  const c2 = smooth(seg(P, TOTAL - 3.4, TOTAL - 1.0));
  cta.classList.toggle('show', c2 > 0.5); cta.setAttribute('aria-hidden', c2 > 0.5 ? 'false' : 'true');
  caption.style.opacity = 1 - c2;
  if (document.body.classList.contains('loading')) document.body.classList.remove('loading');
}
gfx.renderer.setAnimationLoop(frame);

/* ---------- test / debug hooks ---------- */
if (q.has('p')) { target = cur = clamp(parseFloat(q.get('p'))); }
if (q.has('yaw')) { view.ty = view.yaw = parseFloat(q.get('yaw')); }
window.__story = { setP(v) { target = cur = clamp(v); }, get P() { return cur * TOTAL; }, TOTAL, CHAPTERS, world, cam, gfx, view };
