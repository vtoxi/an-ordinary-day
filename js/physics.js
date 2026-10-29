import * as THREE from 'three';
import { mesh } from './util.js';
import { std } from './materials.js';

/* Real-world-ish rigid-body layer (Matter.js, side view, extruded in z).
   1 world unit ~ 0.28 m, so g = 9.8 m/s^2 ~ 35 units/s^2. Fixed 120 Hz sub-steps,
   per-material restitution / friction / density, sleeping bodies, cursor shoves. */
const S = 40, G = 35;
const rnd = (a, b) => a + Math.random() * (b - a);

export function createPhysics(root, ups, ctx, zones) {
  const Mt = window.Matter;
  const eng = Mt.Engine.create({ enableSleeping: true });
  eng.gravity.x = 0; eng.gravity.y = 1;
  eng.gravity.scale = (G * S) / 1e6;            // px/ms^2 -> world u/s^2 = 35
  eng.positionIterations = 8; eng.velocityIterations = 6;
  const group = new THREE.Group(); group.userData.dyn = true; root.add(group);
  const FLOOR = 0.25, Z = 3.0;

  const PART = {
    resistor: () => { const g = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 16); g.rotateZ(Math.PI / 2); return { geo: g, mat: std('#d8b98c', { roughness: 0.6 }), w: 0.9, h: 0.27, rest: 0.12, fric: 0.5, dens: 0.0021, round: false }; },
    capacitor: () => ({ geo: new THREE.CylinderGeometry(0.17, 0.17, 0.7, 20), mat: std('#1d4fa8', { roughness: 0.4, metalness: 0.2 }), w: 0.34, h: 0.7, rest: 0.2, fric: 0.4, dens: 0.0016 }),
    led: () => ({ geo: new THREE.SphereGeometry(0.22, 20, 14), mat: std(['#ff3b3b', '#3bff7a', '#4aa8ff', '#ffd23b'][(Math.random() * 4) | 0], { roughness: 0.15, transparent: true, opacity: 0.9, emissiveIntensity: 0.4 }), r: 0.22, rest: 0.55, fric: 0.25, dens: 0.0012 }),
    board: () => ({ geo: new THREE.BoxGeometry(1.3, 0.12, 0.7), mat: std('#0e3a5a', { roughness: 0.5 }), w: 1.3, h: 0.14, rest: 0.08, fric: 0.6, dens: 0.0035 }),
    chip: () => ({ geo: new THREE.BoxGeometry(0.6, 0.12, 0.4), mat: std('#16181d', { roughness: 0.4 }), w: 0.6, h: 0.13, rest: 0.1, fric: 0.5, dens: 0.0028 }),
    mug: () => ({ geo: new THREE.CylinderGeometry(0.28, 0.24, 0.55, 24), mat: std('#f3f1ea', { roughness: 0.2 }), w: 0.56, h: 0.55, rest: 0.1, fric: 0.5, dens: 0.0022 }),
    book: () => { const c = ['#c0392b', '#2e86de', '#27ae60', '#8e44ad'][(Math.random() * 4) | 0]; return { geo: new THREE.BoxGeometry(1.0, 0.22, 0.75), mat: std(c, { roughness: 0.7 }), w: 1.0, h: 0.22, rest: 0.05, fric: 0.6, dens: 0.0012 }; },
    paper: () => ({ geo: new THREE.IcosahedronGeometry(0.34, 1), mat: std('#f7f7f2', { roughness: 0.95 }), r: 0.34, rest: 0.18, fric: 0.7, dens: 0.0004 }),
    ball: () => ({ geo: new THREE.SphereGeometry(0.5, 32, 22), mat: std(['#ffb703', '#ff6b6b', '#4ecdc4', '#5b8def'][(Math.random() * 4) | 0], { roughness: 0.3 }), r: 0.5, rest: 0.72, fric: 0.2, dens: 0.0006 }),
    block: () => { const s = rnd(0.8, 1.3); return { geo: new THREE.BoxGeometry(s, s * rnd(0.8, 1.3), 0.9), mat: std(['#9b6bff', '#7bd88f', '#ff6b6b', '#5b8def'][(Math.random() * 4) | 0], { roughness: 0.45 }), w: s, h: s, rest: 0.22, fric: 0.5, dens: 0.0009 }; },
  };

  const all = [];
  for (const z of zones) {
    z.items = []; z.live = false; z.dy = z.dy || 0;
    const cx = ((z.x0 + z.x1) / 2) * S, fy = -(FLOOR + z.dy) * S, wy = -(z.dy + 7.5) * S;
    z.statics = [
      Mt.Bodies.rectangle(cx, fy + 30, (z.x1 - z.x0) * S + 120, 60, { isStatic: true, friction: 0.8, restitution: 0.25 }),
      Mt.Bodies.rectangle(z.x0 * S - 25, wy, 50, 900, { isStatic: true }),
      Mt.Bodies.rectangle(z.x1 * S + 25, wy, 50, 900, { isStatic: true }),
    ];
    for (const sh of z.shelves || []) z.statics.push(Mt.Bodies.rectangle(sh.x * S, -sh.y * S, sh.w * S, 8, { isStatic: true, friction: 0.7, restitution: 0.1 }));
    all.push(z);
  }
  const spawn = (z) => {
    z.live = true;
    Mt.Composite.add(eng.world, z.statics);
    z.kinds.forEach((kind, i) => {
      const d = PART[kind](), x = rnd(z.x0 + 1.5, z.x1 - 1.5), y = z.dy + 7 + i * 0.55 + rnd(0, 1);
      const o = { isCircle: !!d.r, restitution: d.rest, friction: d.fric, frictionAir: 0.006, density: d.dens, sleepThreshold: 50, angle: rnd(-0.6, 0.6) };
      const b = d.r ? Mt.Bodies.circle(x * S, -y * S, d.r * S, o) : Mt.Bodies.rectangle(x * S, -y * S, d.w * S, d.h * S, o);
      Mt.Body.setAngularVelocity(b, rnd(-0.12, 0.12));
      Mt.Composite.add(eng.world, b);
      const m = mesh(d.geo, d.mat, group); m.castShadow = true;
      z.items.push({ b, m, z0: rnd(Z - 0.4, Z + 0.4) });
    });
  };
  const clear = (z) => {
    z.live = false;
    for (const it of z.items) { Mt.Composite.remove(eng.world, it.b); group.remove(it.m); it.m.geometry.dispose(); }
    z.items.length = 0; Mt.Composite.remove(eng.world, z.statics);
  };

  let acc = 0;
  ups.push((P, t, dt) => {
    const lx = ctx.lookX ?? 0, ly = ctx.lookY ?? 0;
    for (const z of all) {
      const onFloor = Math.abs(ly - (z.dy + 3)) < 9, near = onFloor && lx > z.x0 - 8 && lx < z.x1 + 8 && (!z.when || z.when(P)), far = !onFloor || lx < z.x0 - 20 || lx > z.x1 + 20 || (z.when && !z.when(P));
      if (near && !z.live) spawn(z); else if (far && z.live) clear(z);
    }
    if (!all.some((z) => z.live)) return;
    acc = Math.min(acc + dt, 0.05);
    const step = 1 / 120;
    const p = ctx.pointer;
    while (acc >= step) {
      acc -= step;
      if (p) for (const z of all) for (const it of z.items) {
        const b = it.b, dx = b.position.x / S - p.x, dy = -b.position.y / S - p.y, d = Math.hypot(dx, dy);
        if (d < 2.4) { Mt.Sleeping.set(b, false); Mt.Body.applyForce(b, b.position, { x: (dx / (d + 0.3)) * 0.0026 * b.mass, y: -(dy / (d + 0.3) + 0.5) * 0.0026 * b.mass }); }
      }
      Mt.Engine.update(eng, step * 1000);
    }
    for (const z of all) for (const it of z.items) {
      it.m.position.set(it.b.position.x / S, -it.b.position.y / S, it.z0);
      it.m.rotation.z = -it.b.angle;
    }
  });
  return { eng };
}
