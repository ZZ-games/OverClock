# Overclock

A neon 3D time-attack runner for iPad with a keyboard (also works on any desktop browser).
The clock is always draining. Skim past obstacles, grab time crystals and chain near-misses to steal time back.

**Play:** https://zz-games.github.io/Overclock/

## Controls

| Key | Action |
|---|---|
| ← → or A D | Steer |
| Space / ↑ / W | Jump (clear the low bars) |
| Shift / ↓ / S | Dash (quick sideways burst, briefly invulnerable) |
| P / Esc | Pause |
| R | Restart instantly |
| M | Mute |

Touch fallback: hold the left or right half of the screen to steer, swipe up to jump, tap with two fingers to dash.

## How it plays

- **Time:** start with 30 s. Near-misses +1 s, time crystals +3 s, crashes −3 s. The clock drains faster the longer you survive.
- **Multiplier:** every 3 near-misses in a row adds x1 to your score multiplier. Crashing resets it.
- **Upgrades:** every 25 s you pick 1 of 3 upgrades (Magnet, Bullet Time, Phase Dash, Shield, Double Jump and more), so every run plays differently.
- **Ghost:** your best run races alongside you.

## Progression and daily rewards

- XP from every run unlocks new worlds (Synth Sunset, Ice Void, Toxic Zone), ships and trails.
- **Daily reward calendar:** 7 days of growing rewards. Missing a day pauses your place; it never resets.
- **Daily missions:** 3 new missions each day, plus a bonus for clearing all 3.
- **Daily track:** the same seeded track for everyone each day, with a target score.
- **First run of the day:** double XP.
- **Weekly goal:** play on any 5 days in a week for an exclusive Rainbow trail.

## Rewarded ads

Every ad is opt-in: the player presses a button and gets a stated reward. Nothing interrupts a run.

| Placement | Reward |
|---|---|
| Second chance (when the clock hits 0, once per run) | +10 seconds |
| Results screen | Double XP for that run |
| Upgrade screen (once per run) | Reroll the 3 choices |
| Bonus crate on the menu (3 per day) | +60 XP |

Until an ad account is set up, a 3-second placeholder screen stands in for the ad so every flow can be tested.

### Turning on real ads

1. Host the game on a site you own and apply for **AdSense H5 Games Ads** (Google's Ad Placement API for HTML5 games). Approval is required.
2. Open `js/config.js` and set `ADSENSE_CLIENT` to your publisher ID (`ca-pub-…`).
3. Leave `ADS_TEST_MODE: true` until test ads show correctly, then set it to `false`.
4. `NON_PERSONALIZED_ADS` is on by default because players may be kids. Check Google's current rules for child-directed games when you apply.

## Project layout

```
index.html            screens and HUD markup
css/style.css         all styling
js/main.js            startup
js/game.js            game states, the run, input, scoring
js/world.js           renderer, bloom, neon city, themes
js/track.js           obstacle patterns, crystals, collisions, near-miss detection
js/ship.js            ship models and light trail
js/fx.js              particles and speed lines
js/upgrades.js        in-run upgrades
js/progression.js     XP, levels, unlocks, daily calendar, missions, weekly goal
js/ads.js             rewarded ads (AdSense or placeholder)
js/audio.js           synthesized music and sound effects
js/config.js          ad settings and gameplay tuning
lib/                  Three.js r160 (bundled, so it works offline and on school networks)
sw.js                 offline cache for the home-screen app
```

No build step. To run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

## Add to the iPad home screen

Open the game in Safari → Share → **Add to Home Screen**. It then opens full screen like an app and works offline.

Saves are stored on the device (localStorage). Bump `VERSION` in `sw.js` after changing files so players get the update.
