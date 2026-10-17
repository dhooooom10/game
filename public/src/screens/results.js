/* شاشة نهاية الجولة: النتيجة، النجوم، الدقة، التقدّم، المكافآت، ونصيحة للتحسّن. */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, buzz } from '../ui/audio.js';
import { countUp, confetti, reducedMotion } from '../ui/fx.js';
import { t } from '../i18n.js';
import { levelFromXp, xpForLevel, BADGES, recordEvent } from '../core/progression.js';
import { addSent, setMyAnswer, makeResultCode, ensureSocial, outcome } from '../core/social.js';
import { codeCard, codeLabel } from './friends.js';
import { TOTAL_LEVELS, WORLDS, worldOf } from '../core/modes.js';
import { findPath } from '../core/curriculum.js';
import { dailyShareText, shareText, shareUrl } from '../ui/share.js';
import { toast } from '../ui/fx.js';
import * as ads from '../net/ads.js';
import { speedText } from './rain.js';
import { BADGE_RULES, NATURAL_ENDS } from '../core/challenge.js';

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
  // «كدت تكسرها!» — أقوى دافع لمحاولة أخرى
  if (view.nearMiss) el.appendChild(h('div.near-miss', { id: 'nearMiss' }, '😱 ', view.nearMiss.journey ? t('res.nearJourney', { n: num(view.nearMiss.left) }) : t('res.nearMiss', { n: num(view.nearMiss.left) })));
  // شارة السرعة التي بلغتها
  if (view.speed && view.speed.x >= 1.15) {
    const tier = view.speed.tier;
    el.appendChild(h('div.speed-badge', { 'data-tier': String(tier) },
      h('span.sb-ic', ['💨', '🥉', '🥈', '🥇', '💎'][tier]),
      h('div.grow', h('div.sb-t', t('res.speedTier.' + tier), ' · ⚡ ', speedText(view.speed.x)),
        h('div.sb-d', view.speed.newBest ? t('res.speedBest') : t('res.speedPrev', { x: speedText(view.speed.prevBest) })))));
  }
  // القطرات الغامضة
  if (view.giftRewards?.length) {
    el.appendChild(h('div.gift-list', ...view.giftRewards.map((g) => h('span.chip' + (g.type === 'shield' ? '.ok' : '.gold'), g.type === 'shield' ? '🎁 🛡️ ' + t('shield.one') : g.type === 'pearls' ? '🎁 \u2066+' + num(g.n) + ' 💎\u2069' : '🎁 \u2066+' + num(g.xp) + ' XP\u2069'))));
  }
  if (view.pearlsEarned || view.boosted) el.appendChild(h('div.gift-list',
    view.pearlsEarned ? h('span.chip.gold', { id: 'pearlsEarned' }, '\u2066+' + num(view.pearlsEarned) + ' 💎\u2069 ', t('wal.earned')) : null,
    view.boosted ? h('span.chip.ok', '🚀 ', t('wal.boosted', { n: num(view.boosted) })) : null));
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

  // التقدّم المتبقي: مهام اليوم غير المكتملة، والبرق/الصامد إن كانت الجولة مؤهلة
  {
    const left = (data.missions.list || []).filter((m) => !m.done);
    const be = rw?.applied ? view.badgeEval : null;
    const rows = [];
    for (const m of left) rows.push(h('div.left-row', h('span', '🎯'), h('span.grow', t('m.' + m.id, { g: m.goal, op: m.op ? t('op.' + m.op) : '' })), h('b', `${num(m.progress)}/${num(m.goal)}`)));
    if (be) for (const id of ['speed20', 'survive25']) {
      if (data.badges[id] || !be[id]?.eligible) continue;
      const p = be[id].progress, R = BADGE_RULES[id];
      rows.push(h('div.left-row', h('span', id === 'speed20' ? '⚡' : '🛡️'), h('span.grow', t('badge.' + id), ' — ', id === 'speed20'
        ? t('lock.prog.speed20', { a: num(p.answered), n: num(R.minAnswered), acc: num(Math.round(p.acc * 100)), s: num(((p.avgMs || 0) / 1000).toFixed(1)) })
        : t('lock.prog.survive25', { a: num(p.correct), n: num(R.minCorrect) }))));
    }
    if (rows.length) el.appendChild(h('section.card.section.left-box', { id: 'progressLeft' }, h('h2.section-title', t('res.leftTitle')), ...rows));
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

  // تحدّي الأصدقاء بالرموز (بلا خادم)
  const answer = view.args?.answer;
  const codeKind = view.kind === 'custom' ? 'custom' : view.kind === 'journey' ? 'level' : null;
  const codeArgs = codeKind === 'custom' ? view.challenge : codeKind === 'level' ? { level: view.args.level, turbo: !!view.args.turbo } : null;
  const canChallenge = !answer && codeKind && view.seed != null && !view.revived && sum.score > 0;
  const missionChips = (ev) => (ev.missions?.length ? h('div.gift-list', ...ev.missions.map((m) => h('span.chip.ok', '✅ ', t('m.' + m.id, { g: m.goal, op: '' }))), ev.pearls ? h('span.chip.gold', '\u2066+' + num(ev.pearls) + ' 💎\u2069') : null) : null);
  let codeSlot = null;
  /** يحوّل هذه الجولة إلى رمز تحدٍّ: صديقك يلعب نفس القطرات ويحاول تجاوز نتيجتك */
  function challengeCard() {
    const { challenge, code } = addSent(data, { runId: view.seed, name: app.playerName, kind: codeKind, args: codeArgs, seed: view.seed, score: sum.score, popped: sum.popped });
    // مهمة «تحدَّ صديقًا»: مرة واحدة لكل تحدٍّ
    const ev = recordEvent(data, { id: 'fs:' + challenge.id, type: 'friendSent' });
    app.save();
    const label = codeLabel(codeKind, codeArgs);
    return h('div', codeCard({ id: 'challengeCode', title: '⚔️ ' + t('code.yourCode'), text: t('code.inviteText', { n: num(sum.score), label }), code }),
      h('p.note', t('code.afterShare')), missionChips(ev));
  }
  if (answer) {
    // لعبت تحدّي صديق: من فاز؟ + رمز نتيجتك لترسله له
    const done = NATURAL_ENDS.has(sum.endReason);
    const c = setMyAnswer(data, answer.id, { score: sum.score, popped: sum.popped }) || { mine: sum.score, minePopped: sum.popped };
    const o = outcome(sum.score, answer.score);
    const ev = done ? recordEvent(data, { id: 'fa:' + answer.id, type: 'friendAnswered' }) : { missions: [] };
    app.save();
    const code = makeResultCode({ uid: ensureSocial(data).uid, name: app.playerName, id: answer.id, score: c.mine, popped: c.minePopped });
    el.appendChild(h('section.card.duel-card.' + o, { id: 'duelResult', 'data-outcome': o },
      h('div.t', o === 'win' ? '🏆 ' : o === 'lose' ? '💧 ' : '🤝 ', t('code.vs.' + o, { name: answer.from })),
      h('div.duel-score', h('b', num(sum.score)), ' – ', h('span', num(answer.score)))));
    el.appendChild(codeCard({ id: 'resultCode', title: '📤 ' + t('code.sendBack', { name: answer.from }), text: t('code.resultText', { n: num(c.mine), name: answer.from }), code }));
    const mc = missionChips(ev); if (mc) el.appendChild(mc);
    if (o === 'win') view.celebrate = true;
  } else if (canChallenge && view.args?.makeCode) {
    codeSlot = challengeCard();
    el.appendChild(codeSlot);
  }

  // الأزرار: إعادة اللعب مباشرة دائمًا متاحة
  const btns = h('div.stack', { style: { marginTop: '18px' } });
  const replayBtn = (label, primary = true) => h('button.btn.block.lg' + (primary ? '.primary' : ''), { id: 'replayBtn', on: { click: () => {
    sfx.tap();
    if (view.engine === 'rain') { const { makeCode: _m, ...args } = view.args || {}; return app.go('rainPlay', { kind: view.kind, args: view.kind === 'daily' ? { ...args, official: false } : args, seed: args.answer ? view.seed : undefined }, { replace: true }); }
    app.go('play', { kind: view.kind, args: view.kind === 'daily' ? { ...view.args, official: false } : view.args }, { replace: true });
  } } }, icon('refresh'), label);
  if (view.kind === 'journey') {
    const L = view.args.level;
    if (view.passed && L < TOTAL_LEVELS) {
      btns.append(h('button.btn.block.lg.primary', { on: { click: () => { sfx.tap(); app.go('rainPlay', { kind: 'journey', args: { level: L + 1, turbo: !!view.args.turbo } }, { replace: true }); } } }, icon('play'), t('res.next')), replayBtn(t('res.retry'), false));
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
      shareText(dailyShareText({ date: view.args.date, score: view.score, sum }), shareUrl({ d: view.args.date }));
    } } }, icon('upload'), t('share.daily')), replayBtn(t('daily.practice'), false));
  } else {
    btns.append(replayBtn(t('res.retry')));
  }
  // تحدَّ صديقًا: يحوّل هذه الجولة نفسها إلى رمز يلعبه صديقك بنفس القطرات
  if (canChallenge && !codeSlot) {
    const good = view.celebrate || view.record || view.firstRecord || view.passed;
    const chBtn = h('button.btn.block' + (good ? '.challenge-hot' : ''), { id: 'challengeFriend', on: { click: () => {
      sfx.tap();
      codeSlot = challengeCard();
      chBtn.replaceWith(codeSlot);
      codeSlot.querySelector('[data-share]')?.click();
    } } }, '⚔️ ', good ? t('share.challengeHot', { n: num(sum.score) }) : t('share.challenge'));
    btns.insertBefore(chBtn, btns.children[1] || null);
  }
  btns.append(h('button.btn.block.ghost', { on: { click: () => { sfx.tap(); app.go('home', {}, { root: true }); } } }, icon('home'), t('res.home')));
  el.appendChild(btns);

  return {
    el,
    // عند مغادرة النتائج (التالي/إعادة/الرئيسية): إعلان بيني فقط إن سمحت حدود التكرار
    destroy: () => { ads.maybeInterstitial({ data, kind: view.kind }); },
    afterMount: () => {
      countUp(scoreEl, view.score, { fmt: num, ms: 1000 });
      if (view.celebrate || (rw && (rw.levelAfter > rw.levelBefore || rw.badges.length))) {
        setTimeout(() => { sfx.fanfare(); buzz([20, 60, 20]); confetti(); }, reducedMotion() ? 0 : 300);
      } else if (view.passed === false || view.nearMiss) { sfx.lose(); if (view.nearMiss) buzz([40, 30, 40]); }
      else sfx.win();
    },
  };
});
