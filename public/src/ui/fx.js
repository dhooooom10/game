/* مؤثرات بصرية قصيرة: احتفال بالقصاصات، عدّ الأرقام، اهتزاز، رسائل عابرة.
   كلها تحترم «تقليل الحركة» ولا تحجب السؤال ولا تؤخر الإدخال. */
import { h } from './dom.js';

let motionPref = 'system';
export function setMotion(pref) { motionPref = pref; document.documentElement.dataset.motion = reducedMotion() ? 'reduce' : 'full'; }
export function reducedMotion() {
  if (motionPref === 'reduce') return true;
  if (motionPref === 'full') return false;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** عدّ رقم من a إلى b داخل عنصر */
export function countUp(el, to, { from = 0, ms = 900, fmt = String } = {}) {
  if (reducedMotion() || to === from) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const stepFn = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(stepFn);
  };
  requestAnimationFrame(stepFn);
}

/** احتفال بالقصاصات (canvas خفيف، يختفي تلقائيًا، لا يلتقط النقرات) */
export function confetti({ count = 90, duration = 1800, colors = ['#38D6F5', '#FFC94A', '#3DDC97', '#FF7BB0', '#9B8CFF'] } = {}) {
  if (reducedMotion()) return;
  const c = h('canvas.confetti', { aria: { hidden: 'true' } });
  document.body.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr);
  const g = c.getContext('2d');
  const parts = Array.from({ length: count }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
    vx: (Math.random() - 0.5) * 14 * dpr, vy: (-6 - Math.random() * 10) * dpr,
    r: (4 + Math.random() * 5) * dpr, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3,
    col: colors[(Math.random() * colors.length) | 0], shape: Math.random() < 0.3 ? 'drop' : 'rect',
  }));
  const t0 = performance.now();
  const frame = (now) => {
    const k = (now - t0) / duration;
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.35 * dpr; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.a += p.va;
      g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.col;
      if (p.shape === 'drop') { g.beginPath(); g.arc(0, 0, p.r * 0.7, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      g.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

/** يعيد تشغيل حركة CSS على عنصر */
export function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** نقاط تطفو من عنصر */
export function floatText(anchor, text, cls = '') {
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const el = h('div.float-text' + (cls ? '.' + cls : ''), { aria: { hidden: 'true' }, style: { left: r.left + r.width / 2 + 'px', top: r.top + 'px' } }, text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), reducedMotion() ? 600 : 900);
}

let toastTimer = null;
export function toast(text, { ms = 2200, kind = '' } = {}) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div#toast.toast', { role: 'status', aria: { live: 'polite' } }); document.body.appendChild(el); }
  el.className = 'toast show' + (kind ? ' ' + kind : '');
  el.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, ms);
}
