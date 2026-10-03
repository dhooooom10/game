/* شاشة نهاية الجولة: النتيجة، النجوم، الدقة، التقدّم، المكافآت، ونصيحة للتحسّن. */
import { app, registerScreen } from '../app.js';
import { h, icon, num } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, buzz } from '../ui/audio.js';
import { countUp, confetti, reducedMotion } from '../ui/fx.js';
import { t } from '../i18n.js';
import { levelFromXp, xpForLevel, BADGES } from '../core/progression.js';
import { TOTAL_LEVELS, WORLDS, worldOf } from '../core/modes.js';
import { findPath } from '../core/curriculum.js';
import { dailyShareText, shareText, shareUrl } from '../ui/share.js';
import { toast } from '../ui/fx.js';
import { track } from '../net/analytics.js';
import * as ads from '../net/ads.js';

registerScreen('results', (app, { view }) => {
  const data = app.data;
  const sum = view.sum;
  const el = h('main');
  const cos = data.cosmetics;

  // البطل: الشخصية + العنوان + النجوم + النقاط
  const hero = h('section.result-hero',
    h('div', { html: mascotSVG({ skin: cos.skin, acc: cos.acc, mood: view.mood, size: 96, label: t('mascot.name') }) }),
    h('h1', { 'data-autofocus': true }, view.title));
  if (view.stars != null) {
    const st = h('div.stars', { role: 'img', aria: { label: t('a11y.stars', { n: view.stars }) } });
    for (let i = 1; i <= 3; i++) st.appendChild(h('span.s' + (i <= view.stars ? '.on' : ''), icon('star', 'fill')));
    hero.appendChild(st);
  }
  if (view.record) hero.appendChild(h('div.record-banner', icon('trophy'), t('res.newRecord')));
  else if (view.firstRecord) hero.appendChild(h('div.chip.gold', icon('sparkle'), t('res.newRecord')));
  const scoreEl = h('div.big-score', num(0));
  hero.append(scoreEl, h('div.faint', t('res.score')));
  if (view.bonus) hero.appendChild(h('div.chip.ok', { style: { marginTop: '6px' } }, t('res.accBonus', { n: view.bonus })));
  if (view.record?.prev) hero.appendChild(h('div.faint', t('res.prevBest', { n: num(view.record.prev) })));
  el.appendChild(hero);
  for (const n of view.notes) el.appendChild(h('p.note', { style: { textAlign: 'center', margin: '6px 0 0' } }, n));

  // الإحصاءات
  const fmtSec = (ms) => ms == null ? '—' : t('common.sec', { n: (ms / 1000).toFixed(1) }).replace('.', app.settings.digits === 'arabic' ? '٫' : '.');
  const stats = [
    [num(Math.round(sum.accuracy * 100)) + (app.settings.digits === 'arabic' ? '٪' : '%'), t('res.accuracy')],
    [t('res.of', { a: num(sum.correct), b: num(sum.answered + sum.skipped) }), t('res.correct')],
    [fmtSec(sum.avgMs), t('res.avgTime')],
    [num(sum.bestStreak), t('res.bestStreak')],
  ];
  if (view.kind === 'journey' && view.info?.kind === 'sprint' && sum.timeLeftMs != null) stats[2] = [fmtSec(sum.timeLeftMs), t('res.timeLeft')];
  el.appendChild(h('div.stat-grid.four', ...stats.map(([v, l]) => h('div.stat', h('div.v', v), h('div.l', l)))));

  // المكافآت والخبرة
  const rw = view.rewards;
  if (rw && rw.applied) {
    const before = data.xp - rw.xp;
    const lvB = levelFromXp(before), lvA = levelFromXp(data.xp);
    const fill = h('i');
    const xpBox = h('div.card.xp-box',
      h('div.top', h('span', t('home.level', { n: lvA.level })), h('span', { style: { color: 'var(--accent)' } }, t('res.xp', { n: rw.xp }))),
      h('div.bar.gold', fill),
      h('div.faint', { style: { marginTop: '6px' } }, t('home.xp', { a: num(lvA.into), b: num(lvA.need) })));
    el.appendChild(xpBox);
    fill.style.width = (lvB.level < lvA.level ? 0 : lvB.pct * 100) + '%';
    setTimeout(() => { fill.style.width = lvA.pct * 100 + '%'; }, 350);
    // ضاعف الخبرة بإعلان بمكافأة (اختياري، مرة لكل جولة، لا يمس النتائج أو الترتيب)
    if (rw.xp > 0 && ads.rewardedReady() && !['lesson', 'tutorial'].includes(view.kind)) {
      const dbl = h('button.btn.sm.gold', { id: 'doubleXp', style: { marginTop: '8px' }, on: { click: async () => {
        dbl.disabled = true;
        if (await ads.showRewarded()) {
          data.xp += rw.xp; app.save(); sfx.reward();
          const lv = levelFromXp(data.xp);
          fill.style.width = lv.pct * 100 + '%';
          xpBox.querySelector('.top span').textContent = t('home.level', { n: lv.level });
          dbl.replaceWith(h('div.chip.ok', { style: { marginTop: '8px' } }, t('ads.doubled', { n: rw.xp })));
        } else dbl.disabled = false;
      } } }, '🎬 ', t('ads.doubleXp', { n: rw.xp }));
      xpBox.appendChild(dbl);
    }

    const items = [];
    if (rw.levelAfter > rw.levelBefore) items.push(['⬆️', t('res.levelUp', { n: rw.levelAfter }), '']);
    for (const b of rw.badges) { const B = BADGES.find((x) => x.id === b); items.push([B?.icon || '🏅', t('res.badge') + ': ' + t('badge.' + b), t('badge.' + b + 'D')]); }
    for (const m of rw.missions) items.push(['✅', t('res.mission'), t('m.' + m.id, { g: m.goal, op: m.op ? t('op.' + m.op) : '' })]);
    for (const u of rw.unlocks) { const [cat, id] = u.split(':'); items.push(['🎨', t('res.unlock'), `${t('lock.' + cat)}: ${t(cat + '.' + id)}`]); }
    if (items.length) {
      const box = h('section.section', h('h2.section-title', t('res.rewards')));
      items.forEach(([ic, tt, dd], i) => box.appendChild(h('div.reward', { style: { animationDelay: (0.4 + i * 0.12) + 's' } }, h('span.ri', ic), h('div', h('div.rt', tt), dd ? h('div.rd', dd) : null))));
      el.appendChild(box);
    }
  }

  // نصيحة التحسّن
  if (view.tip && view.kind !== 'tutorial') {
    const tipText = t(view.tip.key, { op: view.tip.op ? t('op.' + view.tip.op) : '' });
    const tipCard = h('section.card.tip', { style: { marginTop: '14px' } }, h('span.ti', icon('sparkle')), h('div', h('div', { style: { fontWeight: 800 } }, t('res.tipTitle')), h('div.note', tipText)));
    if (view.tip.op && ['add', 'sub', 'mul', 'div', 'order', 'frac', 'percent', 'power'].includes(view.tip.op)) {
      tipCard.lastChild.appendChild(h('button.btn.sm', { style: { marginTop: '8px' }, on: { click: () => { sfx.tap(); app.go('play', { kind: 'practice', args: { opts: { topics: [view.tip.op], level: 'auto', format: 'mixed', timer: false, length: 10 } } }, { replace: true }); } } }, icon('target'), t('tip.practiceBtn', { op: t('op.' + view.tip.op) })));
    }
    el.appendChild(tipCard);
  }

  // الأزرار: إعادة اللعب مباشرة دائمًا متاحة
  const btns = h('div.stack', { style: { marginTop: '18px' } });
  const replayBtn = (label, primary = true) => h('button.btn.block.lg' + (primary ? '.primary' : ''), { id: 'replayBtn', on: { click: () => {
    sfx.tap();
    if (view.engine === 'rain') return app.go('rainPlay', { kind: view.kind, args: view.kind === 'daily' ? { ...view.args, official: false } : view.args }, { replace: true });
    app.go('play', { kind: view.kind, args: view.kind === 'daily' ? { ...view.args, official: false } : view.args }, { replace: true });
  } } }, icon('refresh'), label);
  if (view.kind === 'journey') {
    const L = view.args.level;
    if (view.passed && L < TOTAL_LEVELS) {
      btns.append(h('button.btn.block.lg.primary', { on: { click: () => { sfx.tap(); app.go('rainPlay', { kind: 'journey', args: { level: L + 1 } }, { replace: true }); } } }, icon('play'), t('res.next')), replayBtn(t('res.retry'), false));
    } else btns.append(replayBtn(t('res.retry')));
    btns.append(h('button.btn.block.ghost', { on: { click: () => { sfx.tap(); app.go('world', { w: worldOf(L) }, { replace: true }); } } }, icon('map'), t('jr.worldN', { n: worldOf(L) + 1 }) + ' · ' + t('world.' + WORLDS[worldOf(L)].key)));
  } else if (view.kind === 'lesson') {
    const path = findPath(view.args.pid);
    const hasNext = view.passed && view.args.li + 1 < path.lessons.length;
    if (hasNext) btns.append(h('button.btn.block.lg.primary', { on: { click: () => { sfx.tap(); app.go('play', { kind: 'lesson', args: { pid: view.args.pid, li: view.args.li + 1 } }, { replace: true }); } } }, icon('play'), t('res.nextLesson')), replayBtn(t('res.retry'), false));
    else btns.append(replayBtn(t('res.retry')));
    btns.append(h('button.btn.block.ghost', { on: { click: () => { sfx.tap(); app.go('lessonPath', { pid: view.args.pid }, { replace: true }); } } }, t('common.back')));
  } else if (view.kind === 'daily') {
    btns.append(h('button.btn.block.lg.primary', { id: 'shareDaily', on: { click: () => {
      sfx.tap();
      track('share_daily');
      shareText(dailyShareText({ date: view.args.date, score: view.score, sum }), shareUrl({ d: view.args.date }));
    } } }, icon('upload'), t('share.daily')), replayBtn(t('daily.practice'), false));
  } else {
    btns.append(replayBtn(t('res.retry')));
  }
  // تحدَّ صديقًا: يحوّل هذه الجولة نفسها إلى رابط يلعبه صديقك بنفس القطرات
  if (view.replay && view.score > 0) {
    const good = view.celebrate || view.record || view.firstRecord || view.passed;
    const chBtn = h('button.btn.block' + (good ? '.challenge-hot' : ''), { id: 'challengeFriend', on: { click: async () => {
      sfx.tap(); chBtn.disabled = true;
      try {
        const net = await import('../net/online.js');
        await net.ensureIdentity(app);
        const r = await net.api('POST', '/api/challenges/local', view.replay);
        track('share_challenge');
        await shareText(t('share.challengeText', { n: num(r.score) }), shareUrl({ c: r.id }));
      } catch (e) { toast(e?.code === 'offline' ? t('net.offlineTitle') : t('share.failed')); }
      chBtn.disabled = false;
    } } }, '⚔️ ', good ? t('share.challengeHot', { n: num(view.score) }) : t('share.challenge'));
    btns.insertBefore(chBtn, btns.children[1] || null);
  }
  btns.append(h('button.btn.block.ghost', { on: { click: () => { sfx.tap(); app.go('home', {}, { root: true }); } } }, icon('home'), t('res.home')));
  el.appendChild(btns);

  return {
    el,
    // عند مغادرة النتائج (التالي/إعادة/الرئيسية): إعلان بيني فقط إن سمحت حدود التكرار
    destroy: () => { ads.maybeInterstitial({ data, kind: view.kind }); },
    afterMount: () => {
      track('round');
      countUp(scoreEl, view.score, { fmt: num, ms: 1000 });
      if (view.celebrate || (rw && (rw.levelAfter > rw.levelBefore || rw.badges.length))) {
        setTimeout(() => { sfx.fanfare(); buzz([20, 60, 20]); confetti(); }, reducedMotion() ? 0 : 300);
      } else if (view.passed === false) sfx.lose();
      else sfx.win();
    },
  };
});
