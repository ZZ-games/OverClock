import { Save } from './save.js';
import { Audio } from './audio.js';
import { Ads } from './ads.js';
import { Progression } from './progression.js';
import { Game } from './game.js';

function boot() {
  Save.load();
  Progression.refresh();
  Audio.setMuted(Save.data.settings.muted);
  document.getElementById('muteBtn').textContent = Save.data.settings.muted ? '🔇' : '🔊';
  Ads.init();
  try {
    window.game = new Game(document.getElementById('game'));
    document.getElementById('loading').classList.add('hidden');
  } catch (e) {
    console.error(e);
    document.getElementById('loadText').textContent = 'Could not start: this device needs WebGL 2.';
  }
}

boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
