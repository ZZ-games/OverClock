// Obstacles, time crystals and score orbs
import * as THREE from 'three';
import { TUNING } from './config.js';
import { mulberry32, lerp } from './util.js';

const HALF = TUNING.HALF_WIDTH;
const SW = TUNING.SHIP_HW, SH = TUNING.SHIP_HH, SD = TUNING.SHIP_HD;
const SPAWN_AHEAD = 260;

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.groups = [];
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.edgeGeo = new THREE.EdgesGeometry(this.boxGeo);
    this.crystalGeo = new THREE.OctahedronGeometry(0.45, 0);
    this.orbGeo = new THREE.IcosahedronGeometry(0.28, 0);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a0438, emissive: 0x2a0438, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.9 });
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0xff2bd6 });
    this.crystalMat = new THREE.MeshBasicMaterial({ color: 0x00ffd0 });
    this.orbMat = new THREE.MeshBasicMaterial({ color: 0xffd319 });
    this.pools = { block: [], crystal: [], orb: [] };
    this.rng = Math.random;
  }

  setTheme(t) {
    this.bodyMat.color.set(t.obstacleBody);
    this.bodyMat.emissive.set(t.obstacleBody);
    this.edgeMat.color.set(t.obstacle).multiplyScalar(2.2);
    this.crystalMat.color.set(t.crystal).multiplyScalar(2.0);
    this.orbMat.color.set(t.orb).multiplyScalar(1.8);
  }

  reset(seed) {
    for (const o of this.objects) this._release(o);
    this.objects.length = 0;
    this.groups.length = 0;
    this.rng = mulberry32(seed);
    this.nextAt = 70;
    this.patternCount = 0;
  }

  clear() {
    for (const o of this.objects) this._release(o);
    this.objects.length = 0;
    this.groups.length = 0;
  }

  _mesh(kind) {
    const pool = this.pools[kind];
    if (pool.length) { const m = pool.pop(); m.visible = true; return m; }
    let m;
    if (kind === 'block') {
      m = new THREE.Group();
      m.add(new THREE.Mesh(this.boxGeo, this.bodyMat));
      m.add(new THREE.LineSegments(this.edgeGeo, this.edgeMat));
    } else if (kind === 'crystal') {
      m = new THREE.Mesh(this.crystalGeo, this.crystalMat);
    } else {
      m = new THREE.Mesh(this.orbGeo, this.orbMat);
    }
    this.scene.add(m);
    return m;
  }

  _release(o) {
    o.mesh.visible = false;
    this.pools[o.kind].push(o.mesh);
  }

  _block(group, x, y, z, hw, hh, hd, extra = {}) {
    const mesh = this._mesh('block');
    mesh.scale.set(hw * 2, hh * 2, hd * 2);
    const o = { kind: 'block', mesh, x, y, z, hw, hh, hd, group, ...extra };
    mesh.position.set(x, y, z);
    group.pieces.push(o);
    this.objects.push(o);
    return o;
  }

  _pickup(kind, x, y, z) {
    const mesh = this._mesh(kind);
    mesh.position.set(x, y, z);
    const o = { kind, mesh, x, y, z, spin: Math.random() * 6 };
    this.objects.push(o);
    return o;
  }

  _group(type) {
    const g = { type, pieces: [], hit: false, done: false, phased: false };
    this.groups.push(g);
    return g;
  }

  // spawn the next pattern starting at world z0 (negative = ahead)
  _spawnPattern(z0, d) {
    const r = this.rng;
    const lanesX = () => (r() * 2 - 1) * (HALF - 1.2);
    let len = 30;
    const roll = r();
    const n = this.patternCount++;
    let type;
    if (n < 2) type = n === 0 ? 'crystalLine' : 'scatter';
    else if (roll < 0.17) type = 'scatter';
    else if (roll < 0.32) type = 'gate';
    else if (roll < 0.45) type = 'slalom';
    else if (roll < 0.56 && d > 0.08) type = 'sliders';
    else if (roll < 0.67) type = 'low';
    else if (roll < 0.8 && d > 0.05) type = 'corridor';
    else if (roll < 0.9) type = 'crystalLine';
    else type = 'orbField';

    switch (type) {
      case 'scatter': {
        const k = 2 + Math.floor(r() * (2 + d * 3));
        for (let i = 0; i < k; i++) {
          const g = this._group('block');
          const hw = 0.7 + r() * (0.6 + d * 0.8);
          this._block(g, lanesX(), 0.8, z0 - i * (8 + r() * 6), hw, 0.8, 0.8);
        }
        len = k * 11;
        this._pickup('crystal', lanesX(), 1.0, z0 - len * 0.5);
        break;
      }
      case 'gate': {
        const g = this._group('gate');
        const gap = Math.max(2.5, 3.6 - d * 1.0);
        const gx = (r() * 2 - 1) * (HALF - gap / 2 - 0.4);
        const leftW = (gx - gap / 2) - (-HALF - 0.4);
        const rightW = (HALF + 0.4) - (gx + gap / 2);
        if (leftW > 0.1) this._block(g, -HALF - 0.4 + leftW / 2, 1.0, z0, leftW / 2, 1.0, 0.5);
        if (rightW > 0.1) this._block(g, gx + gap / 2 + rightW / 2, 1.0, z0, rightW / 2, 1.0, 0.5);
        this._pickup('crystal', gx, 1.0, z0);
        len = 20;
        break;
      }
      case 'slalom': {
        const k = 4 + Math.floor(r() * 3);
        const s0 = r() < 0.5 ? -1 : 1;
        for (let i = 0; i < k; i++) {
          const s = i % 2 ? -s0 : s0;
          const g = this._group('block');
          this._block(g, s * 3.3, 0.9, z0 - i * 11, 2.2, 0.9, 0.7);
          if (i % 2 === 0) this._pickup(i === 2 ? 'crystal' : 'orb', -s * 3.5, 0.9, z0 - i * 11);
        }
        len = k * 11 + 6;
        break;
      }
      case 'sliders': {
        const k = 2 + Math.floor(r() * 2);
        for (let i = 0; i < k; i++) {
          const g = this._group('block');
          const A = HALF - 1.6;
          this._block(g, 0, 0.8, z0 - i * 16, 1.1 + d * 0.5, 0.8, 0.8, {
            slider: { A, w: 1.4 + r() * 1.2 + d, ph: r() * Math.PI * 2 },
          });
        }
        this._pickup('crystal', lanesX(), 1.0, z0 - k * 8);
        len = k * 16 + 4;
        break;
      }
      case 'low': {
        const g = this._group('low');
        this._block(g, 0, 0.42, z0, HALF + 0.4, 0.42, 0.35);
        this._pickup('crystal', lanesX() * 0.5, 2.6, z0);
        len = 22;
        break;
      }
      case 'corridor': {
        const gap = Math.max(2.4, 3.0 - d * 0.5);
        const cx = (r() * 2 - 1) * (HALF - gap / 2 - 1.2);
        const hd = 6;
        const lw = 1.2, g1 = this._group('corridor'), g2 = this._group('corridor');
        this._block(g1, cx - gap / 2 - lw, 1.0, z0 - hd, lw, 1.0, hd);
        this._block(g2, cx + gap / 2 + lw, 1.0, z0 - hd, lw, 1.0, hd);
        for (let i = 0; i < 4; i++) this._pickup('orb', cx, 0.9, z0 - 2 - i * 3);
        this._pickup('crystal', cx, 1.0, z0 - hd * 2 + 1);
        len = hd * 2 + 10;
        break;
      }
      case 'crystalLine': {
        const x0 = lanesX(), x1 = lanesX();
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          this._pickup(i === 2 ? 'crystal' : 'orb', lerp(x0, x1, t), 0.9, z0 - i * 5);
        }
        len = 28;
        break;
      }
      default: {
        for (let i = 0; i < 8; i++) this._pickup(i === 0 ? 'crystal' : 'orb', lanesX(), 0.9, z0 - r() * 30);
        const g = this._group('block');
        this._block(g, lanesX(), 0.8, z0 - 15, 0.9, 0.8, 0.8);
        len = 32;
      }
    }
    return len;
  }

  // Called each frame. `run` provides ship state and event callbacks.
  update(dt, move, run) {
    const d = Math.min(1, run.dist / 4500);
    // spawn ahead
    while (this.nextAt < run.dist + SPAWN_AHEAD) {
      const z0 = -(this.nextAt - run.dist);
      const len = this._spawnPattern(z0, d);
      const gap = lerp(26, 13, d) + this.rng() * 8;
      this.nextAt += len + gap;
    }

    const px = run.px, py = run.py;
    const magnetR = run.mods.magnet;
    const pickR = 1.15 + magnetR * 0.4;

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      const prevZ = o.z;
      o.z += move;

      if (o.kind === 'block') {
        if (o.slider) {
          o.slider.ph += dt * o.slider.w * run.timeScale;
          o.x = Math.sin(o.slider.ph) * o.slider.A;
        }
        const g = o.group;
        // collision
        if (!g.hit && Math.abs(px - o.x) < o.hw + SW && Math.abs(py - o.y) < o.hh + SH && Math.abs(o.z) < o.hd + SD) {
          if (run.invuln > 0) {
            if (run.dashing && run.mods.phase) g.phased = true;
          } else {
            g.hit = true;
            run.onHit(o);
          }
        }
        // passed the ship: check near-miss once per group
        const back = o.z - o.hd;
        const prevBack = prevZ - o.hd;
        if (!g.done && prevBack < SD && back >= SD) {
          g.done = true;
          if (!g.hit) {
            let gap = Infinity;
            for (const p of g.pieces) {
              const dx = Math.max(0, Math.abs(px - p.x) - p.hw - SW);
              const dy = Math.max(0, Math.abs(py - p.y) - p.hh - SH);
              gap = Math.min(gap, Math.hypot(dx, dy));
            }
            if (g.type === 'low') run.onJumpBar();
            else if (g.phased) run.onNearMiss(o, 0, true);
            else if (gap < run.nearDist) run.onNearMiss(o, gap, false);
          }
        }
        o.mesh.position.set(o.x, o.y, o.z);
        if (o.z - o.hd > 14) { this._release(o); this.objects.splice(i, 1); }
      } else {
        o.spin += dt * 3;
        // magnet pull
        if (magnetR > 0 && o.z > -6 - magnetR * 4 && o.z < 2) {
          o.x += (px - o.x) * Math.min(1, dt * 4 * magnetR);
          o.y += (py - o.y) * Math.min(1, dt * 3 * magnetR);
        }
        o.mesh.position.set(o.x, o.y + Math.sin(o.spin) * 0.15, o.z);
        o.mesh.rotation.set(o.spin * 0.5, o.spin, 0);
        if (Math.abs(o.z) < pickR && Math.abs(px - o.x) < pickR && Math.abs(py - o.y) < 1.6) {
          if (o.kind === 'crystal') run.onCrystal(o); else run.onOrb(o);
          this._release(o); this.objects.splice(i, 1);
          continue;
        }
        if (o.z > 14) { this._release(o); this.objects.splice(i, 1); }
      }
    }
  }
}
