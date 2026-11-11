// Player ship models and the light trail
import * as THREE from 'three';

export const SHIPS = {
  dart:  { name: 'Dart',  body: 0x2a2f4a, accent: 0x00e5ff, wing: 1.9, sweep: 0.5, len: 2.0, fins: 1 },
  viper: { name: 'Viper', body: 0x3a0a2a, accent: 0xff2bd6, wing: 1.5, sweep: 0.9, len: 2.4, fins: 2 },
  wing:  { name: 'Wing',  body: 0x1a2a1a, accent: 0x7aff1a, wing: 2.6, sweep: 0.2, len: 1.7, fins: 2 },
  manta: { name: 'Manta', body: 0x2a1a05, accent: 0xffd319, wing: 2.3, sweep: 1.2, len: 2.2, fins: 0 },
};

export const TRAILS = {
  cyan:    { name: 'Cyan',    color: 0x00e5ff },
  magenta: { name: 'Magenta', color: 0xff2bd6 },
  gold:    { name: 'Gold',    color: 0xffd319 },
  white:   { name: 'Pure',    color: 0xffffff },
  rainbow: { name: 'Rainbow', color: 0xffffff, rainbow: true },
};

function edgeLines(geo, color) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color }));
}

export function buildShip(type, opts = {}) {
  const s = SHIPS[type] || SHIPS.dart;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: s.body, metalness: 0.8, roughness: 0.3, emissive: s.accent, emissiveIntensity: 0.08 });
  const accentCol = new THREE.Color(s.accent).multiplyScalar(2.2);

  // fuselage: a stretched 4-sided cone pointing forward (-z)
  const fus = new THREE.ConeGeometry(0.42, s.len, 4, 1);
  fus.rotateX(-Math.PI / 2);
  fus.rotateZ(Math.PI / 4);
  fus.scale(1, 0.55, 1);
  const fusM = new THREE.Mesh(fus, bodyMat);
  g.add(fusM, edgeLines(fus, accentCol));

  // wings: a flat triangle-ish shape
  const shape = new THREE.Shape();
  const w = s.wing, sw = s.sweep;
  shape.moveTo(0, -0.2);
  shape.lineTo(w, 0.35 + sw * 0.4);
  shape.lineTo(w * 0.92, 0.6 + sw * 0.4);
  shape.lineTo(0, 0.55);
  shape.lineTo(-w * 0.92, 0.6 + sw * 0.4);
  shape.lineTo(-w, 0.35 + sw * 0.4);
  shape.closePath();
  const wing = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  wing.rotateX(Math.PI / 2);
  wing.translate(0, 0.0, 0.05);
  const wingM = new THREE.Mesh(wing, bodyMat);
  g.add(wingM, edgeLines(wing, accentCol));

  // fins
  for (let i = 0; i < s.fins; i++) {
    const fin = new THREE.BoxGeometry(0.05, 0.45, 0.5);
    fin.translate(s.fins === 1 ? 0 : (i ? 0.35 : -0.35), 0.25, 0.55);
    g.add(new THREE.Mesh(fin, bodyMat), edgeLines(fin, accentCol));
  }

  // cockpit
  const cp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(s.accent).multiplyScalar(1.5) }));
  cp.scale.set(1, 0.6, 1.8);
  cp.position.set(0, 0.16, -0.1);
  g.add(cp);

  // engine glow
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(s.accent).multiplyScalar(3) });
  const eng = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMat);
  eng.position.set(0, 0, s.len / 2 - 0.05);
  eng.scale.set(1.4, 0.8, 0.6);
  g.add(eng);
  g.userData.engine = eng;

  if (opts.ghost) {
    g.traverse((o) => {
      if (o.material) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.28;
        o.material.depthWrite = false;
      }
    });
  }
  g.userData.accent = s.accent;
  return g;
}

// Ribbon trail behind the ship. Points move toward the camera with the world.
export class Trail {
  constructor(scene, n = 46) {
    this.n = n;
    this.pts = [];
    for (let i = 0; i < n; i++) this.pts.push(new THREE.Vector3(0, 0.7, 0));
    const pos = new Float32Array(n * 2 * 3);
    const col = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.color = new THREE.Color(0x00e5ff);
    this.rainbow = false;
    this.t = 0;
    this._c = new THREE.Color();
  }

  setStyle(key) {
    const t = TRAILS[key] || TRAILS.cyan;
    this.color.set(t.color);
    this.rainbow = !!t.rainbow;
  }

  reset(x, y) { for (const p of this.pts) p.set(x, y, 0); }

  update(dt, move, x, y, z, intensity = 1) {
    this.t += dt;
    for (let i = this.n - 1; i > 0; i--) {
      this.pts[i].copy(this.pts[i - 1]);
      this.pts[i].z += move;
    }
    this.pts[0].set(x, y, z);
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.color.array;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i];
      const f = 1 - i / (this.n - 1);
      const w = 0.42 * f + 0.02;
      pos.set([p.x - w, p.y, p.z, p.x + w, p.y, p.z], i * 6);
      if (this.rainbow) this._c.setHSL((this.t * 0.4 + i * 0.03) % 1, 1, 0.55);
      else this._c.copy(this.color);
      const fade = Math.min(1, Math.max(0, (5 - p.z) / 4));
      const k = f * f * 0.9 * intensity * fade;
      col.set([this._c.r * k, this._c.g * k, this._c.b * k, this._c.r * k, this._c.g * k, this._c.b * k], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
