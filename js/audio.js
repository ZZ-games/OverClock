// Synthesized music and sound effects (Web Audio, no files needed)

const CHORDS = [
  { root: 45, third: 3 }, // A minor
  { root: 41, third: 4 }, // F major
  { root: 48, third: 4 }, // C major
  { root: 43, third: 4 }, // G major
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.intensity = 0;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.42; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(this.master);
    // shared noise buffer
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  duck(on) {
    if (this.master) this.master.gain.setTargetAtTime(on || this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  startMusic() { if (!this.ctx) return; if (!this.playing) { this.playing = true; this.nextTime = this.ctx.currentTime + 0.05; } }
  stopMusic() { this.playing = false; }
  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  _schedule() {
    if (!this.playing || !this.ctx) return;
    const ctx = this.ctx;
    const bpm = 108 + this.intensity * 36;
    const stepDur = 60 / bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this._playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  _playStep(step, t, dur) {
    const s = step % 16;
    const chord = CHORDS[Math.floor(step / 16)];
    const I = this.intensity;
    if (s % 4 === 0) this._kick(t, I > 0.05 ? 0.9 : 0.45);
    if (I > 0.12 && (s === 4 || s === 12)) this._snare(t);
    if (s % 2 === 1) this._hat(t, I > 0.3 ? 0.18 : 0.08);
    if (s % 2 === 0) this._bass(t, mtof(chord.root - 12 + (s % 4 === 2 ? 12 : 0)), dur * 1.8);
    if (I > 0.28) {
      const arp = [0, chord.third, 7, 12, 7, chord.third, 12, 15 + (chord.third === 4 ? 1 : 0)];
      this._lead(t, mtof(chord.root + 12 + arp[s % 8]), dur * 0.9, 0.05 + I * 0.05);
    }
    if (s === 0) this._pad(t, chord, dur * 16);
  }

  _env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  _kick(t, v) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this._env(g, t, 0.003, v, 0.28);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.32);
  }

  _noise(t, dur, type, freq, v, dest) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    this._env(g, t, 0.002, v, dur);
    src.connect(f).connect(g).connect(dest || this.music);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    return f;
  }

  _snare(t) { this._noise(t, 0.16, 'bandpass', 1800, 0.35); }
  _hat(t, v) { this._noise(t, 0.04, 'highpass', 8000, v); }

  _bass(t, freq, dur) {
    const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.setValueAtTime(300 + this.intensity * 900, t); f.Q.value = 6;
    this._env(g, t, 0.005, 0.32, dur);
    o.connect(f).connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }

  _lead(t, freq, dur, v) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    this._env(g, t, 0.004, v, dur);
    o.connect(f).connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }

  _pad(t, chord, dur) {
    for (const iv of [0, chord.third, 7]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = mtof(chord.root + iv);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  _tone(freq, dur, type = 'sine', v = 0.3, delay = 0, slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    this._env(g, t, 0.004, v, dur);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- sound effects ----
  near(level) {
    const f = 660 * Math.pow(2, Math.min(level, 18) / 12);
    this._tone(f, 0.09, 'square', 0.12);
    this._tone(f * 1.5, 0.14, 'sine', 0.18, 0.05);
    if (this.ctx) this._noise(this.ctx.currentTime, 0.18, 'bandpass', 2500, 0.25, this.sfx);
  }
  crystal(n = 0) {
    const base = 880 * Math.pow(2, (n % 8) / 12);
    [0, 4, 7, 12].forEach((iv, i) => this._tone(base * Math.pow(2, iv / 12), 0.12, 'triangle', 0.18, i * 0.035));
  }
  orb(n = 0) { this._tone(1320 * Math.pow(2, (n % 12) / 24), 0.06, 'sine', 0.1); }
  hit() {
    this._tone(220, 0.35, 'sawtooth', 0.3, 0, 50);
    if (this.ctx) this._noise(this.ctx.currentTime, 0.35, 'lowpass', 900, 0.6, this.sfx);
  }
  shieldBreak() { this._tone(900, 0.25, 'triangle', 0.25, 0, 300); }
  dash() { if (this.ctx) { const f = this._noise(this.ctx.currentTime, 0.22, 'bandpass', 600, 0.4, this.sfx); f.frequency.exponentialRampToValueAtTime(4000, this.ctx.currentTime + 0.2); } }
  jump() { this._tone(300, 0.18, 'sine', 0.2, 0, 700); }
  land() { this._tone(160, 0.08, 'sine', 0.15); }
  upgrade() { [0, 4, 7, 11, 14].forEach((iv, i) => this._tone(523 * Math.pow(2, iv / 12), 0.25, 'triangle', 0.16, i * 0.05)); }
  levelUp() { [0, 4, 7, 12, 16, 19, 24].forEach((iv, i) => this._tone(523 * Math.pow(2, iv / 12), 0.3, 'square', 0.1, i * 0.07)); }
  record() { [0, 7, 12, 16, 19, 24].forEach((iv, i) => this._tone(440 * Math.pow(2, iv / 12), 0.35, 'triangle', 0.2, i * 0.09)); }
  tick() { this._tone(1800, 0.03, 'square', 0.1); }
  ui() { this._tone(1000, 0.05, 'sine', 0.12); }
  claim() { [0, 5, 9, 12].forEach((iv, i) => this._tone(660 * Math.pow(2, iv / 12), 0.2, 'triangle', 0.18, i * 0.06)); }
  gameOver() { [12, 7, 3, 0].forEach((iv, i) => this._tone(330 * Math.pow(2, iv / 12), 0.3, 'triangle', 0.2, i * 0.12)); }
}

export const Audio = new AudioEngine();
