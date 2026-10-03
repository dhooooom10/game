/* أدوات بناء الواجهة: عناصر DOM آمنة (textContent افتراضيًا) وعرض المعادلات. */
import { formatNumber } from '../core/numbers.js';
import { t, tRaw, locale, digitsOut } from '../i18n.js';

/* عناصر اختيارية تُمرَّر كثيرًا كـ null — نمنع ظهورها كنص «null» عند append */
if (typeof Element !== 'undefined' && !Element.prototype.__mcAppend) {
  const native = Element.prototype.append;
  Element.prototype.append = function (...kids) { return native.apply(this, kids.filter((k) => k != null && k !== false)); };
  Element.prototype.__mcAppend = true;
}

/**
 * h('button.btn.primary', { on: { click }, aria: { label } }, 'نص', child)
 * النصوص تُضاف كنص (لا HTML) لتجنّب أي حقن.
 */
export function h(sel, attrs, ...kids) {
  const [tag, ...rest] = sel.split(/(?=[.#])/);
  const el = document.createElement(tag || 'div');
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1));
    else if (r[0] === '#') el.id = r.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'aria') for (const [a, av] of Object.entries(v)) { if (av != null) el.setAttribute('aria-' + a, av); }
      else if (k === 'data') for (const [a, av] of Object.entries(v)) el.dataset[a] = av;
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'html') el.innerHTML = v; // يُستخدم فقط مع محتوى ثابت من الكود (SVG)
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}
export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const num = (n) => formatNumber(n, locale().digits);

/* ---------------- عرض المعادلات ---------------- */
function tokenText(p, prevIsOp) {
  if ('n' in p) return p.n < 0 && prevIsOp ? `(${num(p.n)})` : num(p.n);
  if (p.op) return p.op;
  if (p.eq) return '=';
  if (p.blank) return '?';
  if (p.lp) return '(';
  if (p.rp) return ')';
  if (p.frac) return `${num(p.frac[0])}/${num(p.frac[1])}`;
  if (p.pow) return `${num(p.pow[0])}^${num(p.pow[1])}`;
  if (p.root) return `√${num(p.root)}`;
  if (p.pct) return num(p.pct) + (locale().digits === 'arabic' ? '٪' : '%');
  if (p.word) return t('fmt.' + p.word);
  if (p.objs) return `${p.objs.n} ${p.objs.e}`;
  return '';
}

/** نص مقروء للمعادلة (لقارئ الشاشة) */
export function mathText(parts) {
  let prevOp = false;
  // علامة LRM بين الرموز تمنع انعكاس «٦ − ٥» عند عرضها كنص عادي داخل سياق عربي
  return '\u2066' + parts.map((p) => { const s = tokenText(p, prevOp); prevOp = !!(p.op || p.eq || p.lp); return s; }).join(' \u200E') + '\u2069';
}

/**
 * عنصر معادلة. dir='ltr' يعزل الاتجاه حتى لا تنعكس العمليات في الواجهة العربية.
 * opts.blankValue: قيمة تُعرض داخل الخانة الفارغة (أثناء الكتابة)
 */
export function mathEl(parts, { dir = 'ltr', size = '', blankEl = null, cls = '' } = {}) {
  const el = h('span.math' + (size ? '.' + size : '') + (cls ? '.' + cls : ''), { dir: dir === 'ltr' ? 'ltr' : null, role: 'math', aria: { label: mathText(parts) } });
  let prevOp = false;
  for (const p of parts) {
    let node;
    if ('n' in p) node = h('span.num', p.n < 0 && prevOp ? `(${num(p.n)})` : num(p.n));
    else if (p.op) node = h('span.op', p.op);
    else if (p.eq) node = h('span.op.eq', '=');
    else if (p.blank) node = blankEl || h('span.blank', { aria: { hidden: 'true' } }, '?');
    else if (p.lp) node = h('span.paren', '(');
    else if (p.rp) node = h('span.paren', ')');
    else if (p.frac) node = h('span.frac', { dir: 'ltr' }, h('span.fn', num(p.frac[0])), h('span.fd', num(p.frac[1])));
    else if (p.pow) node = h('span.pow', { dir: 'ltr' }, h('span.num', num(p.pow[0])), h('sup', num(p.pow[1])));
    else if (p.root) node = h('span.root', { dir: 'ltr' }, h('span.rs', '√'), h('span.rad', num(p.root)));
    else if (p.pct) node = h('span.num', { dir: 'ltr' }, num(p.pct) + (locale().digits === 'arabic' ? '٪' : '%'));
    else if (p.word) node = h('span.word', t('fmt.' + p.word));
    else if (p.objs) node = h('span.objs', { aria: { hidden: 'true' } }, ...Array.from({ length: p.objs.n }, () => h('span.obj', p.objs.e)));
    if (node) { node.setAttribute('aria-hidden', 'true'); el.appendChild(node); }
    prevOp = !!(p.op || p.eq || p.lp);
  }
  return el;
}

/**
 * نص مترجم يحتوي معادلات: {e} تُعرض كمعادلة LTR معزولة، والأرقام تُنسّق.
 */
export function richText(key, params = {}) {
  const tpl = tRaw(key);
  const out = h('span.rich');
  const re = /\{(\w+)\}/g;
  let last = 0, m;
  while ((m = re.exec(tpl))) {
    if (m.index > last) out.appendChild(document.createTextNode(digitsOut(tpl.slice(last, m.index))));
    const v = params[m[1]];
    if (Array.isArray(v)) out.appendChild(mathEl(v, { size: 'inline' }));
    else if (typeof v === 'number') out.appendChild(h('bdi', { dir: 'ltr' }, num(v)));
    else if (m[1] === 'rel') out.appendChild(document.createTextNode(t('rel.' + v)));
    else if (v != null) out.appendChild(document.createTextNode(String(v)));
    last = m.index + m[0].length;
  }
  if (last < tpl.length) out.appendChild(document.createTextNode(digitsOut(tpl.slice(last))));
  return out;
}

/* ---------------- أيقونات SVG أصلية بسيطة ---------------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20h7M10 17h4"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.2a5 5 0 0 1 6 5.3"/>',
  drop: '<path d="M12 3.2C9 7.5 6 10.7 6 14.2a6 6 0 0 0 12 0c0-3.5-3-6.7-6-11z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  backspace: '<path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  fire: '<path d="M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-3.5 2.8-5.2 3.9-8.8 1.8 1.4 2.4 3.3 2.4 4.6 1-.6 1.8-1.9 2-3.3 2.2 1.8 4.7 4.4 4.7 7.5 0 3.5-2.6 6.2-6.5 6.2z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  sparkle: '<path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
};
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}
