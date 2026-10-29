import { clamp, lerp, smooth, seg } from './util.js';
import { CHAPTERS, L } from './story.js';

export const SEAT_Y = -0.71;      // group y so hips rest on a 0.65 high seat
export const BED_SIT_Y = -0.52;
export const FLOOR_Y = -1.24;
export const UP1 = 9.6, UP2 = 11, LIFT_X = 102.5, STAIR_X0 = 25.5, STAIR_X1 = 33.5;
const C = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

/** walk along waypoints [t0,t1,x0,x1,(z0,z1)] and report x/z + walking factor */
function trav(lp, segs, zDefault = 1) {
  let s = segs[segs.length - 1];
  for (const q of segs) if (lp <= q[1]) { s = q; break; }
  const k = clamp((lp - s[0]) / (s[1] - s[0]));
  const moving = s[2] !== s[3];
  const f = moving ? smooth(Math.min(k, 1 - k) * 6) : 0;
  return { x: lerp(s[2], s[3], k), z: s[4] !== undefined ? lerp(s[4], s[5], k) : zDefault, f, dir: Math.sign(s[3] - s[2]) || 1 };
}

export function meState(P) {
  const S = { x: 0, y: 0, z: 1, ry: 0, rz: 0, walk: 0, sit: 0, floor: 0, arm: 'idle', vis: true, shirt: 0, bag: false, inCar: false, scale: 1, solder: 0, ph: 0 };
  const chap = (id) => { const c = C[id]; return { lp: (P - c.start) / c.dur, on: P >= c.start && P < c.end }; };
  const HALF = Math.PI / 2;

  let { lp, on } = chap('wake');
  if (P < C.wake.end) {
    lp = clamp(lp);
    const a = smooth(seg(lp, 0.24, 0.5)), b = smooth(seg(lp, 0.5, 0.64));
    S.x = lerp(lerp(L.bedX + 1.8, L.bedX, a), -2.4, b);
    S.y = lerp(lerp(1.3, BED_SIT_Y, a), 0, b);
    S.z = lerp(lerp(0.3, 0.9, a), 1.3, b);
    S.rz = HALF * (1 - a);
    S.sit = a * (1 - b);
    const w = smooth(seg(lp, 0.64, 0.72));
    S.x += seg(lp, 0.64, 1) * 7.4;
    S.ry = HALF * smooth(seg(lp, 0.58, 0.72));
    S.walk = w;
    S.arm = lp > 0.42 && lp < 0.56 ? 'up' : lp < 0.3 ? 'sleep' : 'idle';
    S.ph = S.x * 2.4; S.y += UP1;
    return S;
  }

  ({ lp, on } = chap('ready'));
  if (P < C.ready.end) {
    const t = trav(lp, [[0, 0.2, 5, 9.4], [0.2, 0.42, 9.4, 9.4], [0.42, 0.56, 9.4, 14], [0.56, 0.7, 14, 14], [0.7, 0.82, 14, 18.5], [0.82, 0.86, 18.5, 18.5], [0.86, 1, 18.5, 24]]);
    S.x = t.x; S.z = lerp(1.3, 1.6, lp); S.walk = t.f; S.ry = HALF * t.f; S.ph = S.x * 2.4;
    S.shirt = smooth(seg(lp, 0.28, 0.4));
    S.bag = lp > 0.84;
    S.arm = lp > 0.26 && lp < 0.42 ? 'up' : lp > 0.56 && lp < 0.7 ? 'talk' : 'idle'; S.y += UP1;
    return S;
  }
  S.shirt = 1;

  ({ lp, on } = chap('commute'));
  if (P < C.commute.end) {
    const cx = L.carX0 - 1.6, t = trav(lp, [[0, 0.22, 24, cx], [0.22, 1, cx, cx]]);
    S.x = t.x; S.z = 1.6; S.walk = t.f; S.ry = HALF * t.f; S.ph = S.x * 2.4; S.bag = true;
    S.y = UP1 * (1 - clamp(seg(S.x, STAIR_X0, STAIR_X1)));
    S.vis = lp < 0.22; S.inCar = lp >= 0.22;
    return S;
  }

  ({ lp, on } = chap('code'));
  if (P < C.code.end) {
    const t = trav(lp, [[0, 0.18, 63, 68.2], [0.18, 1, 68.2, 68.2]]);
    const s = smooth(seg(lp, 0.18, 0.32));
    S.x = lerp(t.x, L.deskChairX, s); S.z = lerp(0.2, -0.3, s);
    S.y = SEAT_Y * s; S.sit = s;
    S.ry = lerp(HALF * (t.f > 0 ? 1 : 1), Math.PI - 0.55, s);
    S.walk = t.f; S.ph = S.x * 2.4;
    S.arm = s > 0.95 ? 'type' : 'idle';
    return S;
  }

  ({ lp, on } = chap('meet'));
  if (P < C.meet.end) {
    const up = smooth(seg(lp, 0, 0.1));
    const t = trav(lp, [[0, 0.12, 69.2, 69.2], [0.12, 0.32, 69.2, 87.6, -0.3, 1.9], [0.32, 1, 87.6, 87.6, 1.9, 1.9]]);
    const sit = smooth(seg(lp, 0.34, 0.44));
    S.x = t.x; S.z = t.z;
    S.sit = (1 - up) + sit; S.sit = clamp(S.sit - (up > 0 ? 0 : 0));
    if (lp < 0.32) S.sit = 1 - up; else S.sit = sit;
    S.y = SEAT_Y * S.sit;
    const turn = smooth(seg(lp, 0.12, 0.2));
    S.ry = lp < 0.32 ? lerp(Math.PI - 0.55, HALF, turn) : lerp(HALF, Math.PI, sit);
    S.walk = t.f; S.ph = S.x * 2.4;
    S.arm = lp > 0.46 && lp < 0.9 ? 'talk' : S.sit > 0.9 ? 'rest' : 'idle';
    return S;
  }

  ({ lp, on } = chap('lunch'));
  if (P < C.lunch.end) {
    const up = smooth(seg(lp, 0, 0.08)), tableX = L.lunchX - 3.3;
    const t = trav(lp, [[0, 0.08, 87.6, 87.6, 1.9, 1.9], [0.08, 0.24, 87.6, LIFT_X, 1.9, 1.9], [0.24, 0.3, LIFT_X, LIFT_X, 1.9, -1.9], [0.3, 0.5, LIFT_X, LIFT_X, -1.9, -1.9], [0.5, 0.68, LIFT_X, tableX, -1.9, 0.5], [0.68, 1, tableX, tableX, 0.5, 0.5]]);
    const sit = smooth(seg(lp, 0.7, 0.78)), ride = smooth(seg(lp, 0.36, 0.5));
    S.x = t.x; S.z = t.z; S.y = UP2 * ride;
    S.sit = lp < 0.5 ? 1 - up : sit; S.y += SEAT_Y * S.sit;
    const turn = smooth(seg(lp, 0.3, 0.36));
    S.ry = lp < 0.08 ? lerp(Math.PI, HALF, smooth(seg(lp, 0.03, 0.08))) : lp < 0.24 ? HALF : lp < 0.3 ? Math.PI : lp < 0.5 ? lerp(Math.PI, 0, turn) : lerp(0, HALF, smooth(seg(lp, 0.5, 0.56)));
    S.walk = t.f; S.ph = S.x * 2.4 + S.z * 2;
    S.arm = S.sit > 0.9 ? (Math.floor(lp * 12) % 3 === 2 ? 'talk' : 'eat') : 'idle';
    return S;
  }

  ({ lp, on } = chap('build'));
  if (P < C.build.end) {
    const up = smooth(seg(lp, 0, 0.08)), tableX = L.lunchX - 3.3;
    const t = trav(lp, [[0, 0.08, tableX, tableX, 0.5, 0.5], [0.08, 0.2, tableX, LIFT_X, 0.5, -1.9], [0.2, 0.36, LIFT_X, LIFT_X, -1.9, -1.9], [0.36, 0.56, LIFT_X, L.archChairX, -1.9, 0.4], [0.56, 1, L.archChairX, L.archChairX, 0.4, 0.4]]);
    const sit = smooth(seg(lp, 0.58, 0.68)), ride = 1 - smooth(seg(lp, 0.2, 0.34));
    S.x = lerp(t.x, L.archChairX, sit); S.z = lerp(t.z, -0.3, sit);
    S.y = UP2 * ride; S.sit = lp < 0.58 ? 1 - up : sit; S.y += SEAT_Y * S.sit;
    S.ry = lp < 0.08 ? HALF : lp < 0.2 ? Math.PI * 0.5 : lp < 0.36 ? lerp(Math.PI * 0.5, 0, smooth(seg(lp, 0.2, 0.26))) : lerp(0, HALF, smooth(seg(lp, 0.34, 0.4)));
    S.ry = lp < 0.58 ? S.ry : lerp(HALF, Math.PI - 0.55, sit);
    S.walk = t.f; S.ph = S.x * 2.4 + S.z * 2;
    S.arm = S.sit > 0.95 ? 'type' : 'idle';
    return S;
  }

  ({ lp, on } = chap('home'));
  if (P < C.home.end) {
    const t = trav(lp, [[0, 0.55, 150.8, 150.8], [0.55, 1, 150.8, 158.6]]);
    S.x = t.x; S.z = 1.7; S.walk = t.f; S.ry = HALF * t.f; S.ph = S.x * 2.4; S.bag = true;
    S.vis = lp >= 0.55; S.inCar = lp < 0.55;
    return S;
  }

  ({ lp, on } = chap('family'));
  if (P < C.family.end) {
    const t = trav(lp, [[0, 0.32, 158.6, 169.5, 1.7, 2.3], [0.32, 0.78, 169.5, 169.5, 2.3, 2.3], [0.78, 1, 169.5, 182.8, 2.3, -1.6]]);
    const fl = smooth(seg(lp, 0.34, 0.46)) * (1 - smooth(seg(lp, 0.72, 0.8)));
    S.x = t.x; S.z = t.z; S.walk = t.f * (1 - fl); S.ph = S.x * 2.4;
    S.floor = fl; S.y = FLOOR_Y * fl; S.bag = lp < 0.3;
    S.ry = lerp(HALF * t.f, 0.4, fl);
    S.arm = fl > 0.9 ? 'play' : 'idle';
    return S;
  }

  ({ lp, on } = chap('hobby'));
  if (P < C.hobby.end) {
    S.scale = 1;
    if (lp < 0.34) {
      // living room: pull the book, walk into the passage
      const w = smooth(seg(lp, 0.2, 0.3)), k = seg(lp, 0.2, 0.32);
      S.x = lerp(182.8, 185.4, k); S.z = lerp(-1.6, -7.5, k); S.ry = lerp(Math.PI, 2.63, smooth(seg(lp, 0.19, 0.24)));
      S.walk = lp > 0.2 ? 1 : 0; S.ph = k * 40; S.arm = lp > 0.05 && lp < 0.13 ? 'reach' : 'idle';
      S.vis = lp < 0.315;
      return S;
    }
    const t = trav(lp, [[0.34, 0.44, 192, 209.5, 1.6, 0.2], [0.44, 0.64, 209.5, 209.5, 0.2, 0.2], [0.64, 0.72, 209.5, 232.5, 0.2, 1.6], [0.72, 0.8, 232.5, 232.5, 1.6, 1.6], [0.8, 0.88, 232.5, 247.5, 1.6, 1.8], [0.88, 0.92, 247.5, 247.5, 1.8, 1.8], [0.92, 0.98, 247.5, 259.0, 1.8, 1.4], [0.98, 1.01, 259.0, 259.0, 1.4, 1.4]]);
    const sit = smooth(seg(lp, 0.44, 0.5)) * (1 - smooth(seg(lp, 0.6, 0.64)));
    S.x = t.x; S.z = t.z; S.walk = t.f; S.ph = S.x * 2.4;
    S.sit = sit; S.y = SEAT_Y * sit;
    S.ry = t.f > 0 || sit > 0 ? HALF : 0.45;
    S.solder = smooth(seg(lp, 0.5, 0.53)) * (1 - smooth(seg(lp, 0.58, 0.61)));
    S.arm = lp > 0.5 && lp < 0.6 ? 'solder' : lp > 0.72 && lp < 0.8 ? 'talk' : lp > 0.88 && lp < 0.92 ? 'talk' : lp > 0.98 ? 'reach' : 'idle';
    S.vis = lp >= 0.335;
    return S;
  }

  ({ lp, on } = chap('sleep'));
  S.x = L.bedX + 1.8; S.y = 1.3 + UP1; S.z = 0.3; S.rz = HALF; S.arm = 'sleep';
  S.scale = smooth(seg(lp, 0, 0.1));
  return S;
}
