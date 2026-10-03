/* نقطة الدخول: تسجيل الشاشات ثم الإقلاع. */
import { boot, app } from './app.js';
import './screens/home.js';
import './screens/journey.js';
import './screens/setup.js';
import './screens/game.js';
import './screens/results.js';
import './screens/progress.js';
import './screens/locker.js';
import './screens/settings.js';
import './screens/friend.js';
import './screens/rain.js';
import './screens/online.js';
import './screens/shop.js';

// مصدر أول زيارة (?ref=share/tiktok/teacher...) — يُرسل مجهولًا مع إحصاءات الاستخدام
try {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[\w-]{2,32}$/.test(ref) && !localStorage.getItem('mc_ref')) localStorage.setItem('mc_ref', ref);
} catch { /* ignore */ }

boot().then(() => {
  // رابط تحدٍّ: ?c=المعرّف
  const c = new URLSearchParams(location.search).get('c');
  if (c && /^[\w-]{4,20}$/.test(c)) {
    history.replaceState(null, '', location.pathname + (location.search.includes('e2e=1') ? '?e2e=1' : ''));
    if (app.current?.name === 'home') app.go('challenge', { id: c });
  }
  // رابط انضمام لنادٍ: ?club=الرمز
  const club = new URLSearchParams(location.search).get('club');
  if (club && /^[0-9A-Za-z]{6}$/.test(club)) {
    history.replaceState(null, '', location.pathname + (location.search.includes('e2e=1') ? '?e2e=1' : ''));
    if (app.current?.name === 'home') app.go('clubJoin', { code: club.toUpperCase() });
  }
}).catch((e) => {
  console.error(e);
  const el = document.getElementById('app');
  if (el) el.innerHTML = '<p style="padding:24px;text-align:center">حدث خطأ أثناء التشغيل. حدّث الصفحة.<br>Something went wrong — please reload.</p>';
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && (!/^(localhost|127\.)/.test(location.hostname) || /[?&]sw=1/.test(location.search))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// خطّاف للاختبارات الآلية فقط (يُفعّل بـ ?e2e=1)
if (/[?&]e2e=1/.test(location.search)) window.__mc = app;
