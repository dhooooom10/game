/* Math Clash — Service Worker
   يخزّن اللعبة محليًا لتعمل بلا إنترنت بعد أول زيارة.
   قائمة الملفات ورقم الإصدار يولّدهما: node scripts/build-sw.mjs */

const CACHE = 'math-clash-14022ac32d';
const ASSETS = [
  './',
  './admin.html',
  './apple-touch-icon.png',
  './favicon-32.png',
  './fonts/baloobhaijaan2-500-800-arabic.woff2',
  './fonts/baloobhaijaan2-500-800-latin.woff2',
  './fonts/fonts.css',
  './fonts/tajawal-500-arabic.woff2',
  './fonts/tajawal-500-latin.woff2',
  './fonts/tajawal-800-arabic.woff2',
  './fonts/tajawal-800-latin.woff2',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './index.html',
  './manifest.webmanifest',
  './privacy.html',
  './src/admin/admin.js',
  './src/app.js',
  './src/core/adaptive.js',
  './src/core/curriculum.js',
  './src/core/modes.js',
  './src/core/numbers.js',
  './src/core/progression.js',
  './src/core/questions.js',
  './src/core/rain.js',
  './src/core/rng.js',
  './src/core/scoring.js',
  './src/core/session.js',
  './src/core/storage.js',
  './src/i18n.js',
  './src/main.js',
  './src/net/online.js',
  './src/runs.js',
  './src/screens/friend.js',
  './src/screens/game.js',
  './src/screens/home.js',
  './src/screens/journey.js',
  './src/screens/locker.js',
  './src/screens/online.js',
  './src/screens/progress.js',
  './src/screens/rain.js',
  './src/screens/results.js',
  './src/screens/settings.js',
  './src/screens/setup.js',
  './src/ui/audio.js',
  './src/ui/dom.js',
  './src/ui/fx.js',
  './src/ui/mascot.js',
  './styles/admin.css',
  './styles/main.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* الصفحات: الشبكة أولًا (ليصل التحديث) ثم الكاش عند انقطاع الإنترنت.
   بقية الملفات: الكاش أولًا ثم الشبكة. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
