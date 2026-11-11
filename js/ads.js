// Rewarded ads.
//
// All ads are opt-in: the player presses a "Watch ad" button and gets a
// stated reward. Nothing interrupts gameplay.
//
// With CONFIG.ADSENSE_CLIENT set, this uses Google's H5 Games Ad Placement
// API (adBreak with type 'reward'), which needs an approved AdSense H5
// Games Ads account. Without it, a short placeholder screen is shown so
// every reward flow can be built and tested first.
import { CONFIG } from './config.js';
import { Audio } from './audio.js';

let real = false;
let busy = false;

export const Ads = {
  get isReal() { return real; },

  init() {
    if (!CONFIG.ADSENSE_CLIENT) return;
    window.adsbygoogle = window.adsbygoogle || [];
    if (CONFIG.NON_PERSONALIZED_ADS) window.adsbygoogle.requestNonPersonalizedAds = 1;
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CONFIG.ADSENSE_CLIENT)}`;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-ad-frequency-hint', '30s');
    if (CONFIG.ADS_TEST_MODE) s.setAttribute('data-adbreak-test', 'on');
    document.head.appendChild(s);
    window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
    real = true;
  },

  // Resolves true if the reward should be granted.
  showRewarded(name) {
    if (busy) return Promise.resolve(false);
    busy = true;
    Audio.duck(true);
    const done = (ok) => { busy = false; Audio.duck(false); return ok; };
    if (real) return this._real(name).then(done);
    return this._placeholder().then(done);
  },

  _real(name) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
      try {
        window.adBreak({
          type: 'reward',
          name,
          beforeReward: (showAdFn) => showAdFn(), // player already chose to watch
          adDismissed: () => finish(false),
          adViewed: () => finish(true),
          adBreakDone: (info) => {
            if (info && info.breakStatus !== 'viewed') finish(false);
            else finish(true);
          },
        });
      } catch (e) {
        finish(false);
      }
      setTimeout(() => finish(false), 60000);
    });
  },

  _placeholder() {
    return new Promise((resolve) => {
      const ov = document.getElementById('adOverlay');
      const cnt = document.getElementById('adCount');
      let n = CONFIG.PLACEHOLDER_AD_SECONDS;
      cnt.textContent = n;
      ov.classList.remove('hidden');
      const iv = setInterval(() => {
        n -= 1;
        cnt.textContent = Math.max(0, n);
        if (n <= 0) {
          clearInterval(iv);
          ov.classList.add('hidden');
          resolve(true);
        }
      }, 1000);
    });
  },
};
