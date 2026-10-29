import { createPhysics } from './physics.js';
import * as THREE from 'three';
import { mat, box, slab, cyl, sph, mesh, canvasTex, screen, labelSprite, labelTexture, wisps, batch, lerp, clamp, smooth, seg, easeOutBack } from './util.js';
import { makeFigure, applyPose } from './figures.js';
import { cityMaterials } from './sky.js';
import { CHAPTERS, L, TOTAL } from './story.js';
import { meState, SEAT_Y, UP1, UP2, LIFT_X, STAIR_X0, STAIR_X1 } from './actor.js';
import * as PR from './props.js';
import { std, phys, M } from './materials.js';
import { buildLab } from './lab.js';
import { buildSmartHome } from './smarthome.js';
import { SOLIDS } from './util.js';

const CH = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
const inChap = (P, id, pad = 0) => P >= CH[id].start - pad && P < CH[id].end + pad;
const lpOf = (P, id) => clamp((P - CH[id].start) / CH[id].dur);

export function buildWorld(scene, skyApi) {
  const ctx = { glows: [], pointer: null, hour: 7, dark: 0, surge: 0 };
  const root = new THREE.Group(); scene.add(root);
  const ups = [];
  const zones = [];
  const zone = () => { const g = new THREE.Group(); root.add(g); zones.push(g); return g; };
  const dyn = (parent) => { const g = new THREE.Group(); g.userData.dyn = true; parent.add(g); return g; };
  const pickables = [];

  /* ===== ground + far world seen through windows ===== */
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1400), new THREE.MeshStandardMaterial({ color: '#4f7a58', roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(130, -0.55, -300); grass.receiveShadow = true; root.add(grass);

  const cityMat = cityMaterials();
  const cityMats = [];
  const facadeMats = {};
  const facadeMat = (color) => facadeMats[color] || (facadeMats[color] = (cityMats.push(cityMat(color)), cityMats[cityMats.length - 1]));
  const facade = (parent, w, h, d, color, x, z) => {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / 10, uv.getY(k) * dims[f][1] / 19); }
    return mesh(g, facadeMat(color), parent, x, h / 2, z);
  };

  const far = zone();
  {
    const pal = ['#8b94b6', '#a3a9c9', '#7c86ad', '#9aa0bf'];
    for (let i = 0, x = -40; x < 340; i++, x += 10 + (i % 3) * 3) facade(far, 8 + (i % 4), 14 + ((i * 7) % 5) * 5, 7, pal[i % 4], x, -30 - (i % 3) * 10);
    const fol = std('#3b8f55', { roughness: 0.95 }), fol2 = std('#4aa766', { roughness: 0.95 }), trunk = std('#5a4130', { roughness: 0.9 });
    for (let x = -30; x < 330; x += 7.5) {
      const z = -12 - ((x * 13) % 5), s = 1 + ((x * 7) % 3) * 0.3;
      cyl(far, 0.28 * s, 0.34 * s, 2.6 * s, trunk, x, 1.3 * s, z);
      sph(far, 1.7 * s, fol, x, 3.8 * s, z, undefined, 20); sph(far, 1.2 * s, fol2, x + 0.7 * s, 5.0 * s, z - 0.3, undefined, 20);
    }
  }

  /* ===== the main character ===== */
  const me = makeFigure({ skin: '#d6a07a', shirt: '#9db4e8', pants: '#27304a', hair: '#15151b' });
  root.add(me.group);
  const PJ = new THREE.Color('#9db4e8'), WORK = new THREE.Color('#2f6fb5');
  const bagOnBack = new THREE.Group(); bagOnBack.userData.dyn = true; me.body.add(bagOnBack);
  box(bagOnBack, 1.2, 1.4, 0.5, '#2d3250', 0, 2.35, -0.62).userData.dyn = true; box(bagOnBack, 0.14, 1.5, 0.12, '#1a1d33', -0.35, 2.4, 0.46).userData.dyn = true; box(bagOnBack, 0.14, 1.5, 0.12, '#1a1d33', 0.35, 2.4, 0.46).userData.dyn = true;

  /* ===== 1. home in the morning (x -8 .. 25) ===== */
  let blanketRef, floorBag, clock, clockFace;
  {
    const Hm = zone(); Hm.position.y = UP1;
    slab(root, 33, 0.5, 9.6, M.concrete('#d8dbe3', '#8a8f9c'), 8.5, UP1 - 0.75, 0.1, 5);
    PR.room(Hm, -8, 25, { wall: '#d9def2', floor: 'wood', right: false, windows: [{ x: 5.2, y: 5.4, w: 4.6, h: 4.4 }] });
    PR.curtains(Hm, 5.2, 5.2, 4.6, 5.6, '#5b6fa8', 1.5);
    const b = PR.bed(Hm, L.bedX); blanketRef = b.blanket; blanketRef.userData.dyn = true;
    slab(Hm, 8.5, 0.07, 6, M.fabric('#5f7fd1', 4, { roughness: 1 }), -3, 0.035, 1.0, 3);
    box(Hm, 1.9, 1.7, 1.9, M.deskWood('#8a6a52'), 1.9, 0.85, -2.7);
    box(Hm, 1.7, 0.04, 1.7, std('#6e5340'), 1.9, 1.0, -2.7);
    const lampM = new THREE.MeshStandardMaterial({ color: '#f7e7c4', emissive: '#ffd08a', emissiveIntensity: 1, roughness: 0.9, side: THREE.DoubleSide });
    cyl(Hm, 0.07, 0.07, 1.0, '#2a2f3d', 2.7, 2.2, -3.0, { metalness: 0.8, roughness: 0.3 }); cyl(Hm, 0.4, 0.62, 0.62, lampM, 2.7, 3.0, -3.0).castShadow = false;
    ctx.glows.push({ m: lampM, base: 1.8, min: 0.3 });
    // alarm clock (dynamic)
    clock = dyn(Hm); clock.position.set(1.4, 1.75, -2.5);
    const cb = cyl(clock, 0.42, 0.42, 0.3, std('#d0392e', { roughness: 0.3, metalness: 0.4 }), 0, 0.42, 0); cb.rotation.x = Math.PI / 2; cb.userData.dyn = true;
    clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshStandardMaterial({ color: '#f4f4f0', emissive: '#ff4d3d', emissiveIntensity: 0.1, roughness: 0.4 })); clockFace.position.set(0, 0.42, 0.16); clock.add(clockFace);
    for (const sx of [-1, 1]) { const bell = sph(clock, 0.14, std('#cfd3da', { metalness: 1, roughness: 0.25 }), sx * 0.32, 0.9, 0, undefined, 16); bell.userData.dyn = true; }
    // wall art, shelves, wardrobe, mirror
    PR.frame(Hm, -2.2, 6.7, 2.6, 1.8, '#2f6fb5'); PR.frame(Hm, 0.6, 6.4, 1.2, 1.6, '#ffb703'); PR.frame(Hm, -5.5, 6.5, 1.8, 1.8, '#d4476b');
    box(Hm, 4.4, 7, 2.3, M.deskWood('#d8c7a6'), L.wardrobeX, 3.5, -3.1);
    for (const dx of [-1.05, 1.05]) box(Hm, 2.0, 6.6, 0.12, M.deskWood('#e3d3b2'), L.wardrobeX + dx, 3.5, -1.92);
    for (const dx of [-0.3, 0.3]) cyl(Hm, 0.05, 0.05, 1.0, std('#b8bcc6', { metalness: 1, roughness: 0.25 }), L.wardrobeX + dx, 3.4, -1.78);
    box(Hm, 3.4, 5.8, 0.18, std('#2b2f40', { roughness: 0.4, metalness: 0.5 }), L.mirrorX, 3.7, -4.0);
    mesh(new THREE.PlaneGeometry(3.0, 5.4), new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.025, envMapIntensity: 1.2 }), Hm, L.mirrorX, 3.7, -3.88, false);
    PR.plant(Hm, 17.4, -3.0, 1.25); PR.plant(Hm, -6.8, -3.3, 1.0, '#6b7bd1');
    // slippers, books, switch
    for (const dx of [-0.35, 0.35]) box(Hm, 0.5, 0.2, 1.0, std('#b9a58a', { roughness: 1 }), -1.1 + dx, 0.12, 2.6);
    floorBag = dyn(Hm); floorBag.position.set(L.bagX, 0, 0.2);
    for (const [w, h, d, y, c] of [[1.6, 1.5, 0.7, 0.75, '#2d3250'], [1.1, 0.5, 0.15, 0.9, '#1a1d33']]) { const m = box(floorBag, w, h, d, M.fabric(c, 6), 0, y, d > 0.5 ? 0 : 0.4); m.userData.dyn = true; }
    // entrance arch
    const ar = std('#efe9dd', { roughness: 0.5 });
    box(Hm, 0.5, 6.4, 0.5, ar, L.archX, 3.2, -2.6); box(Hm, 0.5, 6.4, 0.5, ar, L.archX, 3.2, 3.2); box(Hm, 0.5, 0.5, 6.3, ar, L.archX, 6.5, 0.3);
    batch(Hm);
    ups.push((P, t) => {
      const lp = lpOf(P, 'wake');
      const ringing = P < CH.wake.start + 0.28 * CH.wake.dur;
      clock.rotation.z = ringing ? Math.sin(t * 60) * 0.1 : 0;
      clockFace.material.emissiveIntensity = ringing ? 0.6 + 0.6 * Math.abs(Math.sin(t * 12)) : 0.1;
      blanketRef.visible = lp < 0.3 || P > CH.sleep.start + 1.2;
      floorBag.visible = P < CH.ready.start + 0.84 * CH.ready.dur;
    });
  }

  /* ===== streets, car ===== */
  function street(x0, x1) {
    const Sz = zone();
    const w = x1 - x0, cx = (x0 + x1) / 2;
    slab(Sz, w, 0.5, 16, M.asphalt(), cx, -0.25, 3.5, 6);
    slab(Sz, w, 0.62, 3.4, M.concrete('#d8dbe3', '#8a8f9c'), cx, -0.2, -5.7, 5);
    slab(Sz, w, 0.62, 3, M.concrete('#d8dbe3', '#8a8f9c'), cx, -0.2, 13, 5);
    box(Sz, w, 0.5, 0.26, std('#b8bcc8', { roughness: 0.6 }), cx, 0.12, -3.85); box(Sz, w, 0.5, 0.26, std('#b8bcc8', { roughness: 0.6 }), cx, 0.12, 11.45);
    for (let x = x0 + 2; x < x1 - 1; x += 4.2) box(Sz, 2.2, 0.03, 0.24, std('#e8e2c0', { roughness: 0.7 }), x, 0.02, 3.2);
    const cw = x0 + w * 0.82; for (let i = 0; i < 7; i++) box(Sz, 0.55, 0.03, 6.5, std('#ecebe6', { roughness: 0.7 }), cw + i * 1.0, 0.02, 3.5);
    let i = 0;
    for (let x = x0 - 4; x < x1 + 6; x += 10) { facade(Sz, 8.5, 15 + ((i * 7 + Math.floor(x)) % 5) * 5, 6 + (i % 3) * 2, ['#8b94b6', '#a3a9c9', '#7c86ad', '#9aa0bf'][i % 4], x, -14 - (i % 2) * 6); i++; }
    const fol = std('#3b8f55', { roughness: 0.95 }), fol2 = std('#58b872', { roughness: 0.95 });
    for (let x = x0 + 5; x < x1 - 2; x += 11) {
      cyl(Sz, 0.26, 0.34, 2.6, '#5a4130', x, 1.3, -5.8, { roughness: 0.9 });
      sph(Sz, 1.9, fol, x, 4.0, -5.8, undefined, 24); sph(Sz, 1.4, fol2, x + 0.8, 5.2, -5.6, undefined, 24); sph(Sz, 1.2, fol, x - 0.9, 5.0, -6.2, undefined, 24);
    }
    for (let x = x0 + 10; x < x1 - 2; x += 14) {
      cyl(Sz, 0.1, 0.14, 6.4, std('#2a2f3d', { metalness: 0.8, roughness: 0.35 }), x, 3.2, -4.4);
      box(Sz, 1.1, 0.12, 0.2, std('#2a2f3d', { metalness: 0.8, roughness: 0.35 }), x + 0.5, 6.4, -4.4);
      const m = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffe6a8', emissiveIntensity: 1 }); box(Sz, 0.7, 0.14, 0.4, m, x + 0.9, 6.28, -4.4).castShadow = false; ctx.glows.push({ m, base: 5, min: 0.05 });
    }
    for (let x = x0 + 7; x < x1 - 4; x += 19) { box(Sz, 2.4, 0.12, 0.7, M.deskWood('#9c7a55'), x, 1.0, -5.0); box(Sz, 2.4, 0.7, 0.1, M.deskWood('#9c7a55'), x, 1.5, -5.35); for (const dx of [-1, 1]) box(Sz, 0.12, 0.9, 0.6, std('#2a2f3d', { metalness: 0.8 }), x + dx, 0.5, -5.0); }
    batch(Sz);
  }
  street(24, 63); street(-30, -7);
  PR.stairs(root, STAIR_X0, STAIR_X1, 0, UP1, 1.6, 3.4, 18);
  box(root, 1.5, 0.4, 3.6, std('#8a6a52', { roughness: 0.55 }), 25.0, UP1 - 0.2, 1.6);

  const carRig = (() => { const holder = dyn(root); return PR.makeCar(holder, ctx); })();
  const car = carRig.car;
  function carX(P) {
    if (P < CH.commute.start) return L.carX0;
    if (P < CH.build.end) return lerp(L.carX0, L.carX1, smooth(seg(lpOf(P, 'commute'), 0.22, 0.95)));
    if (P < CH.home.start) return L.carX1;
    return lerp(L.carHomeX0, L.carHomeX1, smooth(seg(lpOf(P, 'home'), 0.04, 0.54))) - 165;
  }
  ups.push((P, t, dt, c, S) => {
    const x = carX(P);
    car.position.set(x, 0, 2.6);
    carRig.wheels.forEach((w) => (w.rotation.z = -x * 0.9));
    carRig.head.visible = carRig.hair.visible = S.inCar;
    car.visible = (P >= CH.ready.start + 4 && P < CH.commute.end + 1) || P >= CH.build.end - 2;
  });

  /* ===== 2. the office (x 62 .. 136) ===== */
  const wall = PR.videoWall();
  const dev = {}, devScreens = [];
  const colA = makeFigure({ shirt: '#c95a74', skin: '#b98262', hair: '#2a1c14' }), colB = makeFigure({ shirt: '#e0a43a', skin: '#e0b090', hair: '#3a2a22', longHair: true }), colC = makeFigure({ shirt: '#4aa88b', skin: '#c9906a', hair: '#1b1b1b', beard: true });
  root.add(colA.group, colB.group, colC.group); colA.group.visible = colB.group.visible = colC.group.visible = false;
  const diaPack = {};
  {
    const O = zone();
    const dressB = (g, w) => PR.blinds(g, w.x, w.y, w.w, w.h);
    PR.room(O, 62, 136, { wall: '#cdd6ea', floor: 'carpet', floorColor: '#59607f', h: 10.5, trim: '#e8ecf6', left: false, windows: [66, 74, 110, 128].map((x) => ({ x, y: 6.4, w: 5, h: 5 })), dress: dressB });
    // glass meeting room (x 80..100) and the lift lobby, with a door gap in each partition
    const glassM = new THREE.MeshPhysicalMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1, depthWrite: false }), frameM = std('#2a2f3d', { metalness: 0.8, roughness: 0.35 });
    for (const px of [80, 100]) {
      for (const [z0, z1] of [[-4.2, -0.2], [2.4, 4.6]]) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 10.2), glassM); pm.rotation.y = Math.PI / 2; pm.position.set(px, 5.1, (z0 + z1) / 2); O.add(pm); box(O, 0.16, 10.2, 0.16, frameM, px, 5.1, z0); box(O, 0.16, 10.2, 0.16, frameM, px, 5.1, z1); }
      box(O, 0.2, 0.3, 9, frameM, px, 7.2, 0.2); box(O, 0.2, 0.3, 9, frameM, px, 0.15, 0.2);
    }
    const mrSign = labelSprite('Meeting room 2', { fg: '#0b1020', bg: '#9ad7ff', font: '700 56px "Bricolage Grotesque", system-ui, sans-serif' }, 0.55); mrSign.position.set(80.2, 8.4, 1.1); O.add(mrSign);
    PR.plant(O, 63.8, -3, 1.4); PR.plant(O, 134, -3, 1.4); PR.plant(O, 98.6, -3.2, 1.1);
    const U = new THREE.Group(); U.position.y = UP2; O.add(U);
    const devBlock = (cx, chairX, kinds) => {
      PR.deskUnit(O, cx, -2.7, 12);
      const a = PR.codeScreen(kinds[0]), b = PR.codeScreen(kinds[1]);
      PR.monitor(O, cx - 0.9, 3.55, -3.0, 4.2, 2.5, a, 0.15); PR.monitor(O, cx + 3.7, 3.55, -3.0, 4.2, 2.5, b, -0.1);
      PR.keyboard(O, cx + 1.2, 1.92, -1.75); PR.mug(O, cx - 4.3, 1.87, -2.0); box(O, 1.3, 0.05, 0.9, std('#f2f0ea', { roughness: 0.7 }), cx + 4.9, 1.9, -1.9); box(O, 1.0, 0.04, 0.7, std('#2f6fb5', { roughness: 0.6 }), cx + 4.9, 1.94, -1.7);
      const lampG = new THREE.Group(); lampG.position.set(cx + 5.4, 1.88, -3.2); O.add(lampG); cyl(lampG, 0.4, 0.46, 0.08, '#2a2f3d', 0, 0.04, 0, { metalness: 0.8 }); cyl(lampG, 0.05, 0.05, 1.2, '#2a2f3d', 0, 0.7, 0); const ar = cyl(lampG, 0.04, 0.04, 1.0, '#2a2f3d', -0.4, 1.3, 0); ar.rotation.z = 0.9; cyl(lampG, 0.28, 0.12, 0.34, std('#ffb703', { roughness: 0.4 }), -0.8, 1.55, 0).rotation.z = 0.5;
      PR.chair(O, chairX, -0.3, Math.PI - 0.55);
      devScreens.push(a, b);
      return { a, b };
    };
    dev.a = devBlock(L.deskX, L.deskChairX, ['cs', 'ts']); dev.b = devBlock(L.archDeskX, L.archChairX, ['ts', 'cs']);
    // meeting room
    box(O, 12.8, 6.7, 0.3, std('#0f1220', { roughness: 0.3, metalness: 0.4 }), L.meetX, 6.55, -4.0);
    screen(O, 12.2, 6.1, wall, L.meetX, 6.55, -3.82);
    slab(O, 11, 0.26, 3.4, M.deskWood('#f0e4d0'), L.meetX, 1.75, -0.4, 4); for (const dx of [-4.5, 4.5]) box(O, 0.3, 1.65, 3, std('#3b3f4d', { metalness: 0.6, roughness: 0.35 }), L.meetX + dx, 0.85, -0.4);
    for (const dx of [-2.4, 0.8, 4]) PR.chair(O, L.meetX + dx, 2.55, Math.PI, '#4a5a8a');
    for (const dx of [-2.6, 3.8]) { box(O, 1.6, 0.06, 1.1, std('#c4cad4', { metalness: 1, roughness: 0.3 }), L.meetX + dx, 1.93, 0.0); box(O, 1.6, 0.8, 0.05, std('#b8bec9', { metalness: 1, roughness: 0.3 }), L.meetX + dx, 2.4, -0.5).rotation.x = -0.25; }
    PR.mug(O, L.meetX - 0.5, 1.88, -0.4, '#ffb703');
    // lunch
    cyl(U, 3.5, 3.5, 0.24, M.deskWood('#f0e4d0'), L.lunchX, 1.75, 0.3, undefined, 48); cyl(U, 0.35, 0.6, 1.65, std('#3b3f4d', { metalness: 0.7, roughness: 0.35 }), L.lunchX, 0.85, 0.3); cyl(U, 1.4, 1.4, 0.06, std('#3b3f4d', { metalness: 0.7 }), L.lunchX, 0.03, 0.3);
    PR.chair(U, L.lunchX - 3.8, 0.5, Math.PI / 2, '#4a5a8a'); PR.chair(U, L.lunchX + 3.8, 0.5, -Math.PI / 2, '#4a5a8a');
    for (const dx of [-1.9, 1.9]) {
      cyl(U, 0.9, 0.7, 0.1, std('#ffffff', { roughness: 0.15, clearcoat: 1 }), L.lunchX + dx, 1.92, 0.3);
      mesh(new THREE.SphereGeometry(0.56, 28, 14, 0, 7, 0, Math.PI / 2), std('#f6ecc2', { roughness: 0.9 }), U, L.lunchX + dx - 0.2, 1.97, 0.25);
      for (let k = 0; k < 4; k++) sph(U, 0.17, '#c4741f', L.lunchX + dx + 0.28 + (k % 2) * 0.12, 2.02 + (k > 1 ? 0.1 : 0), 0.4 + (k % 2) * 0.1, undefined, 12);
      box(U, 0.4, 0.04, 0.4, std('#3a7a4a'), L.lunchX + dx + 0.3, 1.93, -0.3);
    }
    for (const [dx, dz] of [[0, -0.5], [0.7, 1.1]]) cyl(U, 0.28, 0.24, 0.55, std('#9ccdf5', { transparent: true, opacity: 0.55, roughness: 0.03, clearcoat: 1 }), L.lunchX + dx, 2.15, dz);
    const clockG = new THREE.Group(); U.add(clockG);
    cyl(U, 1.35, 1.35, 0.16, std('#ffffff', { roughness: 0.3 }), L.lunchX, 7.4, -4.0).rotation.x = Math.PI / 2;
    cyl(U, 1.45, 1.45, 0.1, std('#2a2f3d', { metalness: 0.8, roughness: 0.3 }), L.lunchX, 7.4, -4.02).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(U, 0.06, i % 3 ? 0.14 : 0.26, 0.04, '#14182a', L.lunchX + Math.sin(a) * 1.1, 7.4 + Math.cos(a) * 1.1, -3.9).rotation.z = -a; }
    const hdG = dyn(U), hHand = box(hdG, 0.1, 0.7, 0.05, '#14182a', L.lunchX, 7.4, -3.88), mHand = box(hdG, 0.07, 1.05, 0.05, '#14182a', L.lunchX, 7.4, -3.86);
    hHand.userData.dyn = mHand.userData.dyn = true; hHand.geometry.translate(0, 0.35, 0); mHand.geometry.translate(0, 0.52, 0);
    const steam = [0, 1].map((k) => { const g = dyn(U); g.position.set(L.lunchX + (k ? 1.9 : -1.9), 2.1, 0.3); return wisps(g, 5, '#ffffff', 0.2, 2.0); });
    // architecture diagram
    const dia = dyn(root); dia.position.set(L.archDeskX + 7.4, 6.5, -0.6); dia.scale.setScalar(0.62); dia.visible = false;
    const nodeDefs = [['Angular', -5.5, 1.9, '#d4476b'], ['.NET API', -1.6, 0.2, '#6c5ce7'], ['Service Bus', 2.3, 2.1, '#e0a43a'], ['AKS', 5.2, -0.2, '#1fa5a0'], ['SQL', -1.8, -2.3, '#2f9e5f'], ['Pipeline', 2.6, -2.5, '#5b7fd1']];
    const edges = [[0, 1], [1, 2], [2, 3], [1, 4], [5, 3]];
    const nodes = nodeDefs.map(([name, x, y, col]) => {
      const n = new THREE.Group(); n.position.set(x, y, 0); n.userData.dyn = true; dia.add(n);
      const b = box(n, 3.0, 1.2, 0.6, new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 0.8 }), 0, 0, 0); b.userData.dyn = true;
      const { tex, aspect } = labelTexture(name, { fg: '#fff', font: '700 60px "Bricolage Grotesque", system-ui, sans-serif', pad: 10 });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * aspect, 0.62), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })); p.position.z = 0.32; n.add(p);
      return n;
    });
    const edgeLines = edges.map(() => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffffff' })); dia.add(l); return l; });
    const packets = edges.map(() => { const s = sph(dia, 0.14, PR.emissiveMat('#7ff', 2.5), 0, 0, 0.2, undefined, 12); s.userData.dyn = true; return s; });
    const users = labelSprite('1.3M+ users served', { fg: '#0b1020', bg: '#ffb703', font: '700 56px "Bricolage Grotesque", system-ui, sans-serif' }, 1.0);
    users.position.set(0.4, 4.2, 0.4); dia.add(users);
    batch(O);
    Object.assign(diaPack, { dia, nodes, nodeDefs, edges, edgeLines, packets, users, hHand, mHand, steam });
  }
  /* ===== 2b. 1st-floor cafeteria + glass lift (office floors) ===== */
  const liftA = {};
  {
    const Oc = zone(); Oc.position.y = UP2;
    const dressB = (g, w) => PR.blinds(g, w.x, w.y, w.w, w.h, { color: '#f1e6d2', drop: 0.55 });
    PR.room(Oc, 62, 136, { wall: '#f1e1cd', floor: 'wood', floorColor: '#e0cfae', h: 10.5, trim: '#fff7ec', left: false, gap: [LIFT_X - 1.9, LIFT_X + 1.9], windows: [70, 92, 128].map((x) => ({ x, y: 6.4, w: 5, h: 5 })), dress: dressB });
    const steel = std('#c9ced8', { metalness: 0.9, roughness: 0.25 }), dark = std('#2a2f3d', { metalness: 0.7, roughness: 0.4 });
    // serving counter, coffee machine, vending machine, menu board, pendant lamps
    box(Oc, 9, 2.6, 1.6, M.deskWood('#6b4a32'), 126, 1.3, -3.2); box(Oc, 9.2, 0.15, 1.8, std('#e9e4da', { roughness: 0.3 }), 126, 2.65, -3.2);
    box(Oc, 1.5, 1.5, 1.1, dark, 123.4, 3.5, -3.2); box(Oc, 0.5, 0.2, 0.4, std('#e8362b'), 123.4, 3.9, -2.6); cyl(Oc, 0.18, 0.15, 0.45, '#f3f1ea', 123.4, 2.95, -2.6);
    for (let i = 0; i < 4; i++) { box(Oc, 1.5, 0.08, 1.0, std('#d9dde6', { metalness: 0.6, roughness: 0.3 }), 127 + i * 1.6, 2.78, -3.0); cyl(Oc, 0.5, 0.45, 0.14, i % 2 ? '#e06a4a' : '#f6ecc2', 127 + i * 1.6, 2.88, -3.0); }
    box(Oc, 3.0, 7.0, 2.0, std('#1c2a4a', { metalness: 0.3, roughness: 0.35 }), 133.2, 3.5, -3.1);
    box(Oc, 2.5, 4.8, 0.1, std('#8fd1ff', { emissive: '#4aa8ff', emissiveIntensity: 0.8 }), 133.2, 4.2, -2.05);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(Oc, 0.5, 0.7, 0.2, std(['#e8362b', '#ffb703', '#2e86de', '#27ae60'][(r + c) % 4]), 132.4 + c * 0.8, 5.4 - r * 1.0, -2.0);
    const menu = labelSprite("Today: biryani / karahi / salad", { fg: '#fff', bg: '#2a2f3d', font: '700 52px "Bricolage Grotesque", system-ui, sans-serif' }, 0.7); menu.position.set(111, 8.6, -3.9); Oc.add(menu);
    for (const x of [L.lunchX, L.lunchX - 12, L.lunchX + 12]) { cyl(Oc, 0.03, 0.03, 3, '#2a2f3d', x, 9.0, 0.3); const lm = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffd08a', emissiveIntensity: 1.6 }); cyl(Oc, 0.2, 0.9, 0.6, lm, x, 7.3, 0.3).castShadow = false; ctx.glows.push({ m: lm, base: 2.2, min: 0.8 }); }
    for (const x of [74, 86, 98]) { box(Oc, 2.4, 0.2, 1.4, M.deskWood('#d3b58a'), x - 6 + 6, 1.6, 1.6 + 0 * x); for (const dx of [-1, 1]) box(Oc, 0.14, 1.5, 1.2, dark, x + dx - 0, 0.75, 1.6); }
    batch(Oc);
    // glass lift: shaft frame (static) + cabin (animated)
    const Lf = zone();
    for (const dx of [-1.95, 1.95]) { box(Lf, 0.14, 22, 0.14, steel, LIFT_X + dx, 11, -0.9); box(Lf, 0.14, 22, 0.14, steel, LIFT_X + dx, 11, -3.7); }
    box(Lf, 4.0, 0.3, 3.0, dark, LIFT_X, 22.2, -2.3);
    for (const y of [0, UP2]) { box(Lf, 3.9, 0.3, 0.2, dark, LIFT_X, y + 6.9, -0.9); const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ color: '#7ff', toneMapped: false })); disp.position.set(LIFT_X + 2.4, y + 4.5, -0.85); Lf.add(disp); }
    batch(Lf);
    const cab = new THREE.Group(); cab.userData.dyn = true; root.add(cab);
    box(cab, 3.6, 0.3, 2.6, dark, LIFT_X, 0, -2.3).userData.dyn = true; box(cab, 3.6, 0.2, 2.6, dark, LIFT_X, 7.0, -2.3).userData.dyn = true;
    const cg = new THREE.MeshPhysicalMaterial({ color: '#cfe9ff', transparent: true, opacity: 0.2, roughness: 0.03, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
    for (const [w, h, x, z, ry] of [[2.6, 6.8, -1.78, -2.3, Math.PI / 2], [2.6, 6.8, 1.78, -2.3, Math.PI / 2], [3.6, 6.8, 0, -3.58, 0]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cg); g.rotation.y = ry; g.position.set(LIFT_X + x, 3.5, z); cab.add(g); }
    const lamp = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#e8f4ff', emissiveIntensity: 2 }); box(cab, 2.6, 0.06, 1.8, lamp, LIFT_X, 6.9, -2.3).userData.dyn = true;
    const doors = [-1, 1].map((k) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 6.6), cg); d.position.set(LIFT_X + k * 0.9, 3.4, -0.98); cab.add(d); box(cab, 0.08, 6.6, 0.08, steel, LIFT_X + k * 1.8, 3.4, -0.98).userData.dyn = true; return d; });
    Object.assign(liftA, { cab, doors });
  }
  ups.push((P) => {
    const lunchP = lpOf(P, 'lunch'), buildP = lpOf(P, 'build');
    const ride = P < CH.lunch.start ? 0 : P < CH.lunch.end ? smooth(seg(lunchP, 0.36, 0.5)) : P < CH.build.end ? 1 - smooth(seg(buildP, 0.2, 0.34)) : 0;
    liftA.cab.position.y = UP2 * ride;
    const moving = ride > 0.01 && ride < 0.99, open = moving ? 0 : 1;
    liftA.doors.forEach((d, i) => { d.position.x += ((LIFT_X + (i ? 1 : -1) * (0.9 + open * 1.5)) - d.position.x) * 0.2; });
  });

  ups.push((P, t, dt, c, S) => {
    if (!c.near(CH.code.start - 3, CH.build.end + 3)) { colA.group.visible = colB.group.visible = colC.group.visible = false; return; }
    const f = Math.floor(t * 8);
    if (f !== ups._f) { ups._f = f; devScreens.forEach((s, i) => s.redraw(t * (0.8 + i * 0.1) + i * 3)); }
    if (c.near(CH.meet.start - 2, CH.meet.end + 2) && ups._m !== f) { ups._m = f; wall.redraw(t); }
    const meetOn = inChap(P, 'meet', 1.5);
    colA.group.visible = colB.group.visible = meetOn;
    const seat = (fig, x, z, ry, arm, yo = 0) => { fig.group.position.set(x, SEAT_Y + yo, z); fig.group.rotation.y = ry; applyPose(fig, { sit: 1, t, arm }); };
    seat(colA, L.meetX + 0.8, 1.9, Math.PI, Math.floor(t * 0.35) % 6 === 1 ? 'talk' : 'rest');
    seat(colB, L.meetX + 4, 1.9, Math.PI, Math.floor(t * 0.35) % 6 === 3 ? 'talk' : 'rest');
    colC.group.visible = inChap(P, 'lunch', 0.3); seat(colC, L.lunchX + 3.3, 0.5, -Math.PI / 2, 'eat', UP2);
    diaPack.steam.forEach((s, i) => s.update(t + i * 0.5, P >= CH.lunch.start ? 1 : 0));
    const h = c.hour; diaPack.hHand.rotation.z = -(h % 12) / 12 * Math.PI * 2; diaPack.mHand.rotation.z = -(h % 1) * Math.PI * 2;
    const bp = lpOf(P, 'build'), { dia, nodes, nodeDefs, edges, edgeLines, packets, users } = diaPack;
    dia.visible = P > CH.build.start - 3 && P < CH.home.start + 1;
    nodes.forEach((n, i) => { const k = clamp((bp - 0.6 - i * 0.045) / 0.1); n.scale.setScalar(Math.max(0.001, k > 0 ? easeOutBack(k) : 0)); n.position.y = nodeDefs[i][2] + Math.sin(t * 1.2 + i) * 0.12; });
    edges.forEach(([a, b], i) => {
      const k = clamp((bp - 0.78 - i * 0.025) / 0.12), A = nodes[a].position, B = nodes[b].position, pos = edgeLines[i].geometry.attributes.position;
      pos.setXYZ(0, A.x, A.y, 0); pos.setXYZ(1, lerp(A.x, B.x, k), lerp(A.y, B.y, k), 0); pos.needsUpdate = true;
      packets[i].visible = k >= 1; const fk = (t * 0.5 + i * 0.23) % 1; packets[i].position.set(lerp(A.x, B.x, fk), lerp(A.y, B.y, fk), 0.2);
    });
    users.visible = bp > 0.9; users.material.opacity = smooth(seg(bp, 0.9, 0.98));
  });

  /* ===== 3. living room (x 157 .. 189) ===== */
  const kidA = makeFigure({ shirt: '#ffb703', skin: '#d6a07a', hair: '#15151b', scale: 0.56, headScale: 1.25 });
  const kidB = makeFigure({ shirt: '#ff7aa8', skin: '#d6a07a', hair: '#15151b', scale: 0.5, longHair: true, headScale: 1.25 });
  const partner = makeFigure({ shirt: '#2a9d8f', skin: '#c9906a', hair: '#1a1210', longHair: true });
  const LRG = new THREE.Group(); LRG.position.x = -165; root.add(LRG);
  LRG.add(kidA.group, kidB.group, partner.group); kidA.group.visible = kidB.group.visible = partner.group.visible = false;
  const shelfDoor = dyn(LRG), bookRed = { m: null };
  {
    const Lr = new THREE.Group(); LRG.add(Lr);
    PR.room(Lr, 157, 189, { wall: '#efd8c0', floor: 'wood', left: false, trim: '#fff7ec', windows: [{ x: 168, y: 5.4, w: 6, h: 4.8 }], doors: [{ x: 185.4, w: 4.4, h: 6.6 }] });
    PR.curtains(Lr, 168, 5.2, 6, 6.2, '#c8574a', 1.7);
    buildSmartHome(Lr, ctx, ups, { CH, lpOf, pickables });
    PR.sofa(Lr, L.sofaX, -2.0);
    cyl(Lr, 5.4, 5.4, 0.12, M.fabric('#2a8f86', 4, { roughness: 1 }), L.rugX + 1, 0.06, 1.6, undefined, 64);
    box(Lr, 3.2, 0.16, 1.8, M.deskWood('#a07a55'), L.sofaX, 1.3, 1.0); for (const dx of [-1.3, 1.3]) box(Lr, 0.2, 1.2, 1.5, std('#3a3f4d', { metalness: 0.7, roughness: 0.4 }), L.sofaX + dx, 0.6, 1.0);
    PR.mug(Lr, L.sofaX - 0.8, 1.38, 1.0, '#e9e3d5'); box(Lr, 1.0, 0.1, 0.7, std('#d4476b'), L.sofaX + 0.5, 1.4, 1.0); box(Lr, 0.9, 0.08, 0.6, std('#2f6fb5'), L.sofaX + 0.5, 1.5, 1.0);
    PR.lampFloor(Lr, ctx, 173.4, -3.4, 5.4); PR.plant(Lr, 158.8, -3, 1.5); PR.plant(Lr, 177.5, -3.3, 1.2, '#4a5a8a');
    for (let i = 0; i < 3; i++) PR.frame(Lr, 161.5 + i * 2.4, 6.6 + (i % 2) * 0.5, 1.5, 1.8, ['#ffb703', '#d4476b', '#2f6fb5'][i]);
    // hidden passage behind the sliding shelf
    const pw = std('#101522', { roughness: 0.8 });
    slab(Lr, 4.4, 0.4, 5, std('#1a1f30', { roughness: 0.6 }), 185.4, -0.2, -7.1, 4); box(Lr, 0.3, 7, 5, pw, 183.1, 3.5, -7.1); box(Lr, 0.3, 7, 5, pw, 187.7, 3.5, -7.1); box(Lr, 4.4, 7, 0.3, pw, 185.4, 3.5, -9.6); box(Lr, 4.4, 0.3, 5, pw, 185.4, 7, -7.1);
    for (let i = 0; i < 6; i++) box(Lr, 4.0, 0.3, 0.8, std('#2b3350', { metalness: 0.4, roughness: 0.4 }), 185.4, -0.1 - i * 0.28, -5 - i * 0.8);
    const passM = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#6fd6ff', emissiveIntensity: 2.2 }); box(Lr, 3.6, 0.1, 0.22, passM, 185.4, 6.4, -6.0); box(Lr, 3.6, 0.1, 0.22, passM, 185.4, 6.4, -8.4);
    box(Lr, 0.1, 5.8, 0.2, passM, 183.4, 3.3, -5.1); box(Lr, 0.1, 5.8, 0.2, passM, 187.4, 3.3, -5.1);
    const glowEnd = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffb347', emissiveIntensity: 2.0 }); box(Lr, 3.2, 3, 0.1, glowEnd, 185.4, 3.2, -9.4);
    ctx.glows.push({ m: passM, base: 3, min: 1.2 });
    batch(Lr);
    // sliding bookshelf door (dynamic)
    shelfDoor.position.set(185.4, 0, 0);
    const wood = M.deskWood('#8a6a52');
    const sh = new THREE.Group(); sh.userData.dyn = true; shelfDoor.add(sh);
    box(sh, 4.4, 7, 1.3, wood, 0, 3.5, -3.5).userData.dyn = true; box(sh, 4.1, 6.7, 0.1, std('#3a2c22'), 0, 3.5, -4.0).userData.dyn = true;
    const cols = ['#d4476b', '#2f6fb5', '#ffb703', '#2f9e5f', '#6c5ce7', '#e9e3d5', '#c9506b', '#1fa5a0'];
    for (let r = 0; r < 4; r++) {
      const sy = 0.5 + r * 1.65; box(sh, 4.3, 0.12, 1.2, wood, 0, sy, -3.5).userData.dyn = true;
      let px = -2.0; for (let i = 0; px < 1.7; i++) { const bw = 0.22 + ((i * 7 + r * 3) % 5) * 0.06, bh = 1.0 + ((i * 3 + r) % 4) * 0.22; const isRed = r === 2 && i === 4; const b = box(sh, bw, bh, 0.8, std(isRed ? '#e8362b' : cols[(i + r * 2) % cols.length], { roughness: 0.6 }), px + bw / 2, sy + 0.06 + bh / 2, -3.45); b.userData.dyn = true; if (isRed) { bookRed.m = b; bookRed.base = b.position.z; } px += bw + 0.02; }
    }
  }
  ups.push((P, t, dt, c, S) => {
    const on = P > CH.home.start + 3 && P < CH.hobby.start + 3;
    kidA.group.visible = kidB.group.visible = partner.group.visible = P > CH.home.start + 3 && P < CH.hobby.start + 1;
    const hl = lpOf(P, 'hobby');
    // sliding bookshelf door + red book
    const open = smooth(seg(hl, 0.1, 0.2)), pull = smooth(seg(hl, 0.06, 0.1)) * (1 - smooth(seg(hl, 0.1, 0.12)));
    shelfDoor.position.x = 185.4 - open * 0 - 0; shelfDoor.children[0].position.x = -open * 4.8;
    if (bookRed.m) bookRed.m.position.z = bookRed.base + pull * 0.45;
    shelfDoor.visible = P > CH.family.start - 5;
    if (!on) return;
    const fp = lpOf(P, 'family'), enter = smooth(seg(fp, 0, 0.2));
    partner.group.position.set(L.sofaX - 1.6, SEAT_Y, -1.7); partner.group.rotation.y = 0.15;
    applyPose(partner, { sit: 1, t, arm: Math.floor(t * 0.4) % 3 ? 'talk' : 'wave' });
    const hop = (ph) => Math.abs(Math.sin(t * 5 + ph)) * 0.55 * enter;
    kidA.group.position.set(L.rugX + 0.5, 0.12 + hop(0), 0.4); kidA.group.rotation.y = -0.2; applyPose(kidA, { arm: 'wave', t });
    kidB.group.position.set(L.rugX + 5.2, 0.12 + hop(1.7), 0.8); kidB.group.rotation.y = 0.35; applyPose(kidB, { arm: 'up', t: t * 0.7 });
  });

  createPhysics(root, ups, ctx, [
    { x0: 2, x1: 17, kinds: ['ball', 'block', 'block', 'ball', 'block', 'block', 'ball', 'block', 'block', 'ball', 'block', 'ball', 'block', 'block', 'ball', 'block'], when: (P) => P > CH.family.start + 1 && P < CH.hobby.start + 3 },
    { x0: 72, x1: 134, kinds: ['mug', 'book', 'paper', 'paper', 'book', 'paper', 'mug', 'book', 'paper', 'paper', 'book', 'mug'], when: (P) => P > CH.code.start && P < CH.home.start },
    { dy: -13, x0: 27, x1: 93, kinds: ['resistor', 'led', 'board', 'capacitor', 'chip', 'resistor', 'led', 'resistor', 'capacitor', 'board', 'led', 'chip', 'resistor', 'led', 'capacitor', 'resistor', 'led', 'chip'] },
  ]);

  /* ===== 4. the lab ===== */
  const LABG = new THREE.Group(); LABG.position.set(-165, -13, 0); root.add(LABG);
  const lab = buildLab(LABG, ctx, { me, ups });

  /* ===== 5. bedroom at night (x 262 .. 290) ===== */
  const zzz = [];
  {
    const B = zone();
    PR.room(B, 262, 290, { wall: '#2b3160', floor: 'wood', floorColor: '#9a8aa8', trim: '#3a4180', windows: [{ x: 285, y: 5.4, w: 4.2, h: 4.6 }] });
    PR.curtains(B, 285, 5.2, 4.2, 5.8, '#3b4380', 1.5);
    PR.bed(B, L.bed2X);
    slab(B, 8.5, 0.07, 6, M.fabric('#5a4a7a', 4, { roughness: 1 }), L.bed2X, 0.035, 1.0, 3);
    box(B, 1.9, 1.7, 1.9, M.deskWood('#6a5a6b'), L.bed2X + 4.7, 0.85, -2.7);
    const lm = new THREE.MeshStandardMaterial({ color: '#f7e7c4', emissive: '#ffcf8a', emissiveIntensity: 1.2, roughness: 0.9, side: THREE.DoubleSide });
    cyl(B, 0.07, 0.07, 1.0, '#2a2f3d', L.bed2X + 4.7, 2.2, -2.9, { metalness: 0.8 }); cyl(B, 0.4, 0.62, 0.62, lm, L.bed2X + 4.7, 3.0, -2.9).castShadow = false;
    ctx.glows.push({ m: lm, base: 1.8, min: 1.5 });
    PR.plant(B, 265, -3, 1.3, '#4a5a8a');
    box(B, 6.4, 0.18, 1.3, M.deskWood('#5a5a74'), 270.5, 5.6, -3.6);
    PR.frame(B, 274, 7.0, 2.2, 1.6, '#3b82f6'); PR.frame(B, 277.4, 7.2, 1.4, 1.8, '#c084fc');
    const sleepLeds = [];
    for (let i = 0; i < 4; i++) { const e = PR.esp32(B, 267.6 + i * 1.7, 5.75, -3.6, 0.5); sleepLeds.push(e.leds[1]); }
    for (let i = 0; i < 3; i++) { const s = labelSprite('Z', { fg: '#cfd8ff', font: '800 90px "Bricolage Grotesque", system-ui, sans-serif', pad: 10 }, 0.9); root.add(s); zzz.push(s); }
    batch(B);
    ups.push((P, t, dt, c) => {
      if (!c.near(CH.sleep.start - 2, TOTAL + 5)) return;
      sleepLeds.forEach((m, i) => (m.emissiveIntensity = Math.sin(t * 2 + i * 1.7) > 0.5 ? 3 : 0.1));
      zzz.forEach((s, i) => { const k = (t * 0.28 + i / 3) % 1; s.position.set(L.bed2X - 2.9 + k * 1.8, 3.9 + k * 2.4, 0.8); s.material.opacity = Math.sin(k * Math.PI) * 0.9; s.scale.setScalar(0.7 + k * 0.7); s.visible = P > CH.sleep.start + 0.5; });
    });
  }

  /* ===== story-driven lights ===== */
  const mkPL = (col, dist = 55) => { const l = new THREE.PointLight(col, 0, dist, 2); root.add(l); return l; };
  const roomLight = mkPL('#ffd9a0', 60), lampLight = mkPL('#ffc27a', 30), screenGlow = mkPL('#7aa7ff', 36);

  let pushZ = 0;
  const poseMe = (S, t) => {
    const F = ctx.free;
    if (F) {   // player-controlled (FPS free roam)
      me.group.visible = true; me.group.position.set(F.x, F.y, F.z); me.group.rotation.set(0, F.ry, 0); me.group.scale.setScalar(1);
      me.mShirt.color.lerpColors(PJ, WORK, S.shirt); bagOnBack.visible = false;
      applyPose(me, { walk: F.walk, ph: F.ph, arm: 'idle', sit: 0, floor: 0, rz: 0, solder: 0, t, shirt: S.shirt, vis: true });
      return;
    }
    me.group.visible = S.vis;
    // story coordinates -> world: home/living/lab live under the bedroom, the lab is in the basement
    const wx = S.x >= 138 ? S.x - 165 : S.x, wy = S.y + (S.x >= 189 ? -13 : 0);
    const ex = S.inCar || S.sit > 0.05 || S.floor > 0.05 || S.solder > 0.01 || S.arm === 'sleep' || !S.vis || Math.abs(S.rz) > 0.1 || (wx > 23 && wx < 39 && wy > -1) || (wx > 99 && wx < 106) || (S.x > 203 && S.x < 216);
    let need = 0;
    if (!ex) for (const b of SOLIDS) {
      if (wy + 6.5 > b.min.y + 0.2 && wy + 0.35 < b.max.y && wx > b.min.x - 0.5 && wx < b.max.x + 0.5 && S.z > b.min.z - 0.25 && S.z < b.max.z + 0.5) need = Math.max(need, b.max.z + 0.5 - S.z);
    }
    pushZ += (Math.min(need, 2.2) - pushZ) * (1 - Math.exp(-(ctx.dt || 0.016) * 10));
    me.group.position.set(wx, wy, S.z + pushZ); me.group.rotation.set(0, S.ry, S.rz);
    me.group.scale.setScalar(Math.max(0.001, S.scale));
    me.mShirt.color.lerpColors(PJ, WORK, S.shirt);
    bagOnBack.visible = S.bag;
    applyPose(me, { ...S, t });
  };
  lab.calibrate(poseMe);

  const api = {
    me, ctx, lab, pickables, LRG, CH, lpOf, get S() { return ctx.S; },
    update(P, t, dt, lookX, hour, lookY = 2) {
      const S = meState(P); ctx.S = S;
      ctx.hour = hour; ctx.lookX = lookX; ctx.lookY = lookY; ctx.dt = dt;
      poseMe(S, t);
      const c = ctx; c.dark = skyApi.dark; c.near = (a, b) => P >= a && P <= b;
      for (const g of ctx.glows) g.m.emissiveIntensity = lerp(g.min, g.base, c.dark);
      for (const m of cityMats) m.emissiveIntensity = c.dark * 1.7;
      for (const f of ups) f(P, t, dt, c, S);
      ctx.labK = skyApi.labK;
      lab.update(P, t, dt, c, S, lookY < -4 ? lookX + 165 : 0);
      const outdoors = (lookX > 28 && lookX < 62) || (lookX > -30 && lookX < -7), inLab = skyApi.labK > 0.5;
      roomLight.position.set(lookX, lookY + 6, 8);
      roomLight.intensity = outdoors ? 0 : c.dark * 520 * (1 - skyApi.labK);
      lampLight.position.set(lookX + 3, lookY + 2, -1); lampLight.intensity = outdoors ? 0 : (0.35 + c.dark) * 90 * (1 - skyApi.labK);
      const office = P > CH.code.start && P < CH.home.start;
      screenGlow.position.set(lookX, lookY + 2.5, 2); screenGlow.intensity = office ? 70 : 0;
    },
    setPointer(v) { ctx.pointer = v; },
  };
  return api;
}
