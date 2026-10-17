/* نقطة الدخول: تسجيل الشاشات ثم الإقلاع. */
import { boot, app, logError } from './app.js';
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
import './screens/friends.js';
import './screens/shop.js';

boot().then(() => {
  // رمز تحدٍّ في الرابط (#QC-… في نسخة المتصفح) ← يفتح شاشة الأصدقاء على الرمز
  let code = '';
  try { code = decodeURIComponent(location.hash.slice(1)); } catch { /* رابط تالف */ }
  if (/^Q[CR]-/.test(code)) {
    history.replaceState(null, '', location.pathname + location.search);
    if (app.current?.name === 'home') app.go('friends', { code });
  }
}).catch((e) => {
  console.error(e);
  logError(e, 'boot');
  // إصلاح ذاتي مرة واحدة: نحذف الجولة المعلّقة (أكثر سبب شائع) ونعيد التحميل
  let healed = false;
  try { healed = sessionStorage.getItem('mc_healed') === '1'; } catch { /* ignore */ }
  if (!healed) {
    try {
      sessionStorage.setItem('mc_healed', '1');
      for (const k of Object.keys(localStorage)) if (k.startsWith('mc2:active:')) localStorage.removeItem(k);
    } catch { /* ignore */ }
    location.reload();
    return;
  }
  const el = document.getElementById('app');
  if (!el) return;
  const msg = String(e?.message || e).replace(/[<>&]/g, '');
  el.innerHTML = `<div style="padding:28px 20px;text-align:center;line-height:1.8">
    <p style="font-size:1.15rem;font-weight:800">حدث خطأ أثناء التشغيل<br>Something went wrong</p>
    <p style="opacity:.75;font-size:.85rem" dir="ltr">${msg}</p>
    <button id="bootRetry" class="btn primary block" style="margin-top:14px">إعادة المحاولة · Retry</button>
  </div>`;
  document.getElementById('bootRetry')?.addEventListener('click', () => { try { sessionStorage.removeItem('mc_healed'); } catch { /* ignore */ } location.reload(); });
});
// تشغيل ناجح يعيد تفعيل الإصلاح الذاتي للمرة القادمة
setTimeout(() => { try { if (app.current) sessionStorage.removeItem('mc_healed'); } catch { /* ignore */ } }, 4000);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && (!/^(localhost|127\.)/.test(location.hostname) || /[?&]sw=1/.test(location.search))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// خطّاف للاختبارات الآلية فقط (يُفعّل بـ ?e2e=1)
if (/[?&]e2e=1/.test(location.search)) window.__mc = app;
