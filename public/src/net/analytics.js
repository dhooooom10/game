/* =========================================================================
   إحصاءات استخدام مجهولة: معرّف تثبيت عشوائي (غير مرتبط بالحساب أو الاسم)،
   يوم النشاط، ومصدر أول زيارة، وعدّادات أحداث مجمّعة. يمكن إيقافها من الإعدادات.
   الغرض: معرفة هل يعود اللاعبون (اليوم التالي/بعد أسبوع) وأي قناة تجلبهم.
   ========================================================================= */
import { api } from './online.js';
import { isNativeApp } from '../config.js';

const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* ignore */ } return null; };
let enabled = true, pending = {}, timer = 0, ctx = {};

function iid() {
  let id = LS('mc_iid');
  if (!id) { id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^\w-]/g, ''); LS('mc_iid', id); }
  return id;
}

export function configure(app) {
  // في الاختبارات الآلية (?e2e=1) لا نرسل إلا إن طُلب صراحة (?a=1)
  const auto = /[?&]e2e=1/.test(location.search) && !/[?&]a=1/.test(location.search);
  enabled = app.settings.analytics !== false && !auto;
  ctx = { lang: app.settings.lang, country: null };
  try { pending = JSON.parse(LS('mc_aq') || '{}') || {}; } catch { pending = {}; }
}

/** عدّاد حدث (يُرسل مجمّعًا) */
export function track(name, n = 1) {
  if (!enabled) return;
  pending[name] = (pending[name] || 0) + n;
  LS('mc_aq', JSON.stringify(pending));
  clearTimeout(timer);
  timer = setTimeout(flush, 8000);
}

/** يسجّل يوم النشاط ويرسل العدّادات المعلّقة */
export async function flush() {
  if (!enabled) return;
  const events = pending; pending = {}; LS('mc_aq', '{}');
  try {
    await api('POST', '/api/a', { iid: iid(), ref: LS('mc_ref') || null, platform: isNativeApp() ? 'app' : 'web', lang: ctx.lang, events }, { auth: false, timeout: 6000 });
  } catch {
    // بلا اتصال: نعيدها للطابور
    for (const [k, v] of Object.entries(events)) pending[k] = (pending[k] || 0) + v;
    LS('mc_aq', JSON.stringify(pending));
  }
}

export function setEnabled(app, on) { app.settings.analytics = !!on; app.save(); enabled = !!on; if (!on) { pending = {}; LS('mc_aq', '{}'); } }
