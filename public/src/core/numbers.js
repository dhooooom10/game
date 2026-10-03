/* أدوات الأرقام: تحويل الأرقام العربية/الفارسية/الغربية، وعرضها حسب تفضيل اللاعب. */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
export const MINUS = '−'; // علامة الطرح الرياضية «−»

/** يحوّل أي أرقام عربية-هندية أو فارسية إلى أرقام غربية، ويوحّد علامات السالب. */
export function normalizeDigits(input) {
  return String(input ?? '')
    .replace(/[٠-٩]/g, (c) => String(ARABIC_INDIC.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(PERSIAN.indexOf(c)))
    .replace(/[−‒–—﹣－]/g, '-');
}

/**
 * يقرأ إجابة اللاعب كعدد صحيح. يقبل «١٢» و«12» و«-٣» و«−3» مع مسافات.
 * يعيد null إن لم يكن الإدخال عددًا صحيحًا سليمًا.
 */
export function parseAnswer(input) {
  const s = normalizeDigits(input).replace(/[\s‎‏؜]/g, '');
  if (!/^-?\d{1,7}$/.test(s)) return null;
  const n = Number(s);
  return Object.is(n, -0) ? 0 : n;
}

/** يحوّل الأرقام الغربية في نص إلى أرقام عربية-هندية. */
export function toArabicDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => ARABIC_INDIC[+d]);
}

/** يعرض عددًا حسب نمط الأرقام ('arabic' أو 'western')، مع علامة سالب رياضية. */
export function formatNumber(n, digits = 'western') {
  let s = String(n);
  if (s.startsWith('-')) s = MINUS + s.slice(1);
  return digits === 'arabic' ? toArabicDigits(s) : s;
}

/** يعرض أي نص يحوي أرقامًا حسب نمط الأرقام. */
export function formatText(s, digits = 'western') {
  return digits === 'arabic' ? toArabicDigits(s) : String(s);
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
