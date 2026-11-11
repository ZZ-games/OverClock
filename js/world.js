// Renderer, post-processing and the neon environment
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TUNING } from './config.js';

export const THEMES = {
  neon: {
    name: 'Neon City', sky: 0x0a0018, fog: 0x1a0033, grid: 0xff2bd6, grid2: 0x5a1a8a,
    rail: 0x00e5ff, sunA: 0xffd319, sunB: 0xff2975, tower: 0x14052a, towerGlow: 0xff2bd6,
    obstacle: 0xff2bd6, obstacleBody: 0x2a0438, crystal: 0x00ffd0, orb: 0xffd319,
  },
  sunset: {
    name: 'Synth Sunset', sky: 0x1a0410, fog: 0x3a0a1a, grid: 0xff7a00, grid2: 0x6a1a3a,
    rail: 0xffd319, sunA: 0xfff07a, sunB: 0xff3a1a, tower: 0x200814, towerGlow: 0xff7a00,
    obstacle: 0xffb300, obstacleBody: 0x3a1400, crystal: 0x7affea, orb: 0xff4fd8,
  },
  ice: {
    name: 'Ice Void', sky: 0x020818, fog: 0x0a1a33, grid: 0x6ad8ff, grid2: 0x1a3a6a,
    rail: 0xffffff, sunA: 0xe8faff, sunB: 0x4aa8ff, tower: 0x061226, towerGlow: 0x6ad8ff,
    obstacle: 0xa8f0ff, obstacleBody: 0x0a2440, crystal: 0xff7ae0, orb: 0xffffff,
  },
  toxic: {
    name: 'Toxic Zone', sky: 0x020a04, fog: 0x0a1f0a, grid: 0x7aff1a, grid2: 0x1a4a1a,
    rail: 0xe6ff00, sunA: 0xf2ff7a, sunB: 0x2aff5a, tower: 0x061406, towerGlow: 0x7aff1a,
    obstacle: 0xe6ff00, obstacleBody: 0x1a2a00, crystal: 0xff3af2, orb: 0x00e5ff,
  },
};

const FLOOR_VERT = /* glsl */`
varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FLOOR_FRAG = /* glsl */`
uniform float uOffset;
uniform float uHalf;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uFog;
uniform float uPulse;
varying vec3 vW;
void main() {
  float onTrack = step(abs(vW.x), uHalf);
  vec2 coord = vec2(vW.x / (onTrack > 0.5 ? 1.75 : 3.5), (uOffset - vW.z) / 4.0);
  vec2 g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  float edge = smoothstep(0.35, 0.0, abs(abs(vW.x) - uHalf));
  vec3 base = mix(vec3(0.01, 0.0, 0.03), vec3(0.04, 0.0, 0.08), onTrack);
  vec3 lineCol = mix(uColB, uColA, onTrack) * (onTrack > 0.5 ? 1.1 + uPulse : 0.7);
  vec3 col = base + line * lineCol + edge * uColA * 1.6;
  float d = -vW.z;
  float fogF = smoothstep(30.0, 300.0, d);
  col = mix(col, uFog, fogF);
  gl_FragColor = vec4(col, 1.0);
}`;

const TOWER_VERT = /* glsl */`
varying vec3 vW;
varying vec3 vL;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vL = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const TOWER_FRAG = /* glsl */`
uniform vec3 uBase;
uniform vec3 uGlow;
uniform vec3 uFog;
varying vec3 vW;
varying vec3 vL;
void main() {
  float stripe = step(0.86, fract(vW.y / 2.2));
  float win = step(0.5, fract(vW.x * 0.7 + vW.z * 0.7)) * stripe;
  float top = step(0.485, vL.y);
  float vEdge = step(0.47, abs(vL.x)) * step(0.47, abs(vL.z));
  vec3 col = uBase + uGlow * (win * 0.35 + top * 1.4 + vEdge * 0.9);
  float d = -vW.z;
  col = mix(col, uFog, smoothstep(60.0, 420.0, d));
  gl_FragColor = vec4(col, 1.0);
}`;

const SUN_FRAG = /* glsl */`
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);
  if (r > 0.5) discard;
  float y = vUv.y;
  vec3 col = mix(uB, uA, smoothstep(0.1, 0.9, y));
  float bands = step(0.5, fract((y + uTime * 0.02) * 18.0 - 0.0));
  float cut = (y < 0.45) ? bands * smoothstep(0.45, 0.05, y) : 0.0;
  if (cut > 0.5) discard;
  float glow = smoothstep(0.5, 0.35, r);
  gl_FragColor = vec4(col * (0.9 + glow * 0.4), 1.0);
}`;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    scene.fog = new THREE.Fog(0x1a0033, 40, 380);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1400);
    camera.position.set(0, 3.2, 7.5);
    this.camera = camera;

    scene.add(new THREE.HemisphereLight(0xb0a0ff, 0x200030, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(4, 10, 6);
    scene.add(dir);

    this._buildFloor();
    this._buildRails();
    this._buildTowers();
    this._buildSun();
    this._buildStars();

    // post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.9, 0.45, 0.55);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.bloom = bloom;

    this.time = 0;
    this.shake = 0;
    this.camX = 0;
    this.baseFov = 68;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w / 2, h / 2);
    this.camera.aspect = w / h;
    // keep the track visible on tall (portrait) screens
    this.portraitBoost = w < h ? 18 : 0;
    this.camera.updateProjectionMatrix();
  }

  _buildFloor() {
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uOffset: { value: 0 }, uHalf: { value: TUNING.HALF_WIDTH + 0.4 },
        uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() },
        uFog: { value: new THREE.Color() }, uPulse: { value: 0 },
      },
      vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 700), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -320;
    this.scene.add(floor);
  }

  _buildRails() {
    this.railMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const geo = new THREE.BoxGeometry(0.16, 0.16, 700);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(geo, this.railMat);
      r.position.set(s * (TUNING.HALF_WIDTH + 0.4), 0.12, -320);
      this.scene.add(r);
    }
  }

  _buildTowers() {
    const N = 150;
    this.towerMat = new THREE.ShaderMaterial({
      uniforms: { uBase: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uFog: { value: new THREE.Color() } },
      vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG,
    });
    this.towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.towerMat, N);
    this.towers.frustumCulled = false;
    this.towerData = [];
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1;
      const w = 3 + Math.random() * 6;
      this.towerData.push({
        x: side * (14 + Math.random() * 70), z: -Math.random() * 560 + 30,
        w, d: 3 + Math.random() * 6, h: 6 + Math.pow(Math.random(), 1.6) * 70,
      });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.scene.add(this.towers);
    this._updateTowers(0);
  }

  _updateTowers(move) {
    for (let i = 0; i < this.towerData.length; i++) {
      const t = this.towerData[i];
      t.z += move;
      if (t.z > 40) { t.z -= 580; t.h = 6 + Math.pow(Math.random(), 1.6) * 70; }
      this._p.set(t.x, t.h / 2, t.z);
      this._s.set(t.w, t.h, t.d);
      this._m.compose(this._p, this._q, this._s);
      this.towers.setMatrixAt(i, this._m);
    }
    this.towers.instanceMatrix.needsUpdate = true;
  }

  _buildSun() {
    this.sunMat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: SUN_FRAG, depthWrite: false, fog: false,
    });
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.sunMat);
    sun.position.set(0, 55, -620);
    sun.renderOrder = -1;
    this.sun = sun;
    this.scene.add(sun);
  }

  _buildStars() {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI - Math.PI;
      const e = Math.random() * 0.9 + 0.05;
      const r = 700;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r * 1.4;
      pos[i * 3 + 1] = Math.sin(e) * r * 0.6 + 20;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    this.scene.add(this.stars);
  }

  setTheme(key) {
    const t = THEMES[key] || THEMES.neon;
    this.theme = t;
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog.color.set(t.fog);
    const u = this.floorMat.uniforms;
    u.uColA.value.set(t.grid); u.uColB.value.set(t.grid2); u.uFog.value.set(t.fog);
    this.railMat.color.set(t.rail);
    this.towerMat.uniforms.uBase.value.set(t.tower);
    this.towerMat.uniforms.uGlow.value.set(t.towerGlow);
    this.towerMat.uniforms.uFog.value.set(t.fog);
    this.sunMat.uniforms.uA.value.set(t.sunA);
    this.sunMat.uniforms.uB.value.set(t.sunB);
    return t;
  }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a); }

  // dist: distance travelled, move: metres moved this frame
  update(dt, dist, move, speedFactor, shipX, shipY, pulse = 0) {
    this.time += dt;
    this.floorMat.uniforms.uOffset.value = dist;
    this.floorMat.uniforms.uPulse.value = pulse;
    this.sunMat.uniforms.uTime.value = this.time;
    this._updateTowers(move);

    // camera follow
    this.camX += (shipX * 0.65 - this.camX) * Math.min(1, dt * 6);
    const sx = (Math.random() - 0.5) * this.shake * 0.6;
    const sy = (Math.random() - 0.5) * this.shake * 0.6;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const cam = this.camera;
    cam.position.set(this.camX + sx, 3.1 + shipY * 0.35 + sy, 7.6 - speedFactor * 0.8);
    cam.lookAt(this.camX * 0.9, 1.0 + shipY * 0.25, -14);
    cam.rotation.z += -(shipX - this.camX) * 0.01;
    const fov = this.baseFov + speedFactor * 16 + (this.portraitBoost || 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  }

  render() { this.composer.render(); }
}
