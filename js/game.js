import * as THREE from 'three';
import { clamp, lerp, smooth, seg } from './util.js';
import { makeFigure, applyPose } from './figures.js';
import { CHAPTERS, L } from './story.js';
import { UP2 } from './actor.js';

/* Game layer: procedural sound, rain, NPCs + a cat, click interactions, task list. */
export function createGame({ scene, camera, world, canvas }) {
  const CH = world.CH, lpOf = world.lpOf;
  const api = { rainK: 0, muted: false };

  /* ---------------- sound (WebAudio, all synthesised) ---------------- */
  let A = null, master, noiseBuf, amb, rainG, humG;
  const loop = (type, freq, gain) => { const s = A.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = A.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = A.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(master); s.start(); return g; };
  const burst = (freq, dur, vol, type = 'bandpass') => { if (!A) return; const s = A.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4; const f = A.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 1.2; const g = A.createGain(); const t = A.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random(), dur + 0.05); };
  const beep = (freq, dur, vol = 0.05, type = 'square') => { if (!A) return; const o = A.createOscillator(); o.type = type; o.frequency.value = freq; const g = A.createGain(); const t = A.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); };
  const start = () => {
    if (A) { if (A.state === 'suspended') A.resume(); return; }
    A = new (window.AudioContext || window.webkitAudioContext)();
    master = A.createGain(); master.gain.value = api.muted ? 0 : 0.6; master.connect(A.destination);
    noiseBuf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    amb = loop('lowpass', 260, 0.05); rainG = loop('highpass', 2600, 0); humG = A.createOscillator(); const hg = A.createGain(); hg.gain.value = 0; humG.type = 'sawtooth'; humG.frequency.value = 55; humG.connect(hg); hg.connect(master); humG.start(); humG.g = hg;
  };
  addEventListener('pointerdown', start, { once: false }); addEventListener('keydown', start);
  api.toggleMute = () => { api.muted = !api.muted; if (master) master.gain.value = api.muted ? 0 : 0.6; return api.muted; };

  /* ---------------- car radio: three generated stations + tuning static ---------------- */
  const STATIONS = [{ name: 'Lo-Fi FM 91.2', title: 'Night Drive', bpm: 78, root: 57, scale: [0, 3, 5, 7, 10], wave: 'triangle', prog: [0, 5, 3, 4] }, { name: 'Synth FM 98.6', title: 'Neon Roads', bpm: 104, root: 52, scale: [0, 2, 4, 7, 9], wave: 'sawtooth', prog: [0, 3, 5, 4] }, { name: 'Chill FM 104.0', title: 'Blue Hour', bpm: 92, root: 55, scale: [0, 2, 3, 7, 8], wave: 'sine', prog: [0, 2, 4, 3] }];
  let stN = 0, radioG = null, engOsc = null, engG = null, nextT = 0, step = 0, seqTimer = 0;
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const note = (when, freq, dur, vol, type) => { const o = A.createOscillator(), g = A.createGain(), f = A.createBiquadFilter(); o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); o.connect(f); f.connect(g); g.connect(radioG); o.start(when); o.stop(when + dur + 0.05); };
  const drum = (when, freq, dur, vol, hp) => { const s = A.createBufferSource(); s.buffer = noiseBuf; const f = A.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = freq; const g = A.createGain(); g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); s.connect(f); f.connect(g); g.connect(radioG); s.start(when, Math.random(), dur + 0.02); };
  const seq = () => {
    if (!A || !radioG) return; const S_ = STATIONS[stN], sd = 60 / S_.bpm / 4;
    if (nextT < A.currentTime) nextT = A.currentTime + 0.05;
    while (nextT < A.currentTime + 0.35) {
      const bar = Math.floor(step / 16) % 4, deg = S_.prog[bar], sc = S_.scale, st = step % 16;
      if (st % 4 === 0) drum(nextT, 140, 0.18, 0.5, false); if (st % 2 === 1) drum(nextT, 7000, 0.04, 0.12, true); if (st === 4 || st === 12) drum(nextT, 1800, 0.1, 0.25, true);
      if (st % 8 === 0) note(nextT, mtof(S_.root - 12 + sc[deg % sc.length]), sd * 7, 0.22, 'triangle');
      if (st === 0) for (const k of [0, 2, 4]) note(nextT, mtof(S_.root + sc[(deg + k) % sc.length]), sd * 15, 0.07, S_.wave);
      if (Math.random() < 0.28) note(nextT, mtof(S_.root + 12 + sc[(Math.random() * sc.length) | 0]), sd * 3, 0.09, S_.wave);
      nextT += sd; step++;
    }
  };
  const startRadio = () => { if (radioG) return; radioG = A.createGain(); radioG.gain.value = 0; radioG.connect(master); seqTimer = setInterval(seq, 120); engOsc = A.createOscillator(); engOsc.type = 'sawtooth'; engG = A.createGain(); engG.gain.value = 0; const ef = A.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 220; engOsc.connect(ef); ef.connect(engG); engG.connect(master); engOsc.start(); };
  api.station = () => STATIONS[stN];
  api.nextStation = () => { stN = (stN + 1) % STATIONS.length; step = 0; if (A) { burst(3000, 0.45, 0.12, 'highpass'); } };

  /* ---------------- rain ---------------- */
  const N = 1600, rp = new Float32Array(N * 6), rv = new Float32Array(N), rx = new Float32Array(N), rz = new Float32Array(N), ry = new Float32Array(N);
  for (let i = 0; i < N; i++) { rx[i] = (Math.random() - 0.5) * 120; rz[i] = Math.random() < 0.55 ? -5.5 - Math.random() * 20 : -4 + Math.random() * 19; ry[i] = Math.random() * 40 - 12; rv[i] = 30 + Math.random() * 14; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#bcd7ff', transparent: true, opacity: 0.32, fog: false, depthWrite: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const streetX = (x) => (x > 24 && x < 63) || (x > -30 && x < -7);

  /* ---------------- NPCs ---------------- */
  const mk = (o) => { const f = makeFigure(o); world.LRG.parent.add(f.group); f.group.visible = false; return f; };
  const walker = mk({ shirt: '#5b8def', skin: '#c99a76', hair: '#1b1b22' });
  const barista = mk({ shirt: '#e8862b', skin: '#a8714f', hair: '#2a1c14', longHair: true });
  const guest = mk({ shirt: '#9b6bff', skin: '#e0b090', hair: '#3a2a22' });
  // cat
  const cat = new THREE.Group(); cat.userData.dyn = true; world.LRG.add(cat);
  const fur = new THREE.MeshStandardMaterial({ color: '#c9783a', roughness: 0.9 });
  const part = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, fur); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; cat.add(m); return m; };
  part(new THREE.SphereGeometry(0.42, 20, 14), 0, 0.5, 0, 1.5, 0.9, 0.9); const head = part(new THREE.SphereGeometry(0.3, 20, 14), 0.62, 0.72, 0);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), fur); e.position.set(0.62, 1.0, s * 0.15); head.parent.add(e); }
  const tail = new THREE.Group(); tail.position.set(-0.62, 0.62, 0); cat.add(tail); const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.9, 8), fur); tm.position.y = 0.4; tm.rotation.z = 0.3; tail.add(tm);
  for (const [x, z] of [[0.35, 0.2], [0.35, -0.2], [-0.35, 0.2], [-0.35, -0.2]]) part(new THREE.CylinderGeometry(0.08, 0.07, 0.4, 8), x, 0.2, z);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#1a1a1a' }); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeM); e.position.set(0.88, 0.78, s * 0.1); cat.add(e); }
  const heart = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: '#ff5d8f', transparent: true, opacity: 0, depthWrite: false })); heart.position.set(0.6, 1.6, 0.3); cat.add(heart);
  let purr = 0;
  world.pickables.push({ obj: cat, onClick: () => { purr = 1; burst(240, 0.9, 0.05, 'lowpass'); } });

  /* ---------------- tasks panel ---------------- */
  const tasks = [['wake', 'Switch off the alarm'], ['ready', 'Pack the bag'], ['commute', 'Take the stairs, drive to work'], ['code', 'Push the first commit'], ['meet', 'Join the architecture review'], ['lunch', 'Take the lift up to lunch'], ['build', 'Ship the pipeline'], ['home', 'Unlock the smart door'], ['family', 'Play with the kids'], ['hobby', 'Find the secret door, solder, press the red button'], ['sleep', 'Back in the same bed']];
  const panel = document.createElement('aside'); panel.id = 'quest'; panel.setAttribute('aria-label', 'Tasks');
  panel.innerHTML = '<h2>Tasks</h2><ul>' + tasks.map(([, t]) => `<li><span class="tick"></span>${t}</li>`).join('') + '</ul><p class="keys">V first-person (WASD walk, Shift run, T exit) . C drive camera . N radio . R reset . M sound</p>';
  document.body.appendChild(panel); const lis = [...panel.querySelectorAll('li')];
  const cur = { i: -1 };

  /* ---------------- click interactions ---------------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  const pick = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    for (const p of world.pickables) { if (p.obj.visible === false) continue; const hits = ray.intersectObject(p.obj, true); if (hits.length) return p; }
    return null;
  };
  canvas.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) { const p = pick(e); if (p) { start(); p.onClick(); } } down = null; });
  canvas.addEventListener('pointermove', (e) => { if (!down) canvas.style.cursor = pick(e) ? 'pointer' : ''; });

  /* ---------------- per frame ---------------- */
  let stepK = 0, keyT = 0, beepT = 0, solT = 0;
  api.update = (P, t, dt, S, hour, camX, camY, labK, drv) => {
    // weather: a rainy evening, from the drive home until the lab
    api.rainK = smooth(seg(hour, 16.8, 17.7)) * (1 - smooth(seg(hour, 19.6, 20.6)));
    rain.visible = api.rainK > 0.01;
    if (rain.visible) {
      rain.material.opacity = 0.32 * api.rainK;
      for (let i = 0; i < N; i++) {
        ry[i] -= rv[i] * dt; if (ry[i] < camY - (drv ? 2 : 14)) ry[i] += drv ? 20 : 40;
        let x = camX + rx[i], z = rz[i]; if (drv) { x = camX + rx[i] * 0.4; z = drv.z + ((i * 37) % 50) - 30; } else if (z > -4.4 && !streetX(x)) z = -8 - (i % 9);
        const y = ry[i] + camY * 0, k = i * 6; rp[k] = x; rp[k + 1] = y; rp[k + 2] = z; rp[k + 3] = x - 0.15; rp[k + 4] = y - 1.3; rp[k + 5] = z;
      }
      rg.attributes.position.needsUpdate = true;
    }
    // NPCs
    const officeOn = P > CH.code.start - 2 && P < CH.home.start;
    walker.group.visible = officeOn && !(S.sit > 0.5 && false);
    if (walker.group.visible) { const k = (t * 0.06) % 2, x = k < 1 ? lerp(64, 78, k) : lerp(78, 64, k - 1), dir = k < 1 ? 1 : -1; walker.group.position.set(x, 0, 2.9); walker.group.rotation.y = dir * Math.PI / 2; applyPose(walker, { walk: 1, ph: x * 2.4, arm: 'idle', t, sit: 0, floor: 0, rz: 0, solder: 0 }); }
    const lunchOn = P > CH.meet.end - 1 && P < CH.build.start + 3;
    barista.group.visible = guest.group.visible = lunchOn;
    if (lunchOn) {
      barista.group.position.set(126, UP2, -1.6); barista.group.rotation.y = 0; applyPose(barista, { walk: 0, ph: 0, arm: Math.floor(t * 0.4) % 3 ? 'talk' : 'idle', t, sit: 0, floor: 0, rz: 0, solder: 0 });
      guest.group.position.set(L.lunchX + 7, UP2, 0.6); guest.group.rotation.y = -1.2; applyPose(guest, { walk: 0, ph: 0, arm: Math.floor(t * 0.3) % 2 ? 'eat' : 'talk', t, sit: 0, floor: 0, rz: 0, solder: 0 });
    }
    const catOn = P > CH.home.start + 3 && P < CH.hobby.start + 6;
    cat.visible = catOn;
    if (catOn) {
      const f = ((t * 0.05) % 2), k = f < 1 ? f : 2 - f, nap = Math.sin(t * 0.13) > 0.55;
      const cx = nap ? L.sofaX + 3 : lerp(176, 186, smooth(k));
      cat.position.set(cx, nap ? 1.35 : 0.1, nap ? -1.6 : 3.1); cat.rotation.y = nap ? 0 : (f < 1 ? 0 : Math.PI);
      cat.scale.set(1, nap ? 0.8 : 1, 1); tail.rotation.z = Math.sin(t * 3) * 0.4; head.position.y = 0.72 + Math.sin(t * 2) * 0.01 - (nap ? 0.12 : 0);
      purr = Math.max(0, purr - dt * 0.6); heart.material.opacity = purr; heart.position.y = 1.6 + (1 - purr) * 0.8; heart.lookAt(camera.position);
    }
    // tasks
    let idx = -1; for (let i = 0; i < CHAPTERS.length; i++) if (P >= CHAPTERS[i].start) idx = i;
    if (idx !== cur.i) { cur.i = idx; lis.forEach((li, i) => { li.classList.toggle('done', i < idx); li.classList.toggle('now', i === idx); }); }
    // sound
    if (A) {
      startRadio();
      radioG.gain.setTargetAtTime(drv ? 0.45 : 0, A.currentTime, 0.2); engG.gain.setTargetAtTime(drv ? 0.025 + Math.min(0.03, drv.speed / 3000) : 0, A.currentTime, 0.2); engOsc.frequency.setTargetAtTime(38 + (drv ? drv.speed : 0) * 1.3, A.currentTime, 0.2);
      const bk = drv && drv.blink ? Math.floor(t * 2.5) % 2 : -1; if (bk !== api._bk) { api._bk = bk; if (bk >= 0) beep(bk ? 1100 : 800, 0.03, 0.04, 'square'); }
      const g = (n, v) => n.gain.setTargetAtTime(v, A.currentTime, 0.3);
      g(amb, 0.035 + (S.walk > 0.2 ? 0.01 : 0)); g(rainG, api.rainK * 0.12 * (camY < -4 ? 0.2 : 1)); g(humG.g, labK * 0.05);
      if (S.vis && S.walk > 0.4) { const ph = Math.floor(S.ph / Math.PI); if (ph !== stepK) { stepK = ph; burst(180 + Math.random() * 60, 0.09, 0.06, 'lowpass'); } }
      if (S.arm === 'type' && (keyT -= dt) < 0) { keyT = 0.06 + Math.random() * 0.1; burst(2600 + Math.random() * 1500, 0.03, 0.03, 'highpass'); }
      if (S.solder > 0.3 && (solT -= dt) < 0) { solT = 0.04 + Math.random() * 0.12; burst(5000, 0.05, 0.05, 'highpass'); }
      if (P < CH.wake.start + 0.28 * CH.wake.dur && (beepT -= dt) < 0) { beepT = 0.45; beep(1500, 0.18, 0.05); }
      if (labK > 0.5 && Math.random() < 0.012) { burst(3500, 0.25, 0.07, 'highpass'); beep(90 + Math.random() * 200, 0.12, 0.03, 'sawtooth'); }
    }
  };
  return api;
}
