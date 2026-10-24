/* الشاشة الرئيسية — بسيطة: زر «العب الآن» كبير، التحدي اليومي و«تحدّيك الخاص»، وسطر لمهام اليوم. */
import { app, registerScreen } from '../app.js';
import { h, icon, num } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx } from '../ui/audio.js';
import { reducedMotion, toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import { levelFromXp, dailyStatus, todayStr, shieldsNeeded } from '../core/progression.js';
import * as ads from '../net/ads.js';
import { WORLDS, worldOf, DAILY_COUNT } from '../core/modes.js';
import { createSession } from '../core/session.js';
import { isNativeApp, PLAY_URL } from '../config.js';
import { nextJourneyLevel, buildRun, finishRun, buildRainRun, finishRainRun, MAX_SHIELDS, migrateActiveRun, challengeLabel, validActive } from '../runs.js';
import { normalizeChallenge, COMPLETE_MIN_CORRECT } from '../core/challenge.js';
import { replayRain } from '../core/rain.js';

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
    h('button.pearl-chip', { id: 'homePearls', type: 'button', aria: { label: t('wal.balance') }, on: { click: () => { sfx.tap(); app.go('shop'); } } }, '💎 ', num(data.pearls || 0), h('span.plus', '+'))));

  if (!app.store.persistent) el.appendChild(h('p.note.warn', { role: 'alert' }, '⚠️ ' + t('home.storageWarn')));
  // زائر من رابط على جوال Android في المتصفح: دعوة هادئة لتحميل التطبيق (يمكن إخفاؤها)
  if (!isNativeApp() && /Android/i.test(navigator.userAgent) && !localStorage.getItem('mc_hideApp') && data.stats.rounds >= 1) {
    const bar = h('a.getapp', { href: PLAY_URL, target: '_blank', rel: 'noopener' },
      h('span.ga-i', '▶'), h('span.ga-t', h('b', t('share.getApp')), h('small', t('share.getAppSub'))),
      h('button.ga-x', { type: 'button', aria: { label: t('common.close') }, on: { click: (e) => { e.preventDefault(); e.stopPropagation(); try { localStorage.setItem('mc_hideApp', '1'); } catch { /* ignore */ } bar.remove(); } } }, '✕'));
    el.appendChild(bar);
  }
  if (app.migrated) { el.appendChild(h('p.note', { style: { color: 'var(--ok)' } }, t('prof.migrated', { n: app.migrated }))); app.migrated = 0; }

  // البطل: العب الآن
  const L = nextJourneyLevel(data);
  const w = WORLDS[worldOf(L)];
  const totalStars = Object.values(data.journey.stars).reduce((a, b) => a + b, 0);
  const ds = dailyStatus(data);
  const rain = h('div.rainlines', { aria: { hidden: 'true' } });
  if (!reducedMotion()) for (let i = 0; i < 9; i++) rain.appendChild(h('i', { style: { left: (8 + i * 11) + '%', animationDelay: (i * 0.29) + 's', animationDuration: (2.2 + (i % 3) * 0.5) + 's' } }));
  const firstTime = !data.settings.tutorialDone && data.stats.rounds === 0;
  const playSub = firstTime ? t('home.playFirst') : data.journey.stars[100] && L === 100 ? t('home.allDone') : t('home.playSub', { n: L, world: t('world.' + w.key) });
  // بطاقة «جولة لم تكتمل» (تُملأ بعد الرسم إن وُجدت جولة محفوظة صالحة)
  const resumeSlot = h('div', { id: 'resumeSlot' });
  el.appendChild(resumeSlot);
  el.appendChild(h('section.hero', { aria: { label: t('home.play') } }, rain,
    h('span.mascot-wrap.hero-mascot', { html: mascotSVG({ skin: cos.skin, acc: cos.acc, mood: 'happy', size: 110, label: t('mascot.name') }) }),
    h('button.btn.gold.play-btn', { id: 'playNow', on: { click: playNow } }, icon('play', 'fill'), t('home.play')),
    h('div.play-sub', playSub, totalStars ? ' · ★ ' + num(totalStars) : '')));

  function playNow() {
    sfx.tap();
    if (!data.settings.tutorialDone) return app.go('rainPlay', { kind: 'tutorial', args: {} });
    app.go('rainPlay', { kind: 'journey', args: { level: L } });
  }

  // بطاقتان فقط: التحدي اليومي و«تحدّيك الخاص»
  el.appendChild(h('section.section.quick-grid',
    h('button.quick-card' + (ds.done ? '.done' : ''), { id: 'dailyCard', type: 'button', on: { click: openDaily } },
      h('span.qc-ic', ds.done ? '✅' : '📅'), h('span.qc-t', t('daily.title')), ds.streak ? h('span.qc-n', '🔥' + num(ds.streak)) : null),
    h('button.quick-card', { id: 'modeCustom', type: 'button', on: { click: () => { sfx.tap(); app.go('setupCustom'); } } },
      h('span.qc-ic', '🎛️'), h('span.qc-t', t('mode.custom')))));

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

  // مهام اليوم: سطر واحد يفتح القائمة
  const ms = data.missions.list || [];
  const doneN = ms.filter((m) => m.done).length;
  const mFill = h('i', { style: { width: (ms.length ? doneN / ms.length : 0) * 100 + '%' } });
  el.appendChild(h('button.missions-row.section', { id: 'missionsRow', type: 'button', on: { click: openMissions } },
    h('span.mr-ic', doneN === ms.length && ms.length ? '🏆' : '🎯'),
    h('span.grow', h('b', t('home.missions')), h('div.bar.ok', { role: 'progressbar', aria: { valuenow: doneN, valuemax: ms.length, valuemin: 0 } }, mFill)),
    h('span.mx', `${num(doneN)}/${num(ms.length)}`)));
  function openMissions() {
    sfx.tap();
    app.modal((box, close) => {
      box.append(h('h2', '🎯 ', t('home.missions')));
      for (const m of ms) {
        const fill = h('i', { style: { width: (m.progress / m.goal) * 100 + '%' } });
        box.append(h('button.mission' + (m.done ? '.done' : ''), { type: 'button', 'data-mission': m.id, disabled: m.done,
          aria: { label: t('m.' + m.id, { g: m.goal, op: m.op ? t('op.' + m.op) : '' }) + (m.done ? ' ✓' : '') },
          on: { click: () => { sfx.tap(); close(); goMission(m); } } },
          h('span.mi', m.done ? icon('check') : icon('target')),
          h('div.mt', t('m.' + m.id, { g: m.goal, op: m.op ? t('op.' + m.op) : '' }), h('div.md', t('mr.' + m.id, { n: COMPLETE_MIN_CORRECT })),
            h('div.bar.ok', { role: 'progressbar', aria: { valuenow: m.progress, valuemax: m.goal, valuemin: 0 } }, fill)),
          h('span.mx', m.done ? '✓' : `${num(m.progress)}/${num(m.goal)}`)));
      }
      box.append(h('p.note', '💎 ', t('home.missionsReward')), h('button.btn.ghost.block', { on: { click: () => close() } }, t('common.close')));
    });
  }
  function goMission(m) {
    const ch = (mode) => app.go('setupCustom', { mode });
    switch (m.id) {
      case 'time1': return ch('time');
      case 'survive1': return ch('survival');
      case 'custom1': return ch('custom');
      case 'daily1': return openDaily();
      case 'friend1': return app.go('friends');
      case 'weak10': return app.go('play', { kind: 'practice', args: { opts: { topics: [m.op || 'add'], level: 'auto', format: 'mixed', timer: false, length: 10 } } });
      case 'acc90': case 'streak8': case 'correct20': return ch('time');
      default: return playNow();
    }
  }

  return {
    el, nav: 'home',
    afterMount: () => {
      // استئناف جولة انقطعت (تحديث الصفحة أو إغلاق التطبيق)
      // جولة محفوظة من إصدار قديم (الوقت/البقاء المستقلان) ← «تحدّيك الخاص» بنفس القواعد، أو تُلغى إن تعذّر ذلك
      let active = app.store.loadActive(app.pid);
      const migrated = migrateActiveRun(active);
      if (migrated !== active) { if (migrated) app.store.saveActive(app.pid, migrated); else app.store.clearActive(app.pid); active = migrated; }
      if (!active) return;
      // لقطة تالفة أو غير مفهومة ← تُحذف بهدوء (لا تمنع فتح اللعبة أبدًا)
      if (!validActive(active)) { app.store.clearActive(app.pid); return; }
      try { resumeSlot.replaceChildren(resumeCard(active, resumeSlot)); } catch (e) { console.error(e); app.logError?.(e, 'resume-card'); app.store.clearActive(app.pid); }
    },
  };
});

/** بطاقة هادئة في الرئيسية بدل نافذة تعترض اللاعب: «أكمل ▶» أو «✕» لتجاهلها */
function resumeCard(active, slot) {
  const official = active.kind === 'daily' && active.args?.official;
  const modeName = active.kind === 'lesson' ? t('mode.lesson') : active.kind === 'custom' ? challengeLabel(normalizeChallenge(active.args))
    : active.kind === 'levelDuel' || active.kind === 'journey' ? t('jr.levelN', { n: active.args.level }) : t('mode.' + active.kind);
  const ago = active.savedAt ? Math.max(0, Math.round((Date.now() - active.savedAt) / 60000)) : null;
  const when = ago == null ? '' : ago < 1 ? t('resume.now') : ago < 60 ? t('resume.min', { n: num(ago) }) : ago < 1440 ? t('resume.hour', { n: num(Math.round(ago / 60)) }) : t('resume.day', { n: num(Math.round(ago / 1440)) });
  const resume = () => {
    sfx.tap();
    if (active.engine === 'rain') app.go('rainPlay', { kind: active.kind, args: active.args, restore: active });
    else app.go('play', { kind: active.kind, args: active.args, restore: { seed: active.seed, snap: active.snap } });
  };
  const dismiss = async () => {
    sfx.tap();
    // اليومي الرسمي لا يُلغى: تجاهله يعتمد نتيجته الحالية — نطلب تأكيدًا
    if (official && !(await app.confirm({ title: t('game.resumeTitle'), body: t('game.quitDaily'), ok: t('game.endNow'), danger: true }))) return;
    slot.replaceChildren();
    discard(active);
  };
  return h('section.resume-card.section', { id: 'resumeCard', role: 'region', aria: { label: t('game.resumeTitle') } },
    h('span.rc-ic', active.kind === 'daily' ? '📅' : '⏸️'),
    h('div.grow', h('div.t', t('game.resumeTitle')), h('div.d', modeName, when ? ' · ' + when : '')),
    h('button.btn.gold.sm', { id: 'resumeBtn', type: 'button', on: { click: resume } }, icon('play'), t('game.resumeBtn')),
    h('button.icon-btn', { id: 'resumeDismiss', type: 'button', aria: { label: official ? t('game.endNow') : t('game.discard') }, on: { click: dismiss } }, icon('close')));
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
