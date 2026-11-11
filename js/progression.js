// XP, levels, unlocks, daily rewards, daily missions and the weekly goal
import { Save } from './save.js';
import { CONFIG } from './config.js';
import { dayKey, weekKey, hashStr, mulberry32, fmt } from './util.js';
import { SHIPS, TRAILS } from './ship.js';
import { THEMES } from './world.js';

export const UNLOCKS = {
  2: { type: 'worlds', id: 'sunset' },
  3: { type: 'ships', id: 'viper' },
  4: { type: 'trails', id: 'magenta' },
  5: { type: 'worlds', id: 'ice' },
  6: { type: 'ships', id: 'wing' },
  7: { type: 'trails', id: 'gold' },
  8: { type: 'worlds', id: 'toxic' },
  10: { type: 'ships', id: 'manta' },
  12: { type: 'trails', id: 'white' },
};
export const WEEKLY_TRAIL = 'rainbow';
export const CALENDAR_XP = [50, 75, 100, 150, 200, 250, 500];
export const MISSION_BONUS = 200;
export const DAILY_SEED_DONE_XP = 100;
export const DAILY_SEED_TARGET_XP = 200;
export const WEEKLY_DAYS = 5;

export function unlockName(u) {
  if (!u) return '';
  if (u.type === 'worlds') return `World: ${THEMES[u.id].name}`;
  if (u.type === 'ships') return `Ship: ${SHIPS[u.id].name}`;
  return `Trail: ${TRAILS[u.id].name}`;
}

export const xpForLevel = (lvl) => 100 + 60 * (lvl - 1);

const MISSION_POOL = [
  { id: 'near_run', text: 'Get {n} near-misses in one run', ns: [8, 12, 18], scope: 'run', stat: 'nearMisses' },
  { id: 'dist_run', text: 'Travel {n} m in one run', ns: [1000, 1600, 2500], scope: 'run', stat: 'distance' },
  { id: 'crystals', text: 'Collect {n} time crystals today', ns: [15, 25, 40], scope: 'day', stat: 'crystals' },
  { id: 'mult_run', text: 'Reach a x{n} multiplier', ns: [3, 4, 6], scope: 'run', stat: 'maxMult' },
  { id: 'runs', text: 'Play {n} runs today', ns: [3, 5], scope: 'day', stat: 'runs' },
  { id: 'jumps_run', text: 'Clear {n} jump bars in one run', ns: [3, 5, 8], scope: 'run', stat: 'jumpBars' },
  { id: 'clean_run', text: 'Go {n} m without crashing', ns: [400, 700, 1000], scope: 'run', stat: 'bestClean' },
  { id: 'upg_run', text: 'Pick {n} upgrades in one run', ns: [3, 4, 5], scope: 'run', stat: 'upgrades' },
  { id: 'score_run', text: 'Score {n} in one run', ns: [5000, 10000, 20000], scope: 'run', stat: 'score' },
  { id: 'near_day', text: 'Get {n} near-misses today', ns: [30, 50, 80], scope: 'day', stat: 'nearMisses' },
];

function genMissions(key) {
  const rng = mulberry32(hashStr('missions' + key));
  const pool = MISSION_POOL.slice();
  const out = [];
  while (out.length < 3) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const tier = Math.floor(rng() * m.ns.length);
    out.push({ id: m.id, scope: m.scope, stat: m.stat, n: m.ns[tier], text: m.text.replace('{n}', fmt(m.ns[tier])), xp: 60 + tier * 30, progress: 0, done: false });
  }
  return out;
}

export const Progression = {
  get d() { return Save.data; },

  // Reset daily and weekly state when the date changes
  refresh() {
    const d = this.d;
    const today = dayKey();
    if (d.daily.key !== today) {
      d.daily = {
        key: today, missions: genMissions(today), bonusClaimed: false, crates: 0,
        firstRunDone: false, seedDone: false, seedTargetClaimed: false, seedBest: 0,
        totals: { crystals: 0, runs: 0, nearMisses: 0 },
      };
    }
    const wk = weekKey();
    if (d.weekly.key !== wk) d.weekly = { key: wk, days: [], claimed: false };
    Save.save();
  },

  dailySeed() { return hashStr('overclock-daily-' + dayKey()); },
  dailyTarget() { return 6000 + (this.dailySeed() % 7) * 1500; },

  // ---------- XP ----------
  addXp(amount) {
    const d = this.d;
    const events = [];
    d.xp += amount;
    d.totalXp += amount;
    while (d.xp >= xpForLevel(d.level)) {
      d.xp -= xpForLevel(d.level);
      d.level += 1;
      const u = UNLOCKS[d.level];
      if (u && !d.owned[u.type].includes(u.id)) d.owned[u.type].push(u.id);
      events.push({ level: d.level, unlock: u || null });
    }
    Save.save();
    return events;
  },

  nextUnlock() {
    const lv = Object.keys(UNLOCKS).map(Number).sort((a, b) => a - b).find((l) => l > this.d.level);
    return lv ? { level: lv, unlock: UNLOCKS[lv] } : null;
  },

  // ---------- Daily calendar ----------
  canClaimCalendar() { return this.d.calendar.lastClaim !== dayKey(); },
  claimCalendar() {
    if (!this.canClaimCalendar()) return null;
    const c = this.d.calendar;
    const xp = CALENDAR_XP[c.index];
    c.lastClaim = dayKey();
    c.index = (c.index + 1) % CALENDAR_XP.length;  // missing days pauses, never resets
    const events = this.addXp(xp);
    return { xp, events };
  },

  // ---------- Bonus crate (rewarded ad) ----------
  cratesLeft() { return Math.max(0, CONFIG.CRATES_PER_DAY - this.d.daily.crates); },
  openCrate() {
    if (this.cratesLeft() <= 0) return null;
    this.d.daily.crates += 1;
    return { xp: CONFIG.CRATE_XP, events: this.addXp(CONFIG.CRATE_XP) };
  },

  // ---------- Missions ----------
  missionValue(m, runStats) {
    if (m.scope === 'day') return this.d.daily.totals[m.stat] + (runStats ? (runStats[m.stat] || 0) : 0);
    return Math.max(m.progress, runStats ? (runStats[m.stat] || 0) : 0);
  },

  // check missions live during a run; returns newly completed ones
  checkMissions(runStats) {
    const done = [];
    for (const m of this.d.daily.missions) {
      if (m.done) continue;
      if (this.missionValue(m, runStats) >= m.n) { m.done = true; m.progress = m.n; done.push(m); }
    }
    return done;
  },

  // ---------- End of run ----------
  finishRun(run) {
    const d = this.d;
    const stats = run.stats;
    const lines = [];
    const distXp = Math.floor(stats.distance / 12);
    const nearXp = stats.nearMisses * 2;
    const crysXp = stats.crystals;
    lines.push(['Distance', distXp], ['Near-misses', nearXp], ['Crystals', crysXp]);
    let base = distXp + nearXp + crysXp;

    // missions (live completion already flagged them)
    for (const m of this.checkMissions(stats)) run.completedMissions.push(m);
    for (const m of d.daily.missions) {
      if (m.scope === 'run') m.progress = Math.min(m.n, Math.max(m.progress, stats[m.stat] || 0));
    }
    for (const m of run.completedMissions) {
      lines.push([`Mission: ${m.text}`, m.xp]);
      base += m.xp;
    }
    d.daily.totals.crystals += stats.crystals;
    d.daily.totals.nearMisses += stats.nearMisses;
    d.daily.totals.runs += 1;
    for (const m of d.daily.missions) if (m.scope === 'day') m.progress = Math.min(m.n, d.daily.totals[m.stat]);
    if (!d.daily.bonusClaimed && d.daily.missions.every((m) => m.done)) {
      d.daily.bonusClaimed = true;
      lines.push(['All daily missions', MISSION_BONUS]);
      base += MISSION_BONUS;
    }

    // daily track rewards
    if (run.mode === 'daily') {
      if (!d.daily.seedDone) { d.daily.seedDone = true; lines.push(['Daily track played', DAILY_SEED_DONE_XP]); base += DAILY_SEED_DONE_XP; }
      if (!d.daily.seedTargetClaimed && stats.score >= this.dailyTarget()) {
        d.daily.seedTargetClaimed = true; lines.push(['Daily target beaten', DAILY_SEED_TARGET_XP]); base += DAILY_SEED_TARGET_XP;
      }
      d.daily.seedBest = Math.max(d.daily.seedBest, Math.floor(stats.score));
    }

    // first run of the day doubles the XP
    let firstBonus = 0;
    if (!d.daily.firstRunDone) {
      d.daily.firstRunDone = true;
      firstBonus = base;
      lines.push(['First run today (x2)', firstBonus]);
    }
    const total = base + firstBonus;

    // weekly goal
    const today = dayKey();
    let weeklyReward = null;
    if (!d.weekly.days.includes(today)) d.weekly.days.push(today);
    if (!d.weekly.claimed && d.weekly.days.length >= WEEKLY_DAYS) {
      d.weekly.claimed = true;
      if (!d.owned.trails.includes(WEEKLY_TRAIL)) { d.owned.trails.push(WEEKLY_TRAIL); weeklyReward = 'Trail: Rainbow (weekly exclusive)'; }
      else { lines.push(['Weekly goal', 500]); weeklyReward = '+500 XP weekly bonus'; }
    }
    const weeklyXp = weeklyReward && weeklyReward.startsWith('+500') ? 500 : 0;

    // bests
    let newBest = false;
    if (run.mode === 'normal') {
      if (stats.score > d.best.score) { d.best.score = Math.floor(stats.score); newBest = true; }
      if (stats.distance > d.best.distance) {
        d.best.distance = Math.floor(stats.distance);
        if (run.ghostRec && run.ghostRec.length > 8) d.ghost = { step: run.ghostStep, samples: run.ghostRec };
      }
    }
    d.stats.runs += 1;
    d.stats.nearMisses += stats.nearMisses;

    const grand = total + weeklyXp;
    const before = { level: d.level, xp: d.xp };
    const events = this.addXp(grand);
    Save.save();
    return { lines, total: grand, events, newBest, weeklyReward, before };
  },

  // ---------- Garage ----------
  cycle(type, key) {
    const owned = this.d.owned[type];
    const cur = this.d.selected[key];
    const i = owned.indexOf(cur);
    this.d.selected[key] = owned[(i + 1) % owned.length];
    Save.save();
    return this.d.selected[key];
  },
};
