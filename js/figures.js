import * as THREE from 'three';
import { lerp } from './util.js';
import { fabricSet } from './materials.js';

export const SOLDER = { sh: -1.2, el: -0.65, iron: 0.3 };

const cloth = (c, tight = 7, rep = 3) => {
  const set = fabricSet(tight);
  const map = set.map.clone(), nm = set.normalMap.clone();
  map.repeat.set(rep, rep); nm.repeat.set(rep, rep); map.needsUpdate = nm.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color: c, map, normalMap: nm, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.92 });
};
const skinMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.52, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffb59a'), clearcoat: 0.08, clearcoatRoughness: 0.5 });

/**
 * Stylised-realistic person, smooth shaded. Faces +z. Feet at y=0 standing.
 * hip joint y=1.54, shoulder y=2.75, head centre y=3.5 (rig dimensions are shared with the choreography).
 */
export function makeFigure({ skin = '#d6a07a', shirt = '#2f6fb5', pants = '#27304a', hair = '#16161c', shoe = '#14161f', scale = 1, longHair = false, headScale = 1, beard = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const mShirt = cloth(shirt), mPants = cloth(pants, 5, 4), mSkin = skinMat(skin);
  const mHair = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.55 });
  const mShoe = new THREE.MeshStandardMaterial({ color: shoe, roughness: 0.4 });
  const mSole = new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.7 });
  const add = (geo, m, p, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    o.castShadow = true; o.receiveShadow = true; o.userData.dyn = true; p.add(o); return o;
  };

  // torso + pelvis + neck
  add(new THREE.CapsuleGeometry(0.44, 0.7, 10, 32), mShirt, body, 0, 2.2, 0, 1.04, 1, 0.8);
  add(new THREE.SphereGeometry(0.5, 32, 20), mPants, body, 0, 1.55, 0, 1.0, 0.45, 0.78);
  add(new THREE.TorusGeometry(0.46, 0.03, 8, 40), new THREE.MeshStandardMaterial({ color: '#1a1a1f', roughness: 0.5 }), body, 0, 1.68, 0).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 20), mSkin, body, 0, 3.05, 0);
  add(new THREE.TorusGeometry(0.2, 0.05, 10, 28), mShirt, body, 0, 2.98, 0.0).rotation.x = Math.PI / 2;

  // head
  const head = new THREE.Group(); head.position.set(0, 3.5, 0); head.scale.setScalar(headScale); body.add(head);
  add(new THREE.SphereGeometry(0.44, 48, 32), mSkin, head, 0, 0, 0, 0.94, 1.08, 1.0);
  add(new THREE.SphereGeometry(0.4, 32, 20), mSkin, head, 0, -0.12, 0.04, 0.9, 0.9, 0.95);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.085, 16, 12), mSkin, head, s * 0.41, -0.02, 0, 0.5, 1, 0.8);
    const eyeW = new THREE.MeshStandardMaterial({ color: '#f7f5f2', roughness: 0.2 });
    add(new THREE.SphereGeometry(0.078, 20, 14), eyeW, head, s * 0.15, 0.06, 0.375, 1, 1.1, 0.6);
    add(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: '#3a2316', roughness: 0.25 }), head, s * 0.15, 0.06, 0.41, 1, 1.1, 0.5);
    add(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.1 }), head, s * 0.15, 0.06, 0.43, 1, 1, 0.5);
    add(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), head, s * 0.15 + 0.014, 0.085, 0.445);
    const brow = add(new THREE.CapsuleGeometry(0.018, 0.1, 4, 8), mHair, head, s * 0.15, 0.185, 0.385); brow.rotation.z = Math.PI / 2 - s * 0.12; brow.rotation.x = 0.2;
  }
  add(new THREE.SphereGeometry(0.07, 20, 14), mSkin, head, 0, -0.045, 0.43, 0.9, 1.1, 0.9);
  const mouth = add(new THREE.TorusGeometry(0.085, 0.011, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#7a3b36', roughness: 0.4 }), head, 0, -0.17, 0.385);
  mouth.rotation.z = Math.PI; mouth.rotation.x = -0.1;
  // hair
  add(new THREE.SphereGeometry(0.472, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), mHair, head, 0, 0.03, -0.06, 0.96, 1.08, 1.02);
  add(new THREE.SphereGeometry(0.46, 32, 20, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.5), mHair, head, 0, 0.0, -0.1, 0.95, 1.05, 0.95);
  if (longHair) { add(new THREE.CapsuleGeometry(0.38, 0.55, 8, 24), mHair, head, 0, -0.32, -0.2, 1, 1, 0.8); }
  if (beard) add(new THREE.SphereGeometry(0.4, 32, 20, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.4), mHair, head, 0, -0.1, 0.05, 0.96, 1.02, 1.02);

  const mkLeg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.23, 1.54, 0); body.add(hip);
    add(new THREE.CapsuleGeometry(0.19, 0.5, 10, 24), mPants, hip, 0, -0.37, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.74, 0); hip.add(knee);
    add(new THREE.SphereGeometry(0.175, 20, 14), mPants, knee, 0, 0, 0);
    add(new THREE.CapsuleGeometry(0.16, 0.46, 10, 24), mPants, knee, 0, -0.34, 0);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20), mPants, knee, 0, -0.66, 0);
    const shoeG = new THREE.Group(); shoeG.position.set(0, -0.72, 0.1); knee.add(shoeG);
    add(new THREE.SphereGeometry(0.2, 24, 16), mShoe, shoeG, 0, 0.0, 0.0, 0.9, 0.62, 1.7);
    add(new THREE.BoxGeometry(0.34, 0.05, 0.64), mSole, shoeG, 0, -0.1, 0.02);
    return { hip, knee };
  };
  const mkArm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.68, 2.75, 0); body.add(sh);
    add(new THREE.SphereGeometry(0.17, 20, 14), mShirt, sh, 0, 0, 0);
    add(new THREE.CapsuleGeometry(0.145, 0.5, 10, 24), mShirt, sh, 0, -0.42, 0);
    const elbow = new THREE.Group(); elbow.position.set(0, -0.82, 0); sh.add(elbow);
    add(new THREE.SphereGeometry(0.13, 16, 12), mSkin, elbow, 0, 0, 0);
    add(new THREE.CapsuleGeometry(0.115, 0.36, 10, 20), mSkin, elbow, 0, -0.3, 0);
    // hand: palm + finger pack + thumb
    const hand = new THREE.Group(); hand.position.set(0, -0.68, 0); elbow.add(hand);
    add(new THREE.SphereGeometry(0.12, 18, 14), mSkin, hand, 0, 0, 0, 1, 0.9, 0.6);
    add(new THREE.CapsuleGeometry(0.052, 0.08, 6, 12), mSkin, hand, 0, -0.14, 0, 1.9, 1, 0.9);
    const th = add(new THREE.CapsuleGeometry(0.036, 0.08, 6, 10), mSkin, hand, -sx * 0.1, -0.05, 0.04); th.rotation.z = -sx * 0.5; th.rotation.x = -0.3;
    return { sh, elbow, hand };
  };
  const L = mkLeg(-1), R = mkLeg(1), aL = mkArm(-1), aR = mkArm(1);
  g.scale.setScalar(scale);
  return { group: g, body, head, mShirt, mSkin, L, R, aL, aR };
}

/** drive a figure's joints from a compact pose description */
export function applyPose(f, S) {
  const { walk = 0, ph = 0, sit = 0, floor = 0, arm = 'idle', t = 0 } = S;
  const sw = Math.sin(ph) * 0.75 * walk;
  let hipL = sw, hipR = -sw;
  let kneeL = Math.max(0, -Math.sin(ph)) * 0.9 * walk;
  let kneeR = Math.max(0, Math.sin(ph)) * 0.9 * walk;
  const s = Math.max(sit, floor);
  const kneeTarget = Math.PI / 2 * sit + 0.25 * floor;
  hipL = lerp(hipL, -Math.PI / 2, s); hipR = lerp(hipR, -Math.PI / 2, s);
  kneeL = lerp(kneeL, kneeTarget, s); kneeR = lerp(kneeR, kneeTarget, s);
  f.L.hip.rotation.x = hipL; f.R.hip.rotation.x = hipR;
  f.L.knee.rotation.x = kneeL; f.R.knee.rotation.x = kneeR;
  f.body.rotation.z = Math.sin(ph) * 0.03 * walk;
  f.head.rotation.y = arm === 'solder' ? -0.15 : Math.sin(t * 0.5) * 0.06;
  f.head.rotation.x = arm === 'solder' ? 0.25 : arm === 'type' ? 0.14 : 0;

  const A = (a, shx, elx, shz = 0) => { a.sh.rotation.x = shx; a.elbow.rotation.x = elx; a.sh.rotation.z = shz; };
  const br = Math.sin(t * 1.6) * 0.03;
  switch (arm) {
    case 'type':
      A(f.aL, -0.75 + Math.sin(t * 13) * 0.05, -1.05, 0.05);
      A(f.aR, -0.75 + Math.sin(t * 11 + 1) * 0.05, -1.05, -0.05); break;
    case 'eat': {
      const k = Math.sin(t * 2.2) * 0.5 + 0.5;
      A(f.aR, -0.55, lerp(-0.7, -2.4, k), -0.1);
      A(f.aL, -0.6, -0.95, 0.1); break;
    }
    case 'solder':
      A(f.aR, SOLDER.sh + Math.sin(t * 5) * 0.015, SOLDER.el, -0.08);
      A(f.aL, -1.0, -0.7, 0.1); break;
    case 'wave':
      A(f.aR, -2.7, -0.35, -0.2 + Math.sin(t * 8) * 0.45);
      A(f.aL, 0.05, -0.2, 0.08); break;
    case 'talk':
      A(f.aR, -0.9 + Math.sin(t * 3) * 0.3, -1.0 + Math.sin(t * 4) * 0.3, -0.12);
      A(f.aL, -0.45, -0.8, 0.1); break;
    case 'up':
      A(f.aL, -2.9, -0.15, 0.2); A(f.aR, -2.9, -0.15, -0.2); break;
    case 'reach':
      A(f.aR, -2.2 + Math.sin(t * 6) * 0.04, -0.2, -0.05); A(f.aL, 0.05, -0.25, 0.1); break;
    case 'play':
      A(f.aR, -1.2 + Math.sin(t * 6) * 0.5, -0.5, -0.1);
      A(f.aL, -1.2 + Math.sin(t * 6 + 2) * 0.5, -0.5, 0.1); break;
    case 'rest':
      A(f.aL, -0.35, -0.8, 0.1); A(f.aR, -0.35, -0.8, -0.1); break;
    case 'sleep':
      A(f.aL, -0.2, -0.6, 0.12); A(f.aR, -0.5, -0.9, -0.1); break;
    default:
      A(f.aL, -sw * 0.9 + br, -0.12 - 0.35 * walk, 0.06);
      A(f.aR, sw * 0.9 - br, -0.12 - 0.35 * walk, -0.06);
  }
}
