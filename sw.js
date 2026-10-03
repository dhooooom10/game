/* Math Clash — Service Worker
   يخزّن اللعبة محلياً لتعمل بلا إنترنت بعد أول زيارة.
   ملاحظة: غيّر رقم CACHE عند كل إصدار جديد لتجبر المتصفح على التحديث. */

const CACHE = 'math-clash-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// التثبيت: خزّن ملفات اللعبة
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// التفعيل: احذف النسخ القديمة
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* الجلب:
   - صفحات HTML: الشبكة أولاً (ليصل التحديث)، والكاش احتياطاً عند انقطاع الإنترنت.
   - بقية الملفات: الكاش أولاً (أسرع)، ثم الشبكة. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        // خزّن فقط الطلبات من نفس النطاق
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
