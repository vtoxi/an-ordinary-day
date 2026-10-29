import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * HDR pipeline: 4x MSAA -> ground-truth ambient occlusion -> bloom -> filmic tone map.
 * A small governor trades pixel ratio / AO for frame time so scrolling stays smooth on any GPU.
 */
export function createGfx(canvas, scene, camera, { lock = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.2, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 14 });
  gtao.blendIntensity = 0.95;
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.62, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const LEVELS = [
    { pr: 1, ao: false, bloom: false },
    { pr: Math.min(dpr, 1.25), ao: false, bloom: true },
    { pr: Math.min(dpr, 1.5), ao: true, bloom: true },
    { pr: dpr, ao: true, bloom: true },
  ];
  let level = lock ?? 3, w = 4, h = 4;
  const apply = () => {
    const L = LEVELS[level];
    gtao.enabled = L.ao; bloom.enabled = L.bloom;
    renderer.setPixelRatio(L.pr); composer.setPixelRatio(L.pr);
    renderer.setSize(w, h, false); composer.setSize(w, h);
  };
  const api = {
    renderer, composer, gtao, bloom,
    get level() { return level; },
    resize(W, H) { w = W; h = H; apply(); },
    render() { composer.render(); },
    // frame-time governor
    _ema: 16, _n: 0, _fast: 0,
    tick(dtMs) {
      if (lock !== null) return;
      api._ema += (dtMs - api._ema) * 0.08;
      if (++api._n < 45) return;
      if (api._ema > 27 && level > 0) { level--; api._n = 0; api._fast = 0; apply(); }
      else if (api._ema < 15 && level < LEVELS.length - 1) { if (++api._fast > 360) { level++; api._n = 0; api._fast = 0; apply(); } }
      else api._fast = 0;
    },
  };
  return api;
}
