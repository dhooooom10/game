/* =========================================================================
   المشاركة: نص قصير على طريقة Wordle + رابط يفتح اللعبة مباشرة في المتصفح.
   داخل تطبيق Android نستخدم إضافة Capacitor Share (WebView لا يدعم navigator.share)،
   وفي المتصفح Web Share API، وإلا ننسخ النص إلى الحافظة.
   ========================================================================= */
import { t } from '../i18n.js';
import { num } from './dom.js';
import { toast } from './fx.js';
import { CONFIG, PUBLIC_URL, isNativeApp } from '../config.js';

/** رابط مع مصدر الزيارة (لقياس أي قناة تجلب لاعبين) */
export function shareUrl(params = {}) {
  const u = new URL(PUBLIC_URL + '/');
  for (const [k, v] of Object.entries({ ref: 'share', ...params })) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

/** رقم التحدي اليومي (#1 = يوم الإطلاق) */
export function dailyNumber(date) {
  const d = Date.parse(date + 'T00:00:00Z'), s = Date.parse(CONFIG.launchDate + 'T00:00:00Z');
  return Math.max(1, Math.round((d - s) / 864e5) + 1);
}

/** شبكة الرموز: 🟦 سريعة (<٢ث) · 🟩 صحيحة · 🟥 فاتت. أقصى ٣ أسطر × ١٠ */
export function emojiGrid(answers) {
  const cells = answers.map((a) => (!a.correct ? '🟥' : a.ms == null || a.ms < 2000 ? '🟦' : '🟩'));
  const rows = [];
  for (let i = 0; i < Math.min(cells.length, 30); i += 10) rows.push(cells.slice(i, i + 10).join(''));
  if (cells.length > 30) rows[rows.length - 1] += '…';
  return rows.join('\n');
}

/** نص مشاركة التحدي اليومي */
export function dailyShareText({ date, score, sum }) {
  const acc = Math.round((sum.accuracy || 0) * 100);
  return [
    t('share.dailyTitle', { n: dailyNumber(date) }),
    t('share.dailyLine', { drops: num(sum.popped), acc: num(acc), score: num(score) }),
    emojiGrid(sum.answers || []),
  ].join('\n');
}

/** مشاركة نص ورابط بأفضل وسيلة متاحة. يعيد 'shared' | 'copied' | 'cancel' */
export async function shareText(text, url) {
  const full = url ? `${text}\n${url}` : text;
  if (isNativeApp() && window.Capacitor.isPluginAvailable?.('Share')) {
    try { await window.Capacitor.registerPlugin('Share').share({ text, url, dialogTitle: t('share.title') }); return 'shared'; }
    catch { return 'cancel'; }
  }
  if (navigator.share) {
    try { await navigator.share({ text, url }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  }
  try { await navigator.clipboard.writeText(full); toast(t('share.copied')); return 'copied'; }
  catch { toast(t('share.failed')); return 'cancel'; }
}
