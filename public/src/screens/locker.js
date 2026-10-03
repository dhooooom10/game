/* الخزانة: الشارات (إنجازات حقيقية) والمظاهر التجميلية التي تُفتح بالتقدّم. */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx } from '../ui/audio.js';
import { toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import { BADGES, COSMETICS, isUnlocked, levelFromXp } from '../core/progression.js';
import { seg } from './setup.js';

const THEME_SWATCH = { rain: ['#0A1230', '#38D6F5'], dawn: ['#EEF4FF', '#0E9BD8'], oasis: ['#062824', '#3DDC97'], sunset: ['#2A0F2E', '#FF9F5A'], aurora: ['#07142A', '#7CF0D0'], gold: ['#1B1405', '#FFC94A'] };

registerScreen('locker', (app, params) => {
  const data = app.data;
  let tab = params.tab || 'badges';
  const el = h('main', h('header.topbar', h('h1', t('lock.title'), h('span.sub', t('home.level', { n: levelFromXp(data.xp).level }))),
    h('button.btn.sm.gold', { id: 'openShop', on: { click: () => { sfx.tap(); app.go('shop'); } } }, '🛍️ ', t('shop.title'))));
  const body = h('div', { style: { marginTop: '14px' } });
  el.append(seg([['badges', t('lock.badges')], ['looks', t('lock.looks')]], tab, (v) => { tab = v; app.stack[app.stack.length - 1].params = { tab: v }; paint(); }, t('lock.title')), body);

  function paint() {
    clear(body);
    if (tab === 'badges') {
      const got = BADGES.filter((b) => data.badges[b.id]).length;
      body.append(h('div.chip.gold', { style: { marginBottom: '12px' } }, t('lock.count', { a: num(got), b: num(BADGES.length) })));
      const grid = h('div.badge-grid');
      for (const b of BADGES) {
        const on = !!data.badges[b.id];
        grid.appendChild(h('div.badge' + (on ? '' : '.locked'), { role: 'img', aria: { label: `${t('badge.' + b.id)}: ${t('badge.' + b.id + 'D')}${on ? '' : ' — ' + t('common.locked')}` } },
          h('span.bi', b.icon), h('span.bn', t('badge.' + b.id)), h('span.bd', on ? t('lock.earned', { d: data.badges[b.id] }) : t('badge.' + b.id + 'D'))));
      }
      body.append(grid);
      return;
    }
    const cos = data.cosmetics;
    const preview = h('div', { html: mascotSVG({ skin: cos.skin, acc: cos.acc, mood: 'cheer', size: 92, label: t('mascot.name') }) });
    body.append(h('section.card.locker-preview', preview, h('div', h('div', { style: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem' } }, t('mascot.name')), h('p.note', t('lock.note')))));
    for (const cat of ['theme', 'skin', 'acc']) {
      const grid = h('div.cos-grid', { role: 'group', aria: { label: t('lock.' + cat) } });
      for (const it of COSMETICS[cat]) {
        const unlocked = isUnlocked(data, it);
        const sel = cos[cat] === it.id;
        let visual;
        if (cat === 'theme') { const [a, b] = THEME_SWATCH[it.id]; visual = h('span.sw', { style: { background: `linear-gradient(135deg, ${a} 55%, ${b} 55%)` } }); }
        else if (cat === 'skin') visual = h('span', { html: mascotSVG({ skin: it.id, acc: 'none', size: 40, label: '' }) });
        else visual = h('span', { html: mascotSVG({ skin: cos.skin, acc: it.id, size: 40, label: '' }) });
        const need = it.need.ent ? t(it.need.ent === 'season' ? 'shop.needSeason' : 'shop.needShop') : it.need.badge ? t('lock.needBadge', { b: t('badge.' + it.need.badge) }) : t('lock.needLevel', { n: it.need.level });
        grid.appendChild(h('button.cos' + (unlocked ? '' : '.locked'), {
          aria: { pressed: String(sel), label: `${t(cat + '.' + it.id)}${unlocked ? '' : ' — ' + need}` },
          on: { click: () => {
            if (!unlocked && it.need.ent) { sfx.tap(); return app.go('shop'); }
            if (!unlocked) { sfx.wrong(); return toast(need); }
            sfx.tap(); cos[cat] = it.id; app.save(); app.applyLook(); paint();
          } },
        }, visual, h('span', t(cat + '.' + it.id)), unlocked ? (sel ? h('span.need', icon('check'), t('lock.equipped')) : null) : h('span.need', icon('lock'), need)));
      }
      body.append(h('section.section', h('h2.section-title', t('lock.' + cat)), grid));
    }
  }
  paint();
  return { el, nav: 'locker' };
});
