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

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('app');
  if (el) el.innerHTML = '<p style="padding:24px;text-align:center">حدث خطأ أثناء التشغيل. حدّث الصفحة.<br>Something went wrong — please reload.</p>';
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && (!/^(localhost|127\.)/.test(location.hostname) || /[?&]sw=1/.test(location.search))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// خطّاف للاختبارات الآلية فقط (يُفعّل بـ ?e2e=1)
if (/[?&]e2e=1/.test(location.search)) window.__mc = app;
