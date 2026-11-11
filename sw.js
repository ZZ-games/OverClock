// Offline cache so the game opens from the iPad home screen without a connection.
// Bump VERSION whenever files change so players get the update.
const VERSION = 'overclock-v1';
const FILES = [
  './', 'index.html', 'css/style.css', 'icon.svg', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/world.js', 'js/ship.js', 'js/track.js', 'js/fx.js',
  'js/audio.js', 'js/ads.js', 'js/ui.js', 'js/save.js', 'js/progression.js', 'js/upgrades.js',
  'js/config.js', 'js/util.js',
  'lib/three.module.js',
  'lib/addons/postprocessing/EffectComposer.js', 'lib/addons/postprocessing/RenderPass.js',
  'lib/addons/postprocessing/ShaderPass.js', 'lib/addons/postprocessing/MaskPass.js',
  'lib/addons/postprocessing/Pass.js', 'lib/addons/postprocessing/UnrealBloomPass.js',
  'lib/addons/postprocessing/OutputPass.js', 'lib/addons/shaders/CopyShader.js',
  'lib/addons/shaders/LuminosityHighPassShader.js', 'lib/addons/shaders/OutputShader.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// network first (so updates show up), cache as fallback when offline
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
