/* رحلة المستويات: قائمة العوالم، ثم مسار مراحل العالم، ثم بطاقة المرحلة (الهدف وقاعدة النجوم). */
import { app, registerScreen } from '../app.js';
import { h, icon, num } from '../ui/dom.js';
import { sfx } from '../ui/audio.js';
import { toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import { WORLDS, LEVELS_PER_WORLD, levelInfo, journeyRain } from '../core/modes.js';

const topbar = (title, sub, backable = true) => h('header.topbar',
  backable ? h('button.icon-btn.back', { aria: { label: t('common.back') }, on: { click: () => { sfx.tap(); app.back(); } } }, icon('back')) : null,
  h('h1', title, sub ? h('span.sub', sub) : null));

registerScreen('journey', (app) => {
  const data = app.data;
  const total = Object.values(data.journey.stars).reduce((a, b) => a + b, 0);
  const el = h('main', topbar(t('jr.title'), `★ ${num(total)} / ${num(300)}`, false));
  WORLDS.forEach((w, i) => {
    const first = i * LEVELS_PER_WORLD + 1;
    const locked = first > data.journey.unlocked;
    let got = 0, done = 0;
    for (let L = first; L < first + LEVELS_PER_WORLD; L++) { got += data.journey.stars[L] || 0; if (data.journey.stars[L]) done++; }
    el.appendChild(h('button.world-card' + (locked ? '.locked' : ''), {
      style: { '--wc': w.color }, 'aria-disabled': locked ? 'true' : null,
      aria: { label: `${t('jr.worldN', { n: i + 1 })}: ${t('world.' + w.key)}${locked ? ' — ' + t('common.locked') : ''}` },
      on: { click: () => { sfx.tap(); if (locked) return toast(t('jr.lockedWorld')); app.go('world', { w: i }); } },
    },
    h('span.wi', locked ? '🔒' : w.icon),
    h('div.wb', h('div.wn', `${num(i + 1)}. ${t('world.' + w.key)}`), h('div.wt', t('world.' + w.key + 't')),
      h('div.bar', h('i', { style: { width: (done / LEVELS_PER_WORLD) * 100 + '%' } }))),
    h('span.ws', `★ ${num(got)}/${num(30)}`)));
  });
  return { el, nav: 'journey' };
});

registerScreen('world', (app, { w }) => {
  const data = app.data;
  const world = WORLDS[w];
  const first = w * LEVELS_PER_WORLD + 1;
  const el = h('main', topbar(`${world.icon} ${t('world.' + world.key)}`, `${t('jr.worldN', { n: w + 1 })} · ${t('world.' + world.key + 't')}`));
  const grid = h('div.level-path', { style: { '--wc': world.color }, role: 'list' });
  for (let L = first; L < first + LEVELS_PER_WORLD; L++) {
    const info = levelInfo(L);
    const st = data.journey.stars[L] || 0;
    const locked = L > data.journey.unlocked;
    const current = L === data.journey.unlocked && !st;
    const node = h('button.level-node' + (st ? '.done' : '') + (current ? '.current' : '') + (locked ? '.locked' : '') + (info.kind === 'boss' ? '.boss' : ''), {
      role: 'listitem', 'data-level': L,
      aria: { label: `${t('jr.levelN', { n: L })} — ${t('jr.kindName.' + info.kind)}${locked ? ' — ' + t('common.locked') : st ? ' — ' + t('a11y.stars', { n: st }) : ''}` },
      on: { click: () => { sfx.tap(); if (locked) return toast(t('jr.unlockHint')); openLevel(L); } },
    }, locked ? icon('lock') : num(L),
    info.kind !== 'classic' ? h('span.kd', { aria: { hidden: 'true' } }, info.kind === 'boss' ? '👑' : '⚡') : null,
    st ? h('span.st', { aria: { hidden: 'true' } }, '★'.repeat(st), h('span.off', '★'.repeat(3 - st))) : null);
    grid.appendChild(node);
  }
  el.appendChild(h('section.card', grid));
  el.appendChild(h('p.note', { style: { marginTop: '14px' } }, `⚡ ${t('jr.kindName.sprint')} · 👑 ${t('jr.kindName.boss')}`));
  return { el, nav: 'journey' };
});

export function openLevel(L) {
  const data = app.data;
  const { info, cfg } = journeyRain(L);
  const st = data.journey.stars[L] || 0;
  const best = data.journey.best[L];
  const goal = info.kind === 'sprint' ? t('jrr.sprint', { n: info.target, s: info.timeLimitMs / 1000 })
    : info.kind === 'boss' ? t('jrr.boss', { n: info.target }) : t('jrr.classic', { n: info.target });
  const ops = Object.keys(cfg.tiers).map((o) => t('op.' + o)).join(' · ') + (cfg.specials ? ' · ⭐❄️⚡' : '');
  app.modal((box, close) => {
    box.append(
      h('h2', `${t('jr.levelN', { n: L })} ${info.kind === 'boss' ? '👑' : info.kind === 'sprint' ? '⚡' : ''}`),
      h('p.note', { style: { fontWeight: 800, color: 'var(--ink)', fontSize: '1.05rem' } }, goal),
      h('div.pill-row', { style: { marginBottom: '12px' } }, h('span.chip', ops), h('span.chip.gold', '★'.repeat(st) + '☆'.repeat(3 - st))),
      h('p.note', t('jrr.rule.' + (info.kind === 'sprint' ? 'sprint' : 'hearts'))),
      best ? h('p.note', t('jr.best', { n: num(best) })) : null,
      h('div.stack',
        h('button.btn.primary.block.lg', { 'data-autofocus': true, id: 'startLevel', on: { click: () => { sfx.tap(); close(); app.go('rainPlay', { kind: 'journey', args: { level: L } }); } } }, icon('play'), t('jr.play')),
        h('button.btn.ghost.block', { on: { click: () => close() } }, t('common.close'))));
  });
}
