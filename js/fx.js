/** Screen/world effects: billboard particle pool (smoke, sparks, glass, blood, fire) and the windscreen blood + wipers overlay. */
import * as THREE from 'three';

export class Particles {
  constructor(scene, N = 900) {
    this.N = N; this.i = 0;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N).fill(1);
    this.size = new Float32Array(N); this.grow = new Float32Array(N); this.grav = new Float32Array(N); this.drag = new Float32Array(N);
    this.col = new Float32Array(N * 3); this.a0 = new Float32Array(N); this.add = new Float32Array(N);
    const q = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iCol = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iAdd = new THREE.InstancedBufferAttribute(this.add, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iCol', this.iCol); g.setAttribute('iAdd', this.iAdd); g.instanceCount = N;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: 'attribute vec4 iPos; attribute vec4 iCol; attribute float iAdd; varying vec2 vUv; varying vec4 vC; varying float vA; void main(){ vUv = uv; vC = iCol; vA = iAdd; vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0); mv.xy += position.xy * iPos.w; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec2 vUv; varying vec4 vC; varying float vA; void main(){ float a = smoothstep(1.0, 0.0, length(vUv - 0.5) * 2.0) * vC.a; gl_FragColor = vec4(vC.rgb * a, a * (1.0 - vA)); }',
    });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; scene.add(this.mesh);
  }
  /** o: x,y,z, vx,vy,vz, life, size, grow, grav, drag, col[3], a, add */
  emit(o) {
    const i = this.i = (this.i + 1) % this.N, k = i * 3;
    this.p[k] = o.x; this.p[k + 1] = o.y; this.p[k + 2] = o.z; this.v[k] = o.vx || 0; this.v[k + 1] = o.vy || 0; this.v[k + 2] = o.vz || 0;
    this.life[i] = this.max[i] = o.life || 1; this.size[i] = o.size || 0.3; this.grow[i] = o.grow || 0; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0.5;
    const c = o.col || [1, 1, 1]; this.col[k] = c[0]; this.col[k + 1] = c[1]; this.col[k + 2] = c[2]; this.a0[i] = o.a ?? 1; this.add[i] = o.add ? 1 : 0;
  }
  burst(n, o, spread = 1, fn) { for (let i = 0; i < n; i++) { const r = () => Math.random() * 2 - 1; this.emit({ ...o, vx: (o.vx || 0) + r() * spread, vy: (o.vy || 0) + r() * spread, vz: (o.vz || 0) + r() * spread, life: (o.life || 1) * (0.6 + Math.random() * 0.8), ...(fn ? fn(i) : {}) }); } }
  update(dt) {
    const ip = this.iPos.array, ic = this.iCol.array;
    for (let i = 0; i < this.N; i++) {
      const k = i * 3;
      if (this.life[i] <= 0) { ip[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt; const d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[k] *= d; this.v[k + 1] = this.v[k + 1] * d - this.grav[i] * dt; this.v[k + 2] *= d;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.p[k + 1] < 0.03 && this.grav[i] > 0) { this.p[k + 1] = 0.03; this.v[k + 1] = 0; this.v[k] *= 0.6; this.v[k + 2] *= 0.6; }
      const u = Math.max(0, this.life[i] / this.max[i]);
      ip[i * 4] = this.p[k]; ip[i * 4 + 1] = this.p[k + 1]; ip[i * 4 + 2] = this.p[k + 2]; ip[i * 4 + 3] = this.size[i] + this.grow[i] * (1 - u);
      ic[i * 4] = this.col[k]; ic[i * 4 + 1] = this.col[k + 1]; ic[i * 4 + 2] = this.col[k + 2]; ic[i * 4 + 3] = this.a0[i] * Math.min(1, u * 2.2);
    }
    this.iPos.needsUpdate = this.iCol.needsUpdate = this.iAdd.needsUpdate = true;
  }
}

/** blood on the windscreen; the wipers (X) sweep it off */
export class Blood {
  constructor(bc, wc) {
    this.bc = bc; this.wc = wc; this.W = bc.width = wc.width = 960; this.H = bc.height = wc.height = 540;
    this.b = bc.getContext('2d'); this.w = wc.getContext('2d'); this.cover = 0; this.drips = []; this.t = -1; this.a = 0;
  }
  splat(power) {
    const { b, W, H } = this, n = Math.min(14, 3 + Math.round(power * 10)), cx = W * (0.3 + Math.random() * 0.4), cy = H * (0.25 + Math.random() * 0.4);
    for (let i = 0; i < n; i++) {
      const x = cx + (Math.random() - 0.5) * W * 0.45 * (0.4 + power), y = cy + (Math.random() - 0.5) * H * 0.4 * (0.4 + power), r = (14 + Math.random() * 46) * (0.5 + power);
      const g = b.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(120,6,10,.95)'); g.addColorStop(0.7, 'rgba(95,3,6,.85)'); g.addColorStop(1, 'rgba(70,0,3,0)');
      b.fillStyle = g; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill();
      if (Math.random() < 0.7) this.drips.push({ x, y: y + r * 0.5, w: 2 + Math.random() * 4, max: 40 + Math.random() * 160 * power, v: 8 + Math.random() * 18, l: 0 });
      for (let s = 0; s < 4; s++) { b.fillStyle = 'rgba(105,4,8,.9)'; b.beginPath(); b.arc(x + (Math.random() - 0.5) * r * 3.5, y + (Math.random() - 0.5) * r * 3.5, 1 + Math.random() * 4, 0, 7); b.fill(); }
    }
    this.cover = Math.min(1, this.cover + 0.25 + power * 0.5);
  }
  wipe() { if (this.t < 0 && this.cover > 0) { this.t = 0; this.a = 0.98; return true; } return false; }
  get wiping() { return this.t >= 0; }
  update(dt) {
    const { b, w, W, H } = this;
    for (const d of this.drips) if (d.l < d.max) { const s = d.v * dt; b.strokeStyle = 'rgba(95,3,6,.85)'; b.lineWidth = d.w; b.lineCap = 'round'; b.beginPath(); b.moveTo(d.x, d.y + d.l); d.l += s; b.lineTo(d.x, d.y + d.l); b.stroke(); }
    if (this.drips.length > 40) this.drips.splice(0, this.drips.length - 40);
    if (this.t < 0) return;
    const dur = 2.0, prev = this.a; this.t += dt;
    const u = this.t / dur, leg = Math.min(3, Math.floor(u * 4)), f = u * 4 - leg, ease = f * f * (3 - 2 * f), p = leg % 2 ? 1 - ease : ease;
    this.a = 0.97 * Math.PI + (0.2 * Math.PI - 0.97 * Math.PI) * (u >= 1 ? 0 : p);
    w.clearRect(0, 0, W, H);
    const R = Math.hypot(W * 0.62, H * 1.02) * 1.15;
    for (const px of [W * 0.62, W * 0.26]) {
      const py = H * 1.04, x0 = px + Math.cos(prev) * R, y0 = py - Math.sin(prev) * R, x1 = px + Math.cos(this.a) * R, y1 = py - Math.sin(this.a) * R;
      b.save(); b.globalCompositeOperation = 'destination-out'; b.beginPath(); b.moveTo(px, py); b.lineTo(x0, y0); b.lineTo(x1, y1); b.closePath(); b.fill(); b.restore();
      w.strokeStyle = '#0b0b0d'; w.lineWidth = 7; w.lineCap = 'round'; w.beginPath(); w.moveTo(px, py); w.lineTo(px + Math.cos(this.a) * R * 0.78, py - Math.sin(this.a) * R * 0.78); w.stroke();
    }
    if (u >= 1) { this.t = -1; this.cover = 0; this.drips.length = 0; b.clearRect(0, 0, W, H); w.clearRect(0, 0, W, H); }
  }
}
