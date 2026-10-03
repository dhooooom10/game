/* =========================================================================
   الصعوبة التكيّفية — لكل عملية حسابية «تقدير مهارة» بين ١ و١٠.
   -------------------------------------------------------------------------
   • لا يتغيّر التقدير إلا بعد عيّنة كافية: ٦ إجابات جديدة على الأقل في العملية نفسها.
   • يُحكم على آخر ٨ إجابات: الدقة + وسيط زمن الإجابة مقارنة بالزمن المتوقّع.
   • الخطوة صغيرة (±٠٫٢٥ أو ±٠٫٥) فلا قفزات مفاجئة، وخطأ واحد لا يخفض المستوى.
   ========================================================================= */
import { parTime } from './questions.js';

export const WINDOW = 8;
export const MIN_SAMPLE = 6;

export function newSkill(r = 1) {
  return { r, win: [], since: 0 };
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * يسجّل إجابة ويعيد التقدير الجديد.
 * entry: { correct, ms (أو null إن انتهى الوقت), tier, format }
 * يعيد { skill, change } حيث change = مقدار التغيير (0 إن لم يتغيّر).
 */
export function recordSkill(skill, entry) {
  const s = { r: skill?.r ?? 1, win: (skill?.win || []).slice(), since: (skill?.since || 0) + 1 };
  // نسجّل الزمن نسبةً إلى الزمن المتوقّع، فيبقى منصفًا عند تبدّل المستوى أو الصيغة
  const par = parTime(entry.topic || 'add', entry.tier || Math.round(s.r), entry.format || 'input');
  s.win.push({ c: entry.correct ? 1 : 0, t: entry.ms == null ? 2 : +(entry.ms / par).toFixed(3) });
  if (s.win.length > WINDOW) s.win.shift();
  let change = 0;
  if (s.since >= MIN_SAMPLE && s.win.length >= MIN_SAMPLE) {
    const acc = s.win.reduce((a, x) => a + x.c, 0) / s.win.length;
    const speed = median(s.win.filter((x) => x.c).map((x) => x.t));
    if (acc >= 0.875 && speed <= 1) change = 0.5;
    else if (acc >= 0.75 && speed <= 1.5) change = 0.25;
    else if (acc < 0.5) change = -0.5;
    else if (acc < 0.625) change = -0.25;
    if (change) {
      s.r = Math.max(1, Math.min(10, +(s.r + change).toFixed(2)));
      s.since = 0;
    }
  }
  return { skill: s, change };
}

/** المستوى الصحيح المستخدم لتوليد الأسئلة من التقدير */
export const tierFromSkill = (skill) => Math.max(1, Math.min(10, Math.floor((skill?.r ?? 1) + 1e-9)));
