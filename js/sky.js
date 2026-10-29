import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { lerp, clamp, mat } from './util.js';
import { std } from './materials.js';

const FOG = [
  [0, '#0a0e1f'], [5, '#141a3d'], [6.0, '#c9787f'], [6.8, '#f0b79a'], [8, '#b8dcf5'], [12, '#a9d4f4'],
  [16.5, '#b2d3ee'], [17.8, '#f3b58a'], [18.7, '#a8628c'], [19.6, '#3d3468'], [20.6, '#171a42'], [24, '#0a0e1f'],
];
const DARK = [[0, 1], [5, 1], [6.8, 0.35], [8, 0], [17, 0], [18.5, 0.4], [20, 0.85], [21, 1], [24, 1]];
const ca = new THREE.Color(), cb = new THREE.Color();
export function skyColor(h, out) {
  for (let i = 0; i < FOG.length - 1; i++) {
    if (h <= FOG[i + 1][0]) {
      const k = (h - FOG[i][0]) / (FOG[i + 1][0] - FOG[i][0]);
      return out.copy(ca.set(FOG[i][1])).lerp(cb.set(FOG[i + 1][1]), k);
    }
  }
  return out.set(FOG[FOG.length - 1][1]);
}
export function darkness(h) {
  for (let i = 0; i < DARK.length - 1; i++) {
    if (h <= DARK[i + 1][0]) return lerp(DARK[i][1], DARK[i + 1][1], (h - DARK[i][0]) / (DARK[i + 1][0] - DARK[i][0]));
  }
  return 1;
}

function ridge(seedX, base, amp, color, z, w = 1700) {
  const pts = [], N = 220;
  for (let i = 0; i <= N; i++) {
    const x = (i / N - 0.25) * w;
    const y = base + amp * (Math.abs(Math.sin(x * 0.011 + seedX)) * 0.7 + Math.abs(Math.sin(x * 0.029 + seedX * 2)) * 0.35 + Math.abs(Math.sin(x * 0.083 + seedX * 3)) * 0.12);
    pts.push(new THREE.Vector2(x, y));
  }
  const s = new THREE.Shape([new THREE.Vector2(pts[0].x, -4), ...pts, new THREE.Vector2(pts[N].x, -4)]);
  const g = new THREE.ShapeGeometry(s);
  const m = new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide });
  const o = new THREE.Mesh(g, m); o.position.z = z; o.frustumCulled = false; o.userData.dyn = true;
  return o;
}

export function createSky(scene, renderer) {
  const fogColor = new THREE.Color('#a9d4f4');
  scene.fog = new THREE.Fog(fogColor.clone(), 90, 900);

  const mkSky = (scale) => {
    const s = new Sky(); s.scale.setScalar(scale);
    const u = s.material.uniforms;
    u.turbidity.value = 3.2; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.84;
    return s;
  };
  const sky = mkSky(1600); scene.add(sky);
  const envScene = new THREE.Scene(); const envSky = mkSky(1000); envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, lastEnv = -99;

  const sun = new THREE.DirectionalLight('#fff4e0', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 26, bottom: -26, near: 1, far: 140 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ color: '#f1f4ff', fog: false, toneMapped: false }));
  moon.material.color.multiplyScalar(2.2); scene.add(moon);

  const N = 1400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 700 + Math.random() * 60, up = Math.random() ** 0.8;
    pos[i * 3] = Math.cos(a) * r * 1.4; pos[i * 3 + 1] = 30 + up * 520; pos[i * 3 + 2] = -Math.abs(Math.sin(a)) * r - 60;
    const b = 0.55 + Math.random() * 0.45, t = Math.random(); col[i * 3] = b * (0.8 + 0.2 * t); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (1 - 0.2 * t);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);

  // layered ridges
  const ridges = [ridge(0.4, 6, 46, '#6f8fa3', -330), ridge(2.1, 4, 30, '#58788a', -220), ridge(4.7, 2, 20, '#456574', -150)];
  ridges.forEach((r) => scene.add(r));

  const sunDir = new THREE.Vector3(), warm = new THREE.Color('#ffb98a'), white = new THREE.Color('#fff3e0'), moonCol = new THREE.Color('#9db8ff'), tmp = new THREE.Color();
  const api = {
    sky: fogColor, dark: 0, sunLight: sun, envIntensity: 1, labK: 0,
    update(hour, camX, labK, camY = 0) {
      api.labK = labK;
      skyColor(hour, fogColor);
      const dark = (api.dark = darkness(hour));
      scene.fog.color.copy(fogColor);
      const f = (hour - 6.0) / 12.8, el = 58 * Math.sin(Math.PI * f), az = lerp(-78, 78, clamp(f));
      const e = THREE.MathUtils.degToRad(el), a = THREE.MathUtils.degToRad(az);
      sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
      sky.material.uniforms.sunPosition.value.copy(sunDir);
      sky.position.x = camX;

      if (Math.abs(hour - lastEnv) > 0.12) {
        lastEnv = hour;
        envSky.material.uniforms.sunPosition.value.copy(sunDir);
        const rt = pmrem.fromScene(envScene, 0, 0.1, 3000);
        if (envRT) envRT.dispose();
        envRT = rt; scene.environment = rt.texture;
      }
      scene.environmentIntensity = lerp(0.34, 0.45, dark) * lerp(1, 0.3, labK);

      const day = el > 2;
      const lift = Math.sin(Math.PI * clamp(f));
      sun.intensity = lerp(1.35, 0.5, dark) * lerp(1, 0.04, labK);
      sun.color.copy(warm).lerp(white, Math.pow(lift, 0.45)).lerp(moonCol, dark);
      sun.target.position.set(camX, camY, 0);
      sun.position.set(camX + (day ? lerp(-14, 14, clamp(f)) : -10), camY + (day ? 26 + 12 * lift : 32), 28);
      moon.visible = dark > 0.55;
      moon.position.set(camX + 90, 150, -450); moon.lookAt(camX, 60, 200);
      stars.material.opacity = clamp((dark - 0.5) / 0.5);
      stars.position.x = camX;
      ridges.forEach((r, i) => {
        r.position.x = camX * (0.97 - i * 0.04) - 600;
        r.material.color.set(['#6f8fa3', '#58788a', '#456574'][i]).lerp(fogColor, 0.35 - i * 0.08).multiplyScalar(lerp(1, 0.22, dark));
      });
    },
  };
  return api;
}

/** windows texture for city buildings: reflective glass with lit panes in the emissive map */
export function cityMaterials() {
  const mk = (lit) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
    const c = cv.getContext('2d');
    c.fillStyle = lit ? '#000' : '#9aa6c0'; c.fillRect(0, 0, 256, 512);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 14; y < 500; y += 40) for (let x = 14; x < 244; x += 36) {
      const on = rnd() > 0.5;
      if (lit) { c.fillStyle = on ? ['#ffd27a', '#ffe9b8', '#ffcf6a'][(rnd() * 3) | 0] : '#000'; c.fillRect(x, y, 24, 28); }
      else {
        const g = c.createLinearGradient(x, y, x + 24, y + 28); g.addColorStop(0, '#d4ecff'); g.addColorStop(1, '#5d7396');
        c.fillStyle = on ? g : '#3c4966'; c.fillRect(x, y, 24, 28);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y, 24, 2);
      }
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  };
  const map = mk(false), em = mk(true);
  return (color) => new THREE.MeshStandardMaterial({ color, map, emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 0, roughness: 0.35, metalness: 0.2 });
}
