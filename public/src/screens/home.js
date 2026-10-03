/* الشاشة الرئيسية: زر «العب الآن» واضح، المستوى والتقدّم وأفضل النتائج، التحدي اليومي، المهام، والأنماط. */
import { app, registerScreen } from '../app.js';
import { h, icon, num } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx } from '../ui/audio.js';
import { reducedMotion } from '../ui/fx.js';
import { t } from '../i18n.js';
import { levelFromXp, dailyStatus, todayStr } from '../core/progression.js';
import { WORLDS, worldOf, DAILY_COUNT, timeRecordKey } from '../core/modes.js';
import { createSession } from '../core/session.js';
import { nextJourneyLevel, buildRun, finishRun, PERSISTED } from '../runs.js';

registerScreen('home', (app) => {
  const data = app.data;
  const cos = data.cosmetics;
  const lv = levelFromXp(data.xp);
  const name = app.playerName;
  const el = h('main');

  // شريط اللاعب
  const xpFill = h('i', { style: { width: lv.pct * 100 + '%' } });
  el.appendChild(h('header.profile-bar',
    h('button.avatar', { aria: { label: t('nav.locker') }, on: { click: () => { sfx.tap(); app.go('locker'); } }, html: mascotSVG({ skin: cos.skin, acc: cos.acc, size: 40, label: t('mascot.name') }) }),
    h('div.who',
      h('div.name', name ? t('home.hello', { name }) : t('home.helloAnon')),
      h('div.lvl', h('span.lvl-badge', t('home.level', { n: lv.level })), h('div.bar.gold', { role: 'progressbar', aria: { valuenow: Math.round(lv.pct * 100), valuemin: 0, valuemax: 100, label: t('home.xp', { a: lv.into, b: lv.need }) } }, xpFill))),
    h('button.icon-btn', { aria: { label: t('nav.settings') }, 'data-go': 'settings', on: { click: () => { sfx.tap(); app.go('settings'); } } }, icon('gear'))));

  if (!app.store.persistent) el.appendChild(h('p.note.warn', { role: 'alert' }, '⚠️ ' + t('home.storageWarn')));
  if (app.migrated) { el.appendChild(h('p.note', { style: { color: 'var(--ok)' } }, t('prof.migrated', { n: app.migrated }))); app.migrated = 0; }

  // البطل: العب الآن
  const L = nextJourneyLevel(data);
  const w = WORLDS[worldOf(L)];
  const totalStars = Object.values(data.journey.stars).reduce((a, b) => a + b, 0);
  const bestMin = data.records[timeRecordKey(60, 'medium')]?.value;
  const ds = dailyStatus(data);
  const lines = [t('home.mascotLine1'), t('home.mascotLine2'), ds.done ? t('home.mascotLine2') : t('home.mascotLine3')];
  const rain = h('div.rainlines', { aria: { hidden: 'true' } });
  if (!reducedMotion()) for (let i = 0; i < 9; i++) rain.appendChild(h('i', { style: { left: (8 + i * 11) + '%', animationDelay: (i * 0.29) + 's', animationDuration: (2.2 + (i % 3) * 0.5) + 's' } }));
  const firstTime = !data.settings.tutorialDone && data.stats.rounds === 0;
  const playSub = firstTime ? t('home.playFirst') : data.journey.stars[100] && L === 100 ? t('home.allDone') : t('home.playSub', { n: L, world: t('world.' + w.key) });
  el.appendChild(h('section.hero', { aria: { label: t('home.play') } }, rain,
    h('div.hero-top',
      h('span.mascot-wrap', { html: mascotSVG({ skin: cos.skin, acc: cos.acc, mood: 'happy', size: 84, label: t('mascot.name') }) }),
      h('div', { style: { flex: '1' } },
        h('div.brand-mark', { dir: 'ltr' }, h('b', 'Math'), 'Clash'),
        h('div.bubble', lines[(new Date().getDate() + data.stats.rounds) % lines.length]))),
    h('button.btn.gold.play-btn', { id: 'playNow', on: { click: playNow } }, icon('play', 'fill'), t('home.play')),
    h('div.play-sub', playSub),
    h('div.hero-stats',
      h('div.hs', h('div.v', '★ ' + num(totalStars)), h('div.l', t('home.stars'))),
      h('div.hs', h('div.v', bestMin != null ? num(bestMin) : '—'), h('div.l', t('home.bestTime'))),
      h('div.hs', h('div.v', '🔥 ' + num(ds.streak)), h('div.l', t('home.streak'))))));

  function playNow() {
    sfx.tap();
    if (!data.settings.tutorialDone) return app.go('play', { kind: 'tutorial', args: {} });
    app.go('play', { kind: 'journey', args: { level: L } });
  }

  // التحدي اليومي
  const dots = h('div.streak-dots', { aria: { hidden: 'true' } }, ...Array.from({ length: 7 }, (_, i) => h('i' + (i < Math.min(7, ds.streak) ? '.on' : ''))));
  el.appendChild(h('section.section',
    h('button.daily-card' + (ds.done ? '.done' : ''), { id: 'dailyCard', on: { click: openDaily } },
      h('span.di', icon(ds.done ? 'check' : 'calendar')),
      h('span.dt',
        h('div.dn', t('daily.title')),
        h('div.dd', ds.done ? `${t('daily.done', { score: num(ds.result.score) })} · ${t('daily.comeBack')}` : t('daily.sub', { n: DAILY_COUNT })),
        dots),
      h('span.chip.gold', '🔥 ' + num(ds.streak)))));

  function openDaily() {
    sfx.tap();
    const today = todayStr();
    const st = dailyStatus(data, today);
    app.modal((box, close) => {
      box.append(h('h2', t('daily.title')),
        h('p.note', t('daily.sub', { n: DAILY_COUNT })),
        h('p.note', t('daily.leaveNote')),
        st.done ? h('p.note', { style: { color: 'var(--ok)', fontWeight: 800 } }, t('daily.done', { score: num(st.result.score) })) : null,
        h('div.stack',
          st.done
            ? h('button.btn.primary.block.lg', { 'data-autofocus': true, on: { click: () => { close(); app.go('play', { kind: 'daily', args: { date: today, official: false } }); } } }, icon('refresh'), t('daily.practice'))
            : h('button.btn.gold.block.lg', { 'data-autofocus': true, on: { click: () => { close(); app.go('play', { kind: 'daily', args: { date: today, official: true } }); } } }, icon('play', 'fill'), t('daily.start')),
          h('button.btn.ghost.block', { on: { click: () => close() } }, t('common.close'))));
    });
  }

  // مهام اليوم
  const ms = data.missions.list;
  const allDone = ms.length && ms.every((m) => m.done);
  const mbox = h('section.card.section', { aria: { label: t('home.missions') } }, h('h2.section-title', t('home.missions'), h('small', allDone ? t('home.missionsDone') : `${num(ms.filter((m) => m.done).length)}/${num(ms.length)}`)));
  for (const m of ms) {
    const fill = h('i', { style: { width: (m.progress / m.goal) * 100 + '%' } });
    mbox.appendChild(h('div.mission' + (m.done ? '.done' : ''),
      h('span.mi', m.done ? icon('check') : icon('target')),
      h('div.mt', t('m.' + m.id, { g: m.goal, op: m.op ? t('op.' + m.op) : '' }), h('div.bar.ok', { role: 'progressbar', aria: { valuenow: m.progress, valuemax: m.goal, valuemin: 0 } }, fill)),
      h('span.mx', m.done ? '✓' : `${num(m.progress)}/${num(m.goal)}`)));
  }
  el.appendChild(mbox);

  // الأنماط
  const rec = (k) => data.records[k]?.value;
  const card = (id, ic, color, title, sub, recordText, onClick, wide = false) => h('button.mode-card' + (wide ? '.wide' : ''), { id, style: { '--mc': color }, on: { click: () => { sfx.tap(); onClick(); } } },
    h('span.mi', icon(ic)), h('div', { style: { flex: wide ? '1' : null } }, h('div.mn', title), h('div.md', sub)), recordText ? h('span.mr', recordText) : null);
  const tRec = Math.max(...['easy', 'medium', 'hard'].map((d) => rec(timeRecordKey(60, d)) ?? -1));
  const sRec = Math.max(...['easy', 'medium', 'hard'].map((d) => rec('survival:' + d) ?? -1));
  el.appendChild(h('section.section', h('h2.section-title', t('home.modes')),
    h('div.mode-grid',
      card('modeJourney', 'map', '#38D6F5', t('mode.journey'), t('mode.journeySub'), `★ ${num(totalStars)}/${num(300)}`, () => app.go('journey'), true),
      card('modeTime', 'clock', '#FFC94A', t('mode.time'), t('mode.timeSub'), tRec >= 0 ? t('setup.record', { n: num(tRec) }) : null, () => app.go('setupTime')),
      card('modeSurvival', 'shield', '#FF7BB0', t('mode.survival'), t('mode.survivalSub'), sRec >= 0 ? t('setup.record', { n: num(sRec) }) : null, () => app.go('setupSurvival')),
      card('modePractice', 'target', '#3DDC97', t('mode.practice'), t('mode.practiceSub'), null, () => app.go('practice')),
      card('modeFriend', 'users', '#9B8CFF', t('mode.friend'), t('mode.friendSub'), null, () => app.go('friendSetup')),
      card('modeRain', 'drop', '#5FD3F5', t('mode.rain'), t('mode.rainSub'), null, () => app.go('rainSetup'), true))));

  return {
    el, nav: 'home',
    afterMount: () => {
      // استئناف جولة انقطعت (تحديث الصفحة أو إغلاق التطبيق)
      const active = app.store.loadActive(app.pid);
      if (active && PERSISTED.has(active.kind) && active.snap) offerResume(active);
    },
  };
});

function offerResume(active) {
  const official = active.kind === 'daily' && active.args?.official;
  const modeName = active.kind === 'lesson' ? t('mode.lesson') : t('mode.' + active.kind);
  app.modal((box, close) => {
    box.append(h('h2', t('game.resumeTitle')), h('p.note', t('game.resumeBody', { mode: modeName })),
      official ? h('p.note', t('game.quitDaily')) : null,
      h('div.stack',
        h('button.btn.primary.block.lg', { 'data-autofocus': true, on: { click: () => { close('resume'); app.go('play', { kind: active.kind, args: active.args, restore: { seed: active.seed, snap: active.snap } }); } } }, icon('play'), t('game.resumeBtn')),
        h('button.btn.ghost.block', { on: { click: () => { close('discard'); discard(active); } } }, official ? t('game.endNow') : t('game.discard'))));
  }, { dismissible: false });
}

function discard(active) {
  const official = active.kind === 'daily' && active.args?.official;
  app.store.clearActive(app.pid);
  if (!official) return;
  // التحدي اليومي الرسمي لا يُلغى: تُعتمد النتيجة الحالية
  try {
    const { spec } = buildRun('daily', active.args, app.data, active.seed);
    const s = createSession(spec, active.snap);
    s.end('quit', 0);
    const { view } = finishRun('daily', active.args, spec, s.summary(), app.data);
    app.save();
    app.go('results', { view });
  } catch (e) { console.error(e); }
}
