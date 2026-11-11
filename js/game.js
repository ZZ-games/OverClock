// Game state machine and the run itself
import { TUNING } from './config.js';
import { World } from './world.js';
import { buildShip, Trail } from './ship.js';
import { Track } from './track.js';
import { Particles, SpeedLines } from './fx.js';
import { Audio } from './audio.js';
import { Ads } from './ads.js';
import { UI } from './ui.js';
import { Save } from './save.js';
import { Progression } from './progression.js';
import { UPGRADES, defaultMods, rollChoices } from './upgrades.js';
import { clamp } from './util.js';

const HALF = TUNING.HALF_WIDTH;
const GHOST_STEP = 0.25;

export class Game {
  constructor(canvas) {
    this.world = new World(canvas);
    this.track = new Track(this.world.scene);
    this.particles = new Particles(this.world.scene);
    this.speedLines = new SpeedLines(this.world.scene);
    this.trail = new Trail(this.world.scene);
    this.keys = {};
    this.touch = { left: false, right: false };
    this.state = 'menu';
    this.menuDist = 0;
    this.ship = null;
    this.ghost = null;
    this.applyCosmetics();
    this.bindInput();
    this.bindButtons();
    this.last = performance.now();
    this.clockTickAt = 0;
    this.goMenu();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------- cosmetics ----------------
  applyCosmetics() {
    const sel = Save.data.selected;
    const theme = this.world.setTheme(sel.world);
    this.track.setTheme(theme);
    this.theme = theme;
    if (this.ship) this.world.scene.remove(this.ship);
    this.ship = buildShip(sel.ship);
    this.world.scene.add(this.ship);
    if (this.ghost) this.world.scene.remove(this.ghost);
    this.ghost = buildShip(sel.ship, { ghost: true });
    this.ghost.visible = false;
    this.world.scene.add(this.ghost);
    this.trail.setStyle(sel.trail);
  }

  // ---------------- input ----------------
  bindInput() {
    const map = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;
    window.addEventListener('keydown', (e) => {
      Audio.resume();
      const k = map(e);
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
      if (document.getElementById('adOverlay').classList.contains('hidden') === false) return;
      if (this.keys[k] && e.repeat) return;
      this.keys[k] = true;
      this.onKey(k, e);
    });
    window.addEventListener('keyup', (e) => { this.keys[map(e)] = false; });
    window.addEventListener('blur', () => { this.keys = {}; if (this.state === 'run') this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'run') this.pause(); });

    // touch fallback: hold left/right half to steer, swipe up to jump, two fingers to dash
    const canvas = this.world.canvas;
    let startY = 0;
    const upd = (e) => {
      this.touch.left = this.touch.right = false;
      for (const t of e.touches) {
        if (t.clientX < window.innerWidth / 2) this.touch.left = true; else this.touch.right = true;
      }
    };
    canvas.addEventListener('touchstart', (e) => {
      Audio.resume();
      if (e.touches.length >= 2 && this.state === 'run') this.dash();
      startY = e.touches[0].clientY;
      upd(e);
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (this.state === 'run' && startY - e.touches[0].clientY > 60) { this.jump(); startY = -9999; }
    }, { passive: true });
    canvas.addEventListener('touchend', upd, { passive: true });
    window.addEventListener('pointerdown', () => Audio.resume());
  }

  lock(ms) { this.lockUntil = performance.now() + ms; }

  onKey(k, e) {
    if (k === 'm') { this.toggleMute(); return; }
    if (this.state !== 'run' && performance.now() < (this.lockUntil || 0)) return;
    switch (this.state) {
      case 'menu':
        if (k === 'Enter' || k === ' ') this.startRun('normal');
        else if (k === 'd') this.startRun('daily');
        else if (k === 'c') this.claimCalendar();
        else if (k === 'b') this.openCrate();
        else if (k === 's') this.cycle('ships', 'ship');
        else if (k === 'w') this.cycle('worlds', 'world');
        else if (k === 't') this.cycle('trails', 'trail');
        break;
      case 'run':
        if (k === ' ' || k === 'ArrowUp' || k === 'w') this.jump();
        else if (k === 'Shift' || k === 'ArrowDown' || k === 's') this.dash();
        else if (k === 'p' || k === 'Escape') this.pause();
        else if (k === 'r') this.startRun(this.run.mode);
        break;
      case 'upgrade':
        if (k === '1' || k === '2' || k === '3') this.chooseUpgrade(Number(k) - 1);
        else if (k === 'ArrowLeft' || k === 'a') this.focusUpgrade(-1);
        else if (k === 'ArrowRight' || k === 'd') this.focusUpgrade(1);
        else if (k === 'Enter' || k === ' ') this.chooseUpgrade(this.upgFocus);
        else if (k === 'q') this.rerollUpgrades();
        break;
      case 'continue':
        if (k === 'c') this.acceptContinue();
        else if (k === ' ' || k === 'Escape' || k === 'n') this.declineContinue();
        break;
      case 'results':
        if (k === ' ' || k === 'Enter' || k === 'r') this.startRun(this.run.mode);
        else if (k === 'x') this.doubleXp();
        else if (k === 'Escape') this.goMenu();
        break;
      case 'paused':
        if (k === 'p' || k === 'Escape' || k === 'Enter') this.resume();
        else if (k === 'q') this.goMenu();
        break;
    }
  }

  bindButtons() {
    const on = (id, fn) => UI.$(id).addEventListener('click', (e) => { e.preventDefault(); Audio.resume(); Audio.ui(); fn(); });
    on('btnPlay', () => this.startRun('normal'));
    on('btnDaily', () => this.startRun('daily'));
    on('btnClaim', () => this.claimCalendar());
    on('btnCrate', () => this.openCrate());
    on('gShip', () => this.cycle('ships', 'ship'));
    on('gWorld', () => this.cycle('worlds', 'world'));
    on('gTrail', () => this.cycle('trails', 'trail'));
    on('btnReroll', () => this.rerollUpgrades());
    on('btnContinue', () => this.acceptContinue());
    on('btnNoContinue', () => this.declineContinue());
    on('btnAgain', () => this.startRun(this.run.mode));
    on('btnMenu', () => this.goMenu());
    on('btnDouble', () => this.doubleXp());
    on('btnResume', () => this.resume());
    on('btnQuit', () => this.goMenu());
    on('muteBtn', () => this.toggleMute());
    UI.$('upgradeCards').addEventListener('click', (e) => {
      const c = e.target.closest('.card');
      if (c) this.chooseUpgrade(Number(c.dataset.i));
    });
  }

  toggleMute() {
    Save.data.settings.muted = !Save.data.settings.muted;
    Save.save();
    Audio.setMuted(Save.data.settings.muted);
    UI.$('muteBtn').textContent = Save.data.settings.muted ? '🔇' : '🔊';
  }

  // ---------------- menu actions ----------------
  goMenu() {
    this.state = 'menu';
    this.track.clear();
    this.ghost.visible = false;
    UI.renderMenu();
    UI.show('menu');
    Audio.setIntensity(0);
    Audio.startMusic();
  }

  cycle(type, key) {
    if (Save.data.owned[type].length < 2) { UI.toast('Level up to unlock more!'); return; }
    Progression.cycle(type, key);
    this.applyCosmetics();
    UI.renderMenu();
    Audio.ui();
  }

  claimCalendar() {
    const r = Progression.claimCalendar();
    if (!r) return;
    Audio.claim();
    UI.toast(`Daily reward: +${r.xp} XP`);
    this.announceLevels(r.events);
    UI.renderMenu();
  }

  async openCrate() {
    if (Progression.cratesLeft() <= 0) return;
    const ok = await Ads.showRewarded('bonus_crate');
    if (!ok) { UI.toast('No ad available right now'); return; }
    const r = Progression.openCrate();
    if (!r) return;
    Audio.claim();
    UI.toast(`Bonus crate: +${r.xp} XP`);
    this.announceLevels(r.events);
    UI.renderMenu();
  }

  announceLevels(events) {
    for (const e of events) {
      Audio.levelUp();
      this.applyCosmetics();
      UI.toast(`LEVEL ${e.level}!`);
    }
  }

  // ---------------- run ----------------
  startRun(mode) {
    Progression.refresh();
    const seed = mode === 'daily' ? Progression.dailySeed() : (Math.random() * 1e9) | 0;
    this.track.reset(seed);
    const mods = defaultMods();
    const d = Save.data;
    this.run = {
      mode, seed, t: 0, clock: TUNING.START_CLOCK, speed: TUNING.BASE_SPEED,
      combo: 0, mult: 1, comboTimer: 0,
      stats: { score: 0, distance: 0, nearMisses: 0, crystals: 0, jumpBars: 0, maxMult: 1, upgrades: 0, bestClean: 0 },
      get dist() { return this.stats.distance; },
      mods, levels: {}, nextUpgradeAt: TUNING.UPGRADE_FIRST,
      px: 0, vx: 0, py: TUNING.HOVER_Y, vy: 0, jumpsLeft: 0, grounded: true,
      dashCd: 0, dashCdMax: TUNING.DASH_COOLDOWN, dashT: 0, dashing: false, invuln: 0,
      slowmo: 0, timeScale: 1, shields: 0, continued: false, rerolled: false, doubled: false,
      cleanFrom: 0, recordState: 0, completedMissions: [],
      ghostRec: [], ghostStep: GHOST_STEP, ghostTimer: 0,
      nearDist: TUNING.NEAR_DIST, orbCount: 0, crystalCount: 0,
    };
    const run = this.run;
    run.onHit = (o) => this.onHit(o);
    run.onNearMiss = (o, gap, phased) => this.onNearMiss(o, gap, phased);
    run.onJumpBar = () => this.onJumpBar();
    run.onCrystal = (o) => this.onCrystal(o);
    run.onOrb = (o) => this.onOrb(o);

    this.ghostData = mode === 'normal' && d.ghost && d.ghost.samples ? d.ghost : null;
    this.ghost.visible = false;
    this.trail.reset(0, TUNING.HOVER_Y);
    UI.resetHud();
    UI.hudUpgrades(run.levels);
    UI.show('hud');
    if (mode === 'daily') UI.toast(`Daily track · target ${Progression.dailyTarget().toLocaleString('en-US')}`);
    this.state = 'run';
    Audio.startMusic();
    this.clockTickAt = 5;
  }

  jump() {
    const r = this.run;
    if (r.grounded) { r.vy = TUNING.JUMP_V; r.grounded = false; r.jumpsLeft = r.mods.extraJumps; Audio.jump(); }
    else if (r.jumpsLeft > 0) { r.vy = TUNING.JUMP_V * 0.9; r.jumpsLeft -= 1; Audio.jump(); this.particles.burst(r.px, r.py, 0.5, this.ship.userData.accent, 14, 5, 0.4); }
  }

  dash() {
    const r = this.run;
    if (r.dashCd > 0) return;
    const dir = this.steerDir();
    r.dashT = TUNING.DASH_TIME * r.mods.dashTime;
    r.dashCdMax = TUNING.DASH_COOLDOWN * r.mods.dashCd;
    r.dashCd = r.dashCdMax;
    r.invuln = Math.max(r.invuln, r.dashT);
    r.dashing = true;
    if (dir) r.vx = dir * 32;
    Audio.dash();
    this.world.addShake(0.15);
    this.particles.burst(r.px, r.py, 0.6, this.trail.color, 18, 6, 0.4);
  }

  steerDir() {
    const k = this.keys;
    const left = k.ArrowLeft || k.a || this.touch.left;
    const right = k.ArrowRight || k.d || this.touch.right;
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  addTime(s) {
    const r = this.run;
    r.clock = Math.min(TUNING.MAX_CLOCK, r.clock + s);
    UI.clockGain(s);
  }

  onNearMiss(o, gap, phased) {
    const r = this.run;
    r.stats.nearMisses += 1;
    r.combo += 1;
    r.comboTimer = TUNING.COMBO_DECAY + r.mods.comboDecay;
    this.addTime(TUNING.NEAR_MISS_TIME + r.mods.nearTime);
    if (r.mods.bullet > 0) r.slowmo = Math.max(r.slowmo, r.mods.bullet);
    const close = gap < 0.3;
    const words = phased ? 'PHASED!' : close ? 'INSANE!' : r.combo % 5 === 0 ? 'ON FIRE!' : 'CLOSE!';
    UI.popup(words, close || phased ? '#ffd319' : '#00e5ff', close ? 38 : 30);
    Audio.near(r.combo);
    this.world.addShake(0.08);
    this.particles.burst(o.x > r.px ? r.px + 0.8 : r.px - 0.8, r.py, 0, close ? 0xffd319 : 0x00e5ff, 20, 7, 0.5);
    this.pulse = 1;
  }

  onJumpBar() {
    const r = this.run;
    r.stats.jumpBars += 1;
    r.stats.nearMisses += 1;
    r.combo += 1;
    r.comboTimer = TUNING.COMBO_DECAY + r.mods.comboDecay;
    this.addTime(TUNING.NEAR_MISS_TIME + r.mods.nearTime);
    UI.popup('AIR TIME!', '#ff2bd6');
    Audio.near(r.combo);
    this.pulse = 1;
  }

  onCrystal(o) {
    const r = this.run;
    r.stats.crystals += 1;
    r.crystalCount += 1;
    this.addTime(TUNING.CRYSTAL_TIME + r.mods.crystalTime);
    Audio.crystal(r.crystalCount);
    this.particles.burst(o.x, o.y, o.z, this.theme.crystal, 26, 7, 0.6);
  }

  onOrb(o) {
    const r = this.run;
    r.orbCount += 1;
    r.stats.score += 50 * r.mult;
    Audio.orb(r.orbCount);
    this.particles.burst(o.x, o.y, o.z, this.theme.orb, 8, 4, 0.35);
  }

  onHit(o) {
    const r = this.run;
    if (r.shields > 0) {
      r.shields -= 1;
      r.invuln = 1.0;
      Audio.shieldBreak();
      UI.popup('SHIELD!', '#6dffb0');
      this.particles.burst(r.px, r.py, 0, 0x6dffb0, 40, 9, 0.6);
      this.world.addShake(0.3);
      return;
    }
    this.addTime(-r.mods.hitPenalty);
    r.combo = 0;
    r.invuln = 1.0;
    r.vx = (r.px >= o.x ? 1 : -1) * 10;
    r.cleanFrom = r.stats.distance;
    Audio.hit();
    UI.popup('CRASH', '#ff3355', 34);
    this.world.addShake(0.8);
    this.particles.burst(r.px, r.py, -0.5, 0xff3355, 50, 10, 0.8);
  }

  // ---------------- upgrades ----------------
  openUpgrades() {
    const r = this.run;
    this.state = 'upgrade';
    this.upgChoices = rollChoices(r.levels);
    if (!this.upgChoices.length) { this.state = 'run'; return; }
    this.upgFocus = 0;
    UI.renderUpgrades(this.upgChoices, r.levels, 0, !r.rerolled);
    UI.show('hud', 'upgrade');
    this.lock(450);
    Audio.upgrade();
  }

  focusUpgrade(d) {
    this.upgFocus = (this.upgFocus + d + this.upgChoices.length) % this.upgChoices.length;
    UI.renderUpgrades(this.upgChoices, this.run.levels, this.upgFocus, !this.run.rerolled);
    Audio.ui();
  }

  chooseUpgrade(i) {
    if (this.state !== 'upgrade') return;
    const u = this.upgChoices[i];
    if (!u) return;
    const r = this.run;
    r.levels[u.id] = (r.levels[u.id] || 0) + 1;
    u.apply(r.mods, r);
    r.nearDist = TUNING.NEAR_DIST + r.mods.nearDist;
    r.stats.upgrades += 1;
    UI.hudUpgrades(r.levels);
    UI.toast(`${u.icon} ${u.name}`);
    Audio.claim();
    this.state = 'run';
    UI.show('hud');
    r.invuln = Math.max(r.invuln, 0.6); // brief grace after the pause
  }

  async rerollUpgrades() {
    const r = this.run;
    if (this.state !== 'upgrade' || r.rerolled) return;
    const ok = await Ads.showRewarded('upgrade_reroll');
    if (!ok) { UI.toast('No ad available right now'); return; }
    r.rerolled = true;
    this.upgChoices = rollChoices(r.levels, Math.random, this.upgChoices.map((u) => u.id));
    this.upgFocus = 0;
    UI.renderUpgrades(this.upgChoices, r.levels, 0, false);
  }

  // ---------------- continue / end ----------------
  outOfTime() {
    const r = this.run;
    r.clock = 0;
    if (!r.continued) {
      this.state = 'continue';
      this.continueT = 6;
      UI.show('hud', 'continue');
      this.lock(700);
      Audio.setIntensity(0);
    } else {
      this.endRun();
    }
  }

  async acceptContinue() {
    if (this.state !== 'continue') return;
    this.state = 'continueAd';
    const ok = await Ads.showRewarded('second_chance');
    const r = this.run;
    if (ok) {
      r.continued = true;
      r.clock = TUNING.CONTINUE_TIME;
      r.invuln = 2;
      UI.clockGain(TUNING.CONTINUE_TIME);
      this.state = 'run';
      UI.show('hud');
    } else {
      UI.toast('No ad available right now');
      this.endRun();
    }
  }

  declineContinue() {
    if (this.state !== 'continue') return;
    this.endRun();
  }

  endRun() {
    const r = this.run;
    r.stats.bestClean = Math.max(r.stats.bestClean, r.stats.distance - r.cleanFrom);
    this.state = 'results';
    Audio.gameOver();
    Audio.setIntensity(0);
    this.result = Progression.finishRun(r);
    UI.renderResults(r, this.result);
    UI.$('btnDouble').disabled = false;
    UI.show('results');
    this.lock(900);
    if (this.result.events.length) setTimeout(() => Audio.levelUp(), 500);
    this.applyCosmetics();
  }

  async doubleXp() {
    const r = this.run;
    if (this.state !== 'results' || r.doubled) return;
    const ok = await Ads.showRewarded('double_xp');
    if (!ok) { UI.toast('No ad available right now'); return; }
    r.doubled = true;
    const extra = this.result.total;
    const events = Progression.addXp(extra);
    this.result.lines.push(['Double XP (ad)', extra]);
    this.result.total += extra;
    this.result.events.push(...events);
    UI.renderXp(this.result);
    UI.$('btnDouble').disabled = true;
    Audio.claim();
    if (events.length) Audio.levelUp();
    this.applyCosmetics();
  }

  pause() {
    if (this.state !== 'run') return;
    this.state = 'paused';
    UI.show('hud', 'pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'run';
    UI.show('hud');
    this.last = performance.now();
  }

  // ---------------- frame ----------------
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.pulse = Math.max(0, (this.pulse || 0) - dt * 3);

    if (this.state === 'run') this.updateRun(dt);
    else if (this.state === 'menu') this.updateMenu(dt);
    else {
      if (this.state === 'continue') {
        this.continueT -= dt;
        UI.$('continueFill').style.width = `${Math.max(0, this.continueT / 6) * 100}%`;
        if (this.continueT <= 0) this.declineContinue();
      }
      // frozen world, keep rendering
      this.world.update(dt, this.run ? this.run.stats.distance : this.menuDist, 0, 0, this.ship.position.x, this.ship.position.y - TUNING.HOVER_Y, this.pulse);
      this.particles.update(dt, 0);
    }
    this.world.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  updateMenu(dt) {
    const speed = 16;
    const move = speed * dt;
    this.menuDist += move;
    const t = this.world.time;
    const x = Math.sin(t * 0.6) * 3;
    this.ship.position.set(x, TUNING.HOVER_Y + Math.sin(t * 2) * 0.08, 0);
    this.ship.rotation.set(0, 0, -Math.cos(t * 0.6) * 0.35);
    this.trail.update(dt, move, x, TUNING.HOVER_Y, 0.9, 0.7);
    this.particles.update(dt, move);
    this.speedLines.update(dt, move, 0.15, this.trail.color);
    this.world.update(dt, this.menuDist, move, 0, x, 0, 0);
  }

  updateRun(rdt) {
    const r = this.run;
    r.slowmo = Math.max(0, r.slowmo - rdt);
    r.timeScale = r.slowmo > 0 ? 0.45 : 1;
    const dt = rdt * r.timeScale;
    r.t += dt;

    // speed ramps with distance
    const sf = 1 - Math.exp(-r.stats.distance / TUNING.SPEED_DIST);
    r.speed = TUNING.BASE_SPEED + TUNING.MAX_SPEED_ADD * sf;
    const move = r.speed * dt;
    r.stats.distance += move;

    // steering
    const dir = this.steerDir();
    const maxLat = 13 + sf * 5;
    r.dashT = Math.max(0, r.dashT - dt);
    r.dashing = r.dashT > 0;
    if (!r.dashing) r.vx += (dir * maxLat - r.vx) * Math.min(1, rdt * 11);
    r.px += r.vx * dt;
    const lim = HALF - 0.6;
    if (Math.abs(r.px) > lim) { r.px = Math.sign(r.px) * lim; r.vx *= -0.2; }
    r.dashCd = Math.max(0, r.dashCd - rdt);
    r.invuln = Math.max(0, r.invuln - dt);

    // jumping
    if (!r.grounded) {
      r.vy -= TUNING.GRAVITY * dt;
      r.py += r.vy * dt;
      if (r.py <= TUNING.HOVER_Y) { r.py = TUNING.HOVER_Y; r.vy = 0; r.grounded = true; Audio.land(); }
    }

    // clock, combo, multiplier
    r.clock -= dt * r.mods.drain * (1 + r.t / TUNING.DRAIN_RAMP);
    r.comboTimer -= dt;
    if (r.comboTimer <= 0 && r.combo > 0) { r.combo = Math.max(0, r.combo - 3); r.comboTimer = 1.2; }
    const cap = TUNING.MULT_CAP + r.mods.multCap;
    r.mult = Math.min(cap, 1 + r.mods.baseMult + Math.floor(r.combo / 3));
    r.stats.maxMult = Math.max(r.stats.maxMult, r.mult);
    r.stats.score += move * r.mult;
    r.stats.bestClean = Math.max(r.stats.bestClean, r.stats.distance - r.cleanFrom);

    this.track.update(dt, move, r);

    // ghost recording + playback
    r.ghostTimer += dt;
    if (r.ghostTimer >= GHOST_STEP) {
      r.ghostTimer -= GHOST_STEP;
      r.ghostRec.push(Math.round(r.stats.distance * 10) / 10, Math.round(r.px * 100) / 100);
    }
    this.updateGhost(r);

    // record callouts
    const best = Save.data.best.distance;
    if (r.mode === 'normal' && best > 300) {
      if (r.recordState === 0 && r.stats.distance > best - 200) { r.recordState = 1; UI.toast('200 m to beat your best!'); }
      if (r.recordState === 1 && r.stats.distance > best) { r.recordState = 2; UI.toast('🏆 NEW DISTANCE RECORD!'); Audio.record(); }
    }

    // live mission checks (twice a second)
    this._mT = (this._mT || 0) + rdt;
    if (this._mT > 0.5) {
      this._mT = 0;
      for (const m of Progression.checkMissions(r.stats)) {
        r.completedMissions.push(m);
        UI.toast(`✓ Mission: ${m.text}`);
        Audio.claim();
      }
    }

    // ship visuals
    const s = this.ship;
    s.position.set(r.px, r.py + (r.grounded ? Math.sin(this.world.time * 9) * 0.03 : 0), 0);
    s.rotation.set(r.grounded ? 0 : -r.vy * 0.025, -r.vx * 0.012, -r.vx * 0.045);
    s.visible = r.invuln > 0 && !r.dashing ? Math.floor(this.world.time * 20) % 2 === 0 : true;
    const eng = s.userData.engine;
    eng.scale.z = 0.6 + sf * 1.6 + Math.random() * 0.3;

    this.trail.update(dt, move, r.px, r.py, 0.9, r.dashing ? 2.2 : 1);
    this.particles.update(dt, move);
    this.speedLines.update(dt, move, sf + (r.dashing ? 0.6 : 0), this.trail.color);
    this.world.update(rdt, r.stats.distance, move, sf, r.px, r.py - TUNING.HOVER_Y, this.pulse);

    Audio.setIntensity(0.2 + sf * 0.4 + Math.min(0.4, r.mult * 0.05));

    // low-clock ticks
    if (r.clock < this.clockTickAt && r.clock > 0) { Audio.tick(); this.clockTickAt = Math.floor(r.clock); }
    if (r.clock >= 5) this.clockTickAt = 5;

    UI.hud(r);

    if (r.clock <= 0) this.outOfTime();
    else if (r.t >= r.nextUpgradeAt) { r.nextUpgradeAt += TUNING.UPGRADE_EVERY; this.openUpgrades(); }
  }

  updateGhost(r) {
    const g = this.ghostData;
    if (!g) { this.ghost.visible = false; return; }
    const s = g.samples;
    const i = Math.floor(r.t / g.step);
    if (i * 2 + 3 >= s.length) {
      this.ghost.visible = false;
      return;
    }
    const f = (r.t - i * g.step) / g.step;
    const gd = s[i * 2] + (s[i * 2 + 2] - s[i * 2]) * f;
    const gx = s[i * 2 + 1] + (s[i * 2 + 3] - s[i * 2 + 1]) * f;
    const z = -(gd - r.stats.distance);
    this.ghost.visible = z > -160 && z < 6;
    this.ghost.position.set(gx, TUNING.HOVER_Y, z);
    const diff = gd - r.stats.distance;
    UI.$('ghostNote').textContent = Math.abs(diff) < 2 ? 'NECK AND NECK WITH YOUR BEST' : diff > 0 ? `BEST RUN ${Math.round(diff)} m AHEAD` : `${Math.round(-diff)} m AHEAD OF YOUR BEST`;
  }
}
