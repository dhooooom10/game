// يتحقق من ملف ترجمة: نفس مفاتيح الإنجليزية، ونفس المتغيرات {x}، ولا قيم فارغة.
// الاستخدام: node scripts/check-i18n.mjs es   (أو بلا وسيط لكل اللغات الكاملة)
import { _dicts, FULL_LANGS } from '../public/src/i18n.js';

const langs = process.argv[2] ? [process.argv[2]] : FULL_LANGS;
let bad = 0;
for (const lang of langs) {
  const d = (await import(`../public/src/i18n/${lang}.js`)).default;
  const en = _dicts.en;
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const missing = Object.keys(en).filter((k) => !(k in d));
  const extra = Object.keys(d).filter((k) => !(k in en));
  const phBad = Object.keys(en).filter((k) => k in d && ph(en[k]) !== ph(d[k]));
  const empty = Object.keys(d).filter((k) => typeof d[k] !== 'string' || !d[k].trim());
  const same = Object.keys(en).filter((k) => d[k] === en[k] && /[a-z]{4,}/i.test(en[k]) && !/Qatra|Google|AdMob|^[A-Z]{2,}$/.test(en[k]));
  const ok = !missing.length && !extra.length && !phBad.length && !empty.length;
  if (!ok) bad++;
  console.log(`${lang}: ${Object.keys(d).length}/${Object.keys(en).length} keys` +
    (missing.length ? `\n  missing: ${missing.join(', ')}` : '') + (extra.length ? `\n  extra: ${extra.join(', ')}` : '') +
    (phBad.length ? `\n  placeholder mismatch: ${phBad.join(', ')}` : '') + (empty.length ? `\n  empty: ${empty.join(', ')}` : '') +
    (same.length ? `\n  (info) identical to English: ${same.length}` : '') + (ok ? '  ✓' : '  ✗'));
}
process.exit(bad ? 1 : 0);
