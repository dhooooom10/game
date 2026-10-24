/* =========================================================================
   رحلة المراحل: خريطة طريق مرسومة لكل عالم (١٠ مراحل على مسار متعرّج)،
   والشخصية تقف عند مرحلتك الحالية. تتنقّل بين العوالم بالسهمين.
   الضغط على مرحلة مفتوحة يبدأ اللعب مباشرة.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, num } from '../ui/dom.js';
import { sfx } from '../ui/audio.js';
import { toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import { mascotSVG } from '../ui/mascot.js';
import { WORLDS, LEVELS_PER_WORLD, levelInfo, worldOf } from '../core/modes.js';
import { topbar } from './setup.js';

const XS = [50, 76, 62, 30, 22, 46, 74, 70, 38, 50];   // مواضع المراحل أفقيًا (٪) — مسار متعرّج
const STEP = 96;                                          // المسافة الرأسية بين مرحلتين (px)

function journeyScreen(app, params = {}) {
  const data = app.data;
  const total = Object.values(data.journey.stars).reduce((a, b) => a + b, 0);
  const cur = Math.min(100, data.journey.unlocked);
  let w = Number.isInteger(params.w) ? params.w : worldOf(cur);
  const el = h('main.journey-view', topbar(t('jr.title'), `★ ${num(total)} / ${num(300)}`));
  const banner = h('div.world-banner');
  const map = h('div.path-map');
  el.append(banner, map);

  function paint() {
    params.w = w;
    const world = WORLDS[w];
    const first = w * LEVELS_PER_WORLD + 1;
    const locked = first > data.journey.unlocked;
    let got = 0;
    for (let L = first; L < first + LEVELS_PER_WORLD; L++) got += data.journey.stars[L] || 0;
    el.style.setProperty('--wc', world.color);

    banner.replaceChildren(
      h('button.icon-btn.wb-prev', { type: 'button', disabled: w === 0, aria: { label: t('jr.worldN', { n: w }) }, on: { click: () => { sfx.tap(); w--; paint(); } } }, '‹'),
      h('div.wb-mid', h('span.wb-ic', locked ? '🔒' : world.icon),
        h('div', h('b', `${t('jr.worldN', { n: w + 1 })} · ${t('world.' + world.key)}`), h('small', t('world.' + world.key + 't'), ' · ★ ', num(got), '/', num(30)))),
      h('button.icon-btn.wb-next', { type: 'button', disabled: w === WORLDS.length - 1, aria: { label: t('jr.worldN', { n: w + 2 }) }, on: { click: () => { sfx.tap(); w++; paint(); } } }, '›'));

    // المسار: منحنى ناعم يمر بمراكز المراحل، والجزء المقطوع ملوّن
    const H = STEP * LEVELS_PER_WORLD + 40;
    const pts = XS.map((x, i) => [x, 50 + i * STEP]);
    const pathD = (arr) => arr.reduce((d, [x, y], i) => {
      if (!i) return `M ${x} ${y}`;
      const [px, py] = arr[i - 1]; const my = (py + y) / 2;
      return `${d} C ${px} ${my}, ${x} ${my}, ${x} ${y}`;
    }, '');
    const doneIdx = Math.max(0, Math.min(LEVELS_PER_WORLD - 1, cur - first));
    const svg = `<svg class="path-svg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${pathD(pts)}" class="p-all" vector-effect="non-scaling-stroke"/>
      ${cur > first ? `<path d="${pathD(pts.slice(0, doneIdx + 1))}" class="p-done" vector-effect="non-scaling-stroke"/>` : ''}
    </svg>`;
    map.replaceChildren();
    map.style.height = H + 'px';
    map.insertAdjacentHTML('beforeend', svg);

    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const L = first + i;
      const info = levelInfo(L);
      const st = data.journey.stars[L] || 0;
      const lk = L > data.journey.unlocked;
      const current = L === cur && !lk;
      const node = h('button.path-node' + (st ? '.done' : '') + (current ? '.current' : '') + (lk ? '.locked' : '') + (info.kind === 'boss' ? '.boss' : ''), {
        type: 'button', 'data-level': L, style: { left: XS[i] + '%', top: pts[i][1] + 'px' },
        aria: { label: `${t('jr.levelN', { n: L })} — ${t('jr.kindName.' + info.kind)}${lk ? ' — ' + t('common.locked') : st ? ' — ' + t('a11y.stars', { n: st }) : ''}` },
        on: { click: () => { sfx.tap(); if (lk) return toast(locked ? t('jr.lockedWorld') : t('jr.unlockHint')); app.go('rainPlay', { kind: 'journey', args: { level: L } }); } },
      },
      h('span.pn-num', lk ? icon('lock') : num(L)),
      info.kind !== 'classic' ? h('span.pn-kind', { aria: { hidden: 'true' } }, info.kind === 'boss' ? '👑' : '⚡') : null,
      h('span.pn-stars', { aria: { hidden: 'true' } }, ...[1, 2, 3].map((k) => h('i' + (k <= st ? '.on' : ''), '★'))));
      map.appendChild(node);
      if (current) {
        map.appendChild(h('span.path-mascot', { style: { left: XS[i] + '%', top: pts[i][1] + 'px' }, html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: 'happy', size: 52, label: t('mascot.name') }) }));
      }
    }
  }
  paint();
  return {
    el,
    afterMount: () => {
      const node = el.querySelector('.path-node.current') || el.querySelector('.path-node:not(.locked):last-of-type');
      if (node && !params._scrolled) { params._scrolled = true; node.scrollIntoView({ block: 'center' }); }
    },
  };
}

registerScreen('journey', journeyScreen);
// توافق مع الروابط القديمة: «world» = نفس الخريطة على عالم محدد
registerScreen('world', (app, params) => journeyScreen(app, params));
