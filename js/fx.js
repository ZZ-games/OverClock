// Particle bursts and speed lines
import * as THREE from 'three';

export class Particles {
  constructor(scene, cap = 700) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.base = new Float32Array(cap * 3);
    for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.28, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.next = 0;
    this._c = new THREE.Color();
  }

  burst(x, y, z, color, count = 30, speed = 8, life = 0.7) {
    this._c.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.cap;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      this.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.8;
      this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      this.base[i * 3] = this._c.r * 2; this.base[i * 3 + 1] = this._c.g * 2; this.base[i * 3 + 2] = this._c.b * 2;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
    }
  }

  update(dt, move) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) { this.pos[j + 1] = -999; this.col[j] = this.col[j + 1] = this.col[j + 2] = 0; continue; }
      this.vel[j + 1] -= 14 * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] = Math.max(0.05, this.pos[j + 1] + this.vel[j + 1] * dt);
      this.pos[j + 2] += this.vel[j + 2] * dt + move;
      const f = this.life[i] / this.maxLife[i];
      this.col[j] = this.base[j] * f; this.col[j + 1] = this.base[j + 1] * f; this.col[j + 2] = this.base[j + 2] * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

export class SpeedLines {
  constructor(scene, n = 90) {
    this.n = n;
    this.data = [];
    const pos = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo = g;
    this.mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(g, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    for (let i = 0; i < n; i++) this.data.push(this._spawn({}, true));
  }

  _spawn(d, anyZ) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 10;
    d.x = Math.cos(a) * r * 1.4;
    d.y = Math.max(0.3, 2.5 + Math.sin(a) * r * 0.6);
    d.z = anyZ ? -Math.random() * 120 : -100 - Math.random() * 40;
    d.len = 2 + Math.random() * 5;
    return d;
  }

  update(dt, move, factor, color) {
    this.mat.opacity = Math.max(0, (factor - 0.2)) * 0.55;
    if (color) this.mat.color.set(color);
    const pos = this.geo.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      const d = this.data[i];
      d.z += move * 2.2;
      if (d.z > 10) this._spawn(d, false);
      const L = d.len * (0.5 + factor * 2);
      pos.set([d.x, d.y, d.z, d.x, d.y, d.z - L], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
