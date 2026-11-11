// Local save data (stored on the device only)

const KEY = 'overclock.save.v1';

function defaults() {
  return {
    xp: 0,               // XP into the current level
    level: 1,
    totalXp: 0,
    best: { score: 0, distance: 0 },
    ghost: null,         // best run recording: { step, samples: [dist, x, ...] }
    owned: { ships: ['dart'], worlds: ['neon'], trails: ['cyan'] },
    selected: { ship: 'dart', world: 'neon', trail: 'cyan' },
    calendar: { index: 0, lastClaim: null },
    daily: {
      key: null, missions: [], bonusClaimed: false, crates: 0,
      firstRunDone: false, seedDone: false, seedTargetClaimed: false, seedBest: 0,
      totals: { crystals: 0, runs: 0, nearMisses: 0 },
    },
    weekly: { key: null, days: [], claimed: false },
    settings: { muted: false },
    stats: { runs: 0, nearMisses: 0 },
  };
}

function merge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in over)) continue;
    const b = base[k], o = over[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && o && typeof o === 'object' && !Array.isArray(o)) {
      base[k] = merge(b, o);
    } else {
      base[k] = o;
    }
  }
  return base;
}

export const Save = {
  data: defaults(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch (e) {
      this.data = defaults();
    }
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  },
};
