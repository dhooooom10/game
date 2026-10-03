/* =========================================================================
   رسم القطرات: قطرة ماء زجاجية حقيقية الشكل (SVG) بتدرّج عمق، انعكاس ضوء،
   حافة لامعة، وتوهّج داخلي — مع شارات للقطرات الخاصة ومؤثرات انفجار ورذاذ.
   كل التدرّجات معرّفة مرة واحدة في السماء ويُختار لونها بالـ CSS حسب النوع.
   ========================================================================= */

// شكل القطرة: الرأس في الأعلى (60,4) وجسم دائري مركزه (60,90)
export const DROP_PATH = 'M60 3 C 52 20 13 50 13 89 A 47 47 0 0 0 107 89 C 107 50 68 20 60 3 Z';

const STOPS = {
  normal: ['#F2FEFF', '#8FEAFF', '#26B8F0', '#0B63A8'],
  near: ['#FFF6DE', '#FFD27A', '#FF9330', '#B9420D'],
  gold: ['#FFFDE8', '#FFE68A', '#F4B21F', '#9C6200'],
  ice: ['#FFFFFF', '#E9FCFF', '#A3E6F7', '#3EA6CC'],
  storm: ['#F4EEFF', '#C3B2FF', '#7B5CF6', '#3A1FB0'],
};

/** تعريفات SVG المشتركة (تُضاف مرة واحدة داخل السماء) */
export function dropDefsSVG() {
  const grads = Object.entries(STOPS).map(([k, [a, b, c, d]]) => `
    <radialGradient id="dg-${k}" cx="0.36" cy="0.42" r="0.78" fx="0.3" fy="0.32">
      <stop offset="0" stop-color="${a}"/><stop offset="0.28" stop-color="${b}"/><stop offset="0.68" stop-color="${c}"/><stop offset="1" stop-color="${d}"/>
    </radialGradient>`).join('');
  return `<svg class="drop-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
    <defs>${grads}
      <radialGradient id="dg-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="dg-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="dg-shade" x1="0" y1="0" x2="1" y2="1"><stop offset=".45" stop-color="#001a3a" stop-opacity="0"/><stop offset="1" stop-color="#001a3a" stop-opacity=".38"/></linearGradient>
    </defs></svg>`;
}

const BADGE = {
  gold: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#fff"/>',
  ice: '<g stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/></g>',
  storm: '<path d="M13.5 2 5 13.5h5.8L9.6 22 19 9.8h-6z" fill="#fff"/>',
};

/** يبني عنصر قطرة: الشكل + المحتوى (عنصر المعادلة) + شارة اختيارية */
export function buildDrop(kind, content, label) {
  const el = document.createElement('div');
  el.className = 'drop k-' + kind;
  el.setAttribute('role', 'img');
  if (label) el.setAttribute('aria-label', label);
  el.innerHTML = `<span class="drop-inner"><svg class="drop-shape" viewBox="0 0 120 140" preserveAspectRatio="none" aria-hidden="true">
      <path class="d-body" d="${DROP_PATH}"/>
      <path class="d-shade" d="${DROP_PATH}" fill="url(#dg-shade)"/>
      <ellipse cx="66" cy="112" rx="26" ry="12" fill="url(#dg-glow)"/>
      <path class="d-rim" d="${DROP_PATH}" fill="none" stroke="url(#dg-rim)" stroke-width="3"/>
      <path d="M33 70 C 30 82 31 96 37 106" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="42" cy="58" rx="7" ry="11" fill="#fff" fill-opacity=".85" transform="rotate(28 42 58)"/>
      <circle cx="51" cy="44" r="3" fill="#fff" fill-opacity=".8"/>
    </svg></span>`;
  const inner = el.firstChild;
  const txt = document.createElement('span');
  txt.className = 'drop-txt';
  txt.appendChild(content);
  inner.appendChild(txt);
  if (BADGE[kind]) {
    const b = document.createElement('span');
    b.className = 'drop-badge';
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${BADGE[kind]}</svg>`;
    inner.appendChild(b);
  }
  return el;
}

/** يضبط حجم القطرة حسب طول المعادلة مع الحفاظ على نسبة شكل القطرة */
export function sizeDrop(el) {
  const txt = el.querySelector('.drop-txt');
  const tw = txt.scrollWidth;
  if (tw > 150) el.classList.add('long', 'xlong');
  else if (tw > 92) el.classList.add('long');
  const tw2 = txt.scrollWidth;
  // الجزء الدائري من القطرة عند سطر النص يعادل ~٧٤٪ من العرض: نضمن أن المعادلة داخله
  const w = Math.max(84, Math.round(tw2 / 0.74 + 6));
  const h = Math.round(Math.max(96, w * 1.06));
  el.style.width = w + 'px';
  el.style.height = h + 'px';
}

/** رذاذ وحلقة عند الانفجار */
export function popBurst(sky, cx, cy, color, count = 12) {
  const made = [];
  const ring = document.createElement('i');
  made.push(ring);
  ring.className = 'ripple';
  ring.style.cssText = `left:${cx}px;top:${cy}px;--c:${color}`;
  sky.appendChild(ring);
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 30 + Math.random() * 36;
    const s = document.createElement('i');
    s.className = 'droplet';
    const size = 5 + Math.random() * 6;
    s.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size * 1.35}px;--dx:${(Math.cos(a) * dist).toFixed(1)}px;--dy:${(Math.sin(a) * dist).toFixed(1)}px;--r:${((a * 180) / Math.PI + 90).toFixed(0)}deg;--c:${color}`;
    sky.appendChild(s); made.push(s);
  }
  setTimeout(() => made.forEach((x) => x.remove()), 700);
}

/** رذاذ على سطح الماء عندما تسقط القطرة */
export function groundSplash(sky, cx) {
  const H = sky.clientHeight;
  const p = document.createElement('i');
  p.className = 'puddle';
  p.style.cssText = `left:${cx}px;top:${H - 16}px`;
  sky.appendChild(p);
  const made = [p];
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('i');
    s.className = 'droplet up';
    const dx = (i - 3) * 9 + (Math.random() - 0.5) * 6;
    s.style.cssText = `left:${cx}px;top:${H - 18}px;width:6px;height:8px;--dx:${dx}px;--dy:${-(18 + Math.random() * 26)}px;--r:${(dx * 3).toFixed(0)}deg;--c:#9BE7FF`;
    sky.appendChild(s); made.push(s);
  }
  setTimeout(() => made.forEach((x) => x.remove()), 800);
}
