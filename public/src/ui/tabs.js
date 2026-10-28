/* =========================================================================
   تبويبات بمؤشر ينزلق (interaction-patterns-kit #2، أُعيدت كتابتها بهوية قطرة).
   ARIA tabs كاملة: tabindex متنقّل، والأسهم تتبع اتجاه القراءة (في العربية ← التالي)،
   وHome/End. المؤشر يُقاس بـ left فيزيائي + translateX لأن getBoundingClientRect
   فيزيائي، فيعمل في RTL وLTR بلا تعديل. تقليل الحركة يلغي الانزلاق ويبقي الحالة.
   ========================================================================= */
import { h } from './dom.js';
import { sfx } from './audio.js';

/** items: [[value, label, id?]] — onChange(value) يُستدعى عند التبديل. */
export function slidingTabs(items, value, onChange, label) {
  const bar = h('div.stabs', { role: 'tablist', aria: { label } });
  const ind = h('span.stabs-ind', { aria: { hidden: 'true' } });
  bar.appendChild(ind);
  const btns = items.map(([v, text, id]) => h('button.stab', {
    id: id || null, type: 'button', role: 'tab', data: { v: String(v) },
    on: { click: () => select(v, true) },
  }, text));
  bar.append(...btns);

  let current = value;
  function move() {
    const b = btns.find((x) => x.dataset.v === String(current));
    if (!b || !bar.isConnected) return;
    const r = b.getBoundingClientRect(), p = bar.getBoundingClientRect();
    ind.style.width = r.width + 'px';
    ind.style.transform = `translateX(${r.left - p.left - bar.clientLeft}px)`;
    ind.classList.add('on');
  }
  function paint() {
    for (const b of btns) {
      const on = b.dataset.v === String(current);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    move();
  }
  function select(v, user) {
    if (String(v) === String(current)) return;
    current = v;
    if (user) sfx.tap();
    paint();
    onChange(v);
  }
  bar.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const rtl = getComputedStyle(bar).direction === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    let n = null;
    if (step) n = (i + step + btns.length) % btns.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = btns.length - 1;
    if (n === null) return;
    e.preventDefault();
    btns[n].focus();
    select(btns[n].dataset.v, true);
  });
  // القياس بعد التركيب، وعند تغيّر المقاس (تدوير الجوال، تغيير الخط)
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(move) : null;
  ro?.observe(bar);
  requestAnimationFrame(paint);
  paint();

  /** set(v): تبديل من الكود (بلا صوت) */
  bar.set = (v) => select(v, false);
  return bar;
}
