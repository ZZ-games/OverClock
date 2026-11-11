// DOM screens and HUD
import { Save } from './save.js';
import { Progression, xpForLevel, unlockName, CALENDAR_XP, MISSION_BONUS, WEEKLY_DAYS } from './progression.js';
import { SHIPS, TRAILS } from './ship.js';
import { THEMES } from './world.js';
import { fmt } from './util.js';
import { UPGRADES } from './upgrades.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'upgrade', 'continue', 'results', 'pause', 'hud'];

export const UI = {
  $,
  show(...ids) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', !ids.includes(s));
    document.body.classList.toggle('running', ids.includes('hud'));
  },

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2700);
  },

  popup(text, color = '#fff', size = 30) {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = size + 'px';
    el.style.textShadow = `0 0 16px ${color}`;
    el.style.left = `${46 + Math.random() * 8}%`;
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), 750);
  },

  clockGain(amount) {
    const el = document.createElement('span');
    el.className = amount >= 0 ? 'plus' : 'minus';
    el.textContent = (amount >= 0 ? '+' : '') + amount.toFixed(1) + 's';
    const box = $('clockGain');
    box.appendChild(el);
    setTimeout(() => el.remove(), 900);
  },

  // ---------------- HUD ----------------
  _last: {},
  hud(run) {
    const L = this._last;
    const clock = Math.max(0, run.clock).toFixed(1);
    if (L.clock !== clock) { $('hudClock').textContent = clock; L.clock = clock; }
    const low = run.clock < 5;
    if (L.low !== low) { $('hudClock').classList.toggle('low', low); L.low = low; }
    const sc = fmt(run.stats.score);
    if (L.score !== sc) { $('hudScore').textContent = sc; L.score = sc; }
    const di = fmt(run.stats.distance) + ' m';
    if (L.dist !== di) { $('hudDist').textContent = di; L.dist = di; }
    const mu = 'x' + run.mult;
    if (L.mult !== mu) {
      const el = $('hudMult');
      el.textContent = mu; L.mult = mu;
      el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 120);
    }
    $('hudCombo').style.width = `${((run.combo % 3) / 3) * 100}%`;
    const dashPct = run.dashCd <= 0 ? 100 : 100 - (run.dashCd / run.dashCdMax) * 100;
    $('hudDash').style.width = dashPct + '%';
    const sh = run.shields > 0;
    $('hudShield').classList.toggle('hidden', !sh);
    if (sh) $('hudShieldN').textContent = 'x' + run.shields;
  },

  hudUpgrades(levels) {
    const box = $('hudUpgrades');
    box.innerHTML = '';
    for (const u of UPGRADES) {
      const l = levels[u.id];
      if (!l) continue;
      const el = document.createElement('div');
      el.className = 'hud-upg';
      el.textContent = `${u.icon} ${l > 1 ? l : ''}`;
      el.title = u.name;
      box.appendChild(el);
    }
  },

  resetHud() { this._last = {}; $('clockGain').innerHTML = ''; $('ghostNote').textContent = ''; },

  // ---------------- MENU ----------------
  renderMenu() {
    Progression.refresh();
    const d = Save.data;
    $('menuLevel').textContent = `LEVEL ${d.level}`;
    const need = xpForLevel(d.level);
    $('menuXp').textContent = `${fmt(d.xp)} / ${fmt(need)} XP`;
    $('menuXpFill').style.width = `${(d.xp / need) * 100}%`;
    const nu = Progression.nextUnlock();
    $('menuNextUnlock').textContent = nu ? `Level ${nu.level} unlocks ${unlockName(nu.unlock)}` : 'Everything unlocked: keep chasing records!';
    $('menuBest').textContent = fmt(d.best.score);
    $('menuBestDist').textContent = fmt(d.best.distance) + ' m';
    $('firstRunNote').classList.toggle('hidden', d.daily.firstRunDone);
    $('dailyBadge').classList.toggle('hidden', d.daily.seedDone);
    $('btnDaily').firstChild.textContent = d.daily.seedDone
      ? `DAILY TRACK · best ${fmt(d.daily.seedBest)} `
      : 'DAILY TRACK ';

    $('gShip').textContent = SHIPS[d.selected.ship].name + (d.owned.ships.length > 1 ? ' ›' : '');
    $('gWorld').textContent = THEMES[d.selected.world].name + (d.owned.worlds.length > 1 ? ' ›' : '');
    $('gTrail').textContent = TRAILS[d.selected.trail].name + (d.owned.trails.length > 1 ? ' ›' : '');

    // calendar
    const cal = $('calendar');
    cal.innerHTML = '';
    const canClaim = Progression.canClaimCalendar();
    CALENDAR_XP.forEach((xp, i) => {
      const el = document.createElement('div');
      el.className = 'cal-day';
      const idx = d.calendar.index;
      if (i < idx) el.classList.add('done');
      if (i === idx && canClaim) el.classList.add('today');
      el.innerHTML = `Day ${i + 1}<b>${xp}</b>XP`;
      cal.appendChild(el);
    });
    $('btnClaim').disabled = !canClaim;
    $('btnClaim').firstChild.textContent = canClaim ? `CLAIM ${CALENDAR_XP[d.calendar.index]} XP ` : 'CLAIMED: BACK TOMORROW ';

    // missions
    const ms = $('missions');
    ms.innerHTML = '';
    for (const m of d.daily.missions) {
      const v = Math.min(m.n, Progression.missionValue(m, null));
      const el = document.createElement('div');
      el.className = 'mission' + (m.done ? ' done' : '');
      el.innerHTML = `<div class="m-text"></div><div class="m-bar"><div style="width:${(v / m.n) * 100}%"></div></div><div class="m-xp">${m.done ? '✓' : '+' + m.xp + ' XP'}</div>`;
      el.querySelector('.m-text').textContent = m.text;
      ms.appendChild(el);
    }
    $('missionsBonus').textContent = d.daily.bonusClaimed ? 'all done ✓' : `all 3: +${MISSION_BONUS} XP`;

    // weekly
    const wk = $('weekly');
    wk.innerHTML = '';
    for (let i = 0; i < WEEKLY_DAYS; i++) {
      const dot = document.createElement('div');
      dot.className = 'wk-dot' + (i < d.weekly.days.length ? ' on' : '');
      wk.appendChild(dot);
    }
    const rw = document.createElement('div');
    rw.className = 'wk-reward';
    rw.textContent = d.weekly.claimed ? 'Reward earned ✓' : (d.owned.trails.includes('rainbow') ? 'Reward: +500 XP' : 'Reward: Rainbow trail');
    wk.appendChild(rw);

    // crate
    const left = Progression.cratesLeft();
    $('crateText').textContent = left > 0 ? `+${60} XP · ${left} left today` : 'All opened: new crates tomorrow';
    $('btnCrate').disabled = left <= 0;
  },

  // ---------------- UPGRADE ----------------
  renderUpgrades(choices, levels, focus, canReroll) {
    const box = $('upgradeCards');
    box.innerHTML = '';
    choices.forEach((u, i) => {
      const lvl = (levels[u.id] || 0) + 1;
      const el = document.createElement('div');
      el.className = 'card' + (i === focus ? ' focus' : '') + (u.max === 1 ? ' rare' : '');
      el.innerHTML = `<div class="c-key">${i + 1}</div><div class="c-icon">${u.icon}</div><div class="c-name"></div><div class="c-desc"></div><div class="c-lvl">${u.max === 1 ? 'SPECIAL' : `LEVEL ${lvl} / ${u.max}`}</div>`;
      el.querySelector('.c-name').textContent = u.name;
      el.querySelector('.c-desc').textContent = u.desc(lvl);
      el.dataset.i = i;
      box.appendChild(el);
    });
    $('btnReroll').disabled = !canReroll;
  },

  // ---------------- RESULTS ----------------
  renderResults(run, res) {
    const s = run.stats;
    $('resTitle').textContent = run.mode === 'daily' ? 'DAILY TRACK COMPLETE' : 'RUN COMPLETE';
    $('resScore').textContent = fmt(s.score);
    $('resDist').textContent = fmt(s.distance) + ' m';
    $('resNear').textContent = s.nearMisses;
    $('resCrystals').textContent = s.crystals;
    $('resMult').textContent = 'x' + s.maxMult;
    let bestTxt = '';
    if (run.mode === 'daily') {
      const target = Progression.dailyTarget();
      bestTxt = s.score >= target ? `🎯 Daily target ${fmt(target)} beaten!` : `Daily target: ${fmt(target)}`;
    } else if (res.newBest) bestTxt = '🏆 NEW BEST SCORE!';
    else bestTxt = `Best: ${fmt(Save.data.best.score)}`;
    $('resBest').textContent = bestTxt;
    this.renderXp(res);
  },

  renderXp(res) {
    const list = $('resXpList');
    list.innerHTML = '';
    for (const [name, xp] of res.lines) {
      if (!xp) continue;
      const el = document.createElement('div');
      el.innerHTML = '<span></span><b></b>';
      el.querySelector('span').textContent = name;
      el.querySelector('b').textContent = '+' + fmt(xp);
      list.appendChild(el);
    }
    $('resXpTotal').textContent = `+${fmt(res.total)} XP`;
    const d = Save.data;
    $('resLevel').textContent = `LEVEL ${d.level}`;
    $('resXpTxt').textContent = `${fmt(d.xp)} / ${fmt(xpForLevel(d.level))}`;
    $('resXpFill').style.width = '0%';
    requestAnimationFrame(() => { $('resXpFill').style.width = `${(d.xp / xpForLevel(d.level)) * 100}%`; });
    const un = $('resUnlocks');
    un.innerHTML = '';
    const add = (t) => { const el = document.createElement('div'); el.className = 'unlock'; el.textContent = t; un.appendChild(el); };
    for (const e of res.events) {
      add(`⬆ LEVEL ${e.level}!` + (e.unlock ? `  Unlocked ${unlockName(e.unlock)}` : ''));
    }
    if (res.weeklyReward) add(`📅 Weekly goal: ${res.weeklyReward}`);
  },
};
