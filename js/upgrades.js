// In-run upgrades: pick one of three every ~25 seconds

export const UPGRADES = [
  { id: 'siphon',  icon: '⏳', name: 'Time Siphon',   max: 3, desc: (l) => `Near-misses give +${(0.3 * l).toFixed(1)}s extra time`, apply: (m) => { m.nearTime += 0.3; } },
  { id: 'crystal', icon: '💎', name: 'Crystal Boost', max: 3, desc: (l) => `Time crystals give +${l}s extra`, apply: (m) => { m.crystalTime += 1; } },
  { id: 'magnet',  icon: '🧲', name: 'Magnet',        max: 3, desc: () => 'Pulls crystals and orbs toward you', apply: (m) => { m.magnet += 1; } },
  { id: 'cooldown',icon: '⚡', name: 'Quick Dash',    max: 3, desc: () => 'Dash recharges 30% faster', apply: (m) => { m.dashCd *= 0.7; } },
  { id: 'phase',   icon: '👻', name: 'Phase Dash',    max: 1, desc: () => 'Dash through obstacles for a guaranteed near-miss', apply: (m) => { m.phase = true; m.dashTime *= 1.3; } },
  { id: 'bullet',  icon: '🌀', name: 'Bullet Time',   max: 2, desc: (l) => `Near-misses slow time for ${(0.5 * l).toFixed(1)}s`, apply: (m) => { m.bullet += 0.5; } },
  { id: 'armor',   icon: '🧱', name: 'Thick Hull',    max: 2, desc: () => 'Crashes cost 1s less time', apply: (m) => { m.hitPenalty = Math.max(1, m.hitPenalty - 1); } },
  { id: 'margin',  icon: '📏', name: 'Wide Margin',   max: 3, desc: () => 'Near-misses count from farther away', apply: (m) => { m.nearDist += 0.4; } },
  { id: 'keeper',  icon: '🔗', name: 'Combo Keeper',  max: 2, desc: () => 'Your combo lasts 3s longer', apply: (m) => { m.comboDecay += 3; } },
  { id: 'overdrive', icon: '🔥', name: 'Overdrive',   max: 2, desc: () => '+1 base multiplier and a higher cap', apply: (m) => { m.baseMult += 1; m.multCap += 4; } },
  { id: 'shield',  icon: '🛡️', name: 'Shield',        max: 3, desc: () => 'Blocks your next crash', apply: (m, run) => { run.shields += 1; } },
  { id: 'jump',    icon: '🦘', name: 'Double Jump',   max: 1, desc: () => 'Jump again in mid-air', apply: (m) => { m.extraJumps += 1; } },
  { id: 'clock',   icon: '🕰️', name: 'Golden Clock',  max: 3, desc: () => 'The clock drains 8% slower', apply: (m) => { m.drain *= 0.92; } },
];

export function defaultMods() {
  return {
    nearTime: 0, crystalTime: 0, magnet: 0, dashCd: 1, dashTime: 1, phase: false, bullet: 0,
    hitPenalty: 3, nearDist: 0, comboDecay: 0, baseMult: 0, multCap: 0, extraJumps: 0, drain: 1,
  };
}

export function rollChoices(levels, rng = Math.random, exclude = []) {
  const avail = UPGRADES.filter((u) => (levels[u.id] || 0) < u.max && !exclude.includes(u.id));
  const out = [];
  const pool = avail.slice();
  while (out.length < 3 && pool.length) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  // if we excluded too much, top up from anything still available
  if (out.length < 3) {
    for (const u of UPGRADES) {
      if (out.length >= 3) break;
      if ((levels[u.id] || 0) < u.max && !out.includes(u)) out.push(u);
    }
  }
  return out;
}
