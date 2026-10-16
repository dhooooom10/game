/* الشاشة الرئيسية: زر «العب الآن» واضح، المستوى والتقدّم وأفضل النتائج، التحدي اليومي، المهام، والأنماط. */
import { app, registerScreen } from '../app.js';
import { h, icon, num } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx } from '../ui/audio.js';
import { reducedMotion, toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import { levelFromXp, dailyStatus, todayStr, shieldsNeeded } from '../core/progression.js';
import { turboRow, turboOn } from '../ui/turbo.js';
import { speedText } from './rain.js';
import * as ads from '../net/ads.js';
import { WORLDS, worldOf, DAILY_COUNT } from '../core/modes.js';
import { createSession } from '../core/session.js';
import { isNativeApp, PLAY_URL } from '../config.js';
import { flag, countryName } from '../core/country.js';
import { track } from '../net/analytics.js';
import { nextJourneyLevel, buildRun, finishRun, PERSISTED, RAIN_PERSISTED, buildRainRun, finishRainRun, MAX_SHIELDS, migrateActiveRun, challengeLabel } from '../runs.js';
import { normalizeChallenge, COMPLETE_MIN_CORRECT } from '../core/challenge.js';
import { replayRain } from '../core/rain.js';
import { loadConfig, api } from '../net/online.js';
import { eventCard } from './online.js';

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
    data.online?.token ? h('button.icon-btn.bell', { id: 'homeBell', type: 'button', aria: { label: t('notif.title') }, on: { click: () => { sfx.tap(); app.go('notifications'); } } }, '🔔') : null,
    h('button.pearl-chip', { id: 'homePearls', type: 'button', aria: { label: t('wal.balance') }, on: { click: () => { sfx.tap(); app.go('shop'); } } }, '💎 ', num(data.pearls || 0), h('span.plus', '+')),
    h('button.icon-btn', { aria: { label: t('nav.settings') }, 'data-go': 'settings', on: { click: () => { sfx.tap(); app.go('settings'); } } }, icon('gear'))));

  if (!app.store.persistent) el.appendChild(h('p.note.warn', { role: 'alert' }, '⚠️ ' + t('home.storageWarn')));
  // زائر من رابط على جوال Android في المتصفح: دعوة هادئة لتحميل التطبيق (يمكن إخفاؤها)
  if (!isNativeApp() && /Android/i.test(navigator.userAgent) && !localStorage.getItem('mc_hideApp') && data.stats.rounds >= 1) {
    const bar = h('a.getapp', { href: PLAY_URL, target: '_blank', rel: 'noopener', on: { click: () => track('app_banner') } },
      h('span.ga-i', '▶'), h('span.ga-t', h('b', t('share.getApp')), h('small', t('share.getAppSub'))),
      h('button.ga-x', { type: 'button', aria: { label: t('common.close') }, on: { click: (e) => { e.preventDefault(); e.stopPropagation(); try { localStorage.setItem('mc_hideApp', '1'); } catch { /* ignore */ } bar.remove(); } } }, '✕'));
    el.appendChild(bar);
  }
  if (app.migrated) { el.appendChild(h('p.note', { style: { color: 'var(--ok)' } }, t('prof.migrated', { n: app.migrated }))); app.migrated = 0; }

  // البطل: العب الآن
  const L = nextJourneyLevel(data);
  const w = WORLDS[worldOf(L)];
  const totalStars = Object.values(data.journey.stars).reduce((a, b) => a + b, 0);
  const bestSpeed = data.speedBest && data.speedBest > 1 ? data.speedBest : null;
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
        h('div.brand-mark', h('b', t('app.name'))),
        h('div.bubble', lines[(new Date().getDate() + data.stats.rounds) % lines.length]))),
    h('button.btn.gold.play-btn', { id: 'playNow', on: { click: playNow } }, icon('play', 'fill'), t('home.play')),
    h('div.play-sub', playSub),
    h('div.hero-stats',
      h('div.hs', h('div.v', '★ ' + num(totalStars)), h('div.l', t('home.stars'))),
      h('div.hs', h('div.v', bestSpeed ? '⚡ ' + speedText(bestSpeed) : '—'), h('div.l', t('home.bestSpeed'))),
      h('div.hs', h('div.v', '🔥 ' + num(ds.streak)), h('div.l', t('home.streak'))))));

  // الأونلاين: قلب التطبيق — مباشرة تحت «العب الآن»
  const onBtn = (id, emoji, title, sub, fn) => h('button.on-btn', { id, type: 'button', on: { click: () => { sfx.tap(); fn(); } } },
    h('span.ob-ic', emoji), h('span.ob-t', title), h('span.ob-d', sub));
  el.appendChild(h('section.online-hero.section', { aria: { label: t('online.title') } },
    h('div.oh-top', h('span.oh-live', h('i'), t('home.onlineLive')), h('h2', t('online.title')),
      h('button.link', { id: 'modeOnline', type: 'button', on: { click: () => { sfx.tap(); app.go('online'); } } }, t('home.onlineAll'), ' ›')),
    h('div.oh-grid',
      onBtn('homeQuick', '⚔️', t('net.quick'), t('home.quickSub'), () => app.go('matchmaking')),
      onBtn('homeTurbo', '⚡', t('net.turbo'), t('home.turboSub'), () => app.go('matchmaking', { mode: 'turbo' })),
      onBtn('homeFriends', '🤝', t('fh.title'), t('home.friendsSub'), () => app.go('friendsHub')))));

  // التيربو ⚡: تسارع مرعب بأرقام سهلة — للرحلة
  el.appendChild(h('section.section', turboRow(app)));

  // بطاقات المناسبات والبطولات الجارية (تظهر عند توفر الاتصال فقط)
  const eventsSlot = h('div.events-slot');
  el.appendChild(eventsSlot);

  function playNow() {
    sfx.tap();
    if (!data.settings.tutorialDone) return app.go('rainPlay', { kind: 'tutorial', args: {} });
    app.go('rainPlay', { kind: 'journey', args: { level: L, turbo: turboOn(data) } });
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
      h('span.pill-col', h('span.chip.gold', '🔥 ' + num(ds.streak)), data.shields ? h('span.chip.shield-chip', { aria: { label: t('shield.count', { n: data.shields }) } }, '🛡️ ' + num(data.shields)) : null))));

  function openDaily() {
    sfx.tap();
    const today = todayStr();
    const st = dailyStatus(data, today);
    app.modal((box, close) => {
      box.append(h('h2', t('daily.title')),
        h('p.note', t('daily.sub', { n: DAILY_COUNT })),
        h('p.note', t('daily.leaveNote')),
        st.done ? h('p.note', { style: { color: 'var(--ok)', fontWeight: 800 } }, t('daily.done', { score: num(st.result.score) })) : null,
        shieldBox(close),
        h('div.stack',
          st.done
            ? h('button.btn.primary.block.lg', { 'data-autofocus': true, on: { click: () => { close(); app.go('rainPlay', { kind: 'daily', args: { date: today, official: false } }); } } }, icon('refresh'), t('daily.practice'))
            : h('button.btn.gold.block.lg', { 'data-autofocus': true, on: { click: () => { close(); app.go('rainPlay', { kind: 'daily', args: { date: today, official: true } }); } } }, icon('play', 'fill'), t('daily.start')),
          h('button.btn.ghost.block', { on: { click: () => close() } }, t('common.close'))));
    });
  }

  /** دروع السلسلة 🛡️: تحمي سلسلتك إن فاتك يوم. تُكسب من القطرات الغامضة أو بإعلان بمكافأة. */
  function shieldBox(close) {
    const need = shieldsNeeded(data);
    const box = h('div.shield-box', h('div.t', '🛡️ ', t('shield.title'), ' · ', num(data.shields || 0), '/', num(MAX_SHIELDS)), h('div.d', t('shield.sub')));
    if (need && need <= (data.shields || 0) && !dailyStatus(data).done) box.append(h('div.d.ok', t('shield.saving', { n: need })));
    if ((data.shields || 0) < MAX_SHIELDS && ads.rewardedReady()) {
      box.append(h('button.btn.sm.gold', { id: 'shieldAd', type: 'button', on: { click: async () => {
        if (!(await ads.showRewarded())) return;
        data.shields = Math.min(MAX_SHIELDS, (data.shields || 0) + 1); app.save(); sfx.reward();
        toast(t('shield.got')); close(); app.go('home', {}, { root: true });
      } } }, '🎬 ', t('shield.watch')));
    }
    return box;
  }

  // مهام اليوم
  const ms = data.missions.list;
  const allDone = ms.length && ms.every((m) => m.done);
  const mbox = h('section.card.section', { aria: { label: t('home.missions') } }, h('h2.section-title', t('home.missions'), h('small', allDone ? t('home.missionsDone') : `${num(ms.filter((m) => m.done).length)}/${num(ms.length)}`)));
  for (const m of ms) {
    const fill = h('i', { style: { width: (m.progress / m.goal) * 100 + '%' } });
    // المهمة زر يفتح نمطها الصحيح بالإعداد المناسب مباشرة
    mbox.appendChild(h('button.mission' + (m.done ? '.done' : ''), { type: 'button', 'data-mission': m.id, disabled: m.done,
      aria: { label: t('m.' + m.id, { g: m.goal, op: m.op ? t('op.' + m.op) : '' }) + (m.done ? ' ✓' : '') },
      on: { click: () => { sfx.tap(); goMission(m); } } },
      h('span.mi', m.done ? icon('check') : icon('target')),
      h('div.mt', t('m.' + m.id, { g: m.goal, op: m.op ? t('op.' + m.op) : '' }), h('div.md', t('mr.' + m.id, { n: COMPLETE_MIN_CORRECT })),
        h('div.bar.ok', { role: 'progressbar', aria: { valuenow: m.progress, valuemax: m.goal, valuemin: 0 } }, fill)),
      h('span.mx', m.done ? '✓' : `${num(m.progress)}/${num(m.goal)}`)));
  }
  el.appendChild(mbox);
  function goMission(m) {
    const ch = (mode) => app.go('setupCustom', { mode });
    switch (m.id) {
      case 'time1': return ch('time');
      case 'survive1': return ch('survival');
      case 'custom1': return ch('custom');
      case 'daily1': return openDaily();
      case 'online1': return app.go('online');
      case 'friend1': return app.go('friendsHub');
      case 'weak10': return app.go('play', { kind: 'practice', args: { opts: { topics: [m.op || 'add'], level: 'auto', format: 'mixed', timer: false, length: 10 } } });
      case 'acc90': case 'streak8': case 'correct20': return ch('time');
      default: return playNow();
    }
  }

  // الأنماط
  const card = (id, ic, color, title, sub, recordText, onClick, wide = false) => h('button.mode-card' + (wide ? '.wide' : ''), { id, style: { '--mc': color }, on: { click: () => { sfx.tap(); onClick(); } } },
    h('span.mi', icon(ic)), h('div', { style: { flex: wide ? '1' : null } }, h('div.mn', title), h('div.md', sub)), recordText ? h('span.mr', recordText) : null);
  el.appendChild(h('section.section', h('h2.section-title', t('home.modes')),
    h('div.mode-grid',
      card('modeJourney', 'map', '#38D6F5', t('mode.journey'), t('mode.journeySub'), `★ ${num(totalStars)}/${num(300)}`, () => app.go('journey'), true),
      card('modeCustom', 'bolt', '#FF9F5A', t('mode.custom'), t('mode.customSub'), null, () => app.go('setupCustom')),
      card('modeFriend', 'users', '#9B8CFF', t('fh.title'), t('fh.sub'), null, () => app.go('friendsHub')),
      card('modePractice', 'target', '#3DDC97', t('mode.practice'), t('mode.practiceSub'), null, () => app.go('practice'), true))));

  return {
    el, nav: 'home',
    afterMount: () => {
      // استئناف جولة انقطعت (تحديث الصفحة أو إغلاق التطبيق)
      if (navigator.onLine !== false) {
        loadConfig().then((c) => {
          for (const a of c.announcements.slice(0, 1)) eventsSlot.appendChild(h('div.announce', '📢 ', app.settings.lang === 'ar' ? a.text_ar : (a.text_en || a.text_ar)));
          for (const ev of c.events.slice(0, 2)) eventsSlot.appendChild(eventCard(ev));
        }).catch(() => {});
        // ترتيب دولتك هذا الأسبوع (للاعبين الذين دخلوا الأونلاين)
        if (data.online?.token) api('GET', '/api/nations').then((n) => {
          if (!n.mine?.country) return;
          eventsSlot.appendChild(h('button.nat-chip', { id: 'natChip', on: { click: () => { sfx.tap(); app.go('nations'); } } },
            h('span.nat-f', flag(n.mine.country)), h('span.grow', h('b', countryName(n.mine.country, app.settings.lang)), ' · ',
              n.mine.rank ? t('nat.rank', { n: num(n.mine.rank) }) : t('nat.noRank')), h('small', t('nat.myPoints', { n: num(n.mine.myPoints) }))));
        }).catch(() => {});
      }
      // تحديات الأصدقاء المنتظرة + مزامنة تقدّم الرحلة
      if (data.online?.token && navigator.onLine !== false) {
        import('./friendsHub.js').then((m) => m.syncProgress(app)).catch(() => {});
        api('GET', '/api/notifications').then((n) => {
          const b = document.getElementById('homeBell');
          if (b && n.unread) b.append(h('span.badge-count.floating', { id: 'bellBadge' }, num(n.unread)));
        }).catch(() => {});
        api('GET', '/api/inbox').then((ib) => {
          app._pendingChallenges = ib.pending || 0;   // لتذكير الجهاز عند مغادرة التطبيق
          if (!ib.pending) return;
          const b = document.getElementById('homeFriends');
          if (b) b.append(h('span.badge-count.floating', { id: 'friendsBadge' }, num(ib.pending)));
        }).catch(() => {});
      }
      // جولة محفوظة من إصدار قديم (الوقت/البقاء المستقلان) ← «تحدّيك الخاص» بنفس القواعد، أو تُلغى إن تعذّر ذلك
      let active = app.store.loadActive(app.pid);
      const migrated = migrateActiveRun(active);
      if (migrated !== active) { if (migrated) app.store.saveActive(app.pid, migrated); else app.store.clearActive(app.pid); active = migrated; }
      if (active && active.engine === 'rain' && RAIN_PERSISTED.has(active.kind)) offerResume(active);
      else if (active && PERSISTED.has(active.kind) && active.snap) offerResume(active);
    },
  };
});

function offerResume(active) {
  const official = active.kind === 'daily' && active.args?.official;
  const modeName = active.kind === 'lesson' ? t('mode.lesson') : active.kind === 'custom' ? challengeLabel(normalizeChallenge(active.args)) : t('mode.' + active.kind);
  app.modal((box, close) => {
    box.append(h('h2', t('game.resumeTitle')), h('p.note', t('game.resumeBody', { mode: modeName })),
      official ? h('p.note', t('game.quitDaily')) : null,
      h('div.stack',
        h('button.btn.primary.block.lg', { 'data-autofocus': true, on: { click: () => {
          close('resume');
          if (active.engine === 'rain') app.go('rainPlay', { kind: active.kind, args: active.args, restore: active });
          else app.go('play', { kind: active.kind, args: active.args, restore: { seed: active.seed, snap: active.snap } });
        } } }, icon('play'), t('game.resumeBtn')),
        h('button.btn.ghost.block', { on: { click: () => { close('discard'); discard(active); } } }, official ? t('game.endNow') : t('game.discard'))));
  }, { dismissible: false });
}

function discard(active) {
  const official = active.kind === 'daily' && active.args?.official;
  app.store.clearActive(app.pid);
  if (!official) return;
  // التحدي اليومي الرسمي لا يُلغى: تُعتمد النتيجة الحالية
  if (active.engine === 'rain') {
    const run = buildRainRun('daily', active.args, app.data);
    const { summary } = replayRain(run.cfg, run.seed, active.log, { endTick: active.tick });
    const { view } = finishRainRun('daily', active.args, { id: active.id, seed: run.seed }, summary, app.data);
    app.save();
    return app.go('results', { view });
  }
  try {
    const { spec } = buildRun('daily', active.args, app.data, active.seed);
    const s = createSession(spec, active.snap);
    s.end('quit', 0);
    const { view } = finishRun('daily', active.args, spec, s.summary(), app.data);
    app.save();
    app.go('results', { view });
  } catch (e) { console.error(e); }
}
