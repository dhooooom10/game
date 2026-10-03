/* =========================================================================
   تحدّي صديق على الجهاز نفسه.
   • بالتناوب: كل لاعب يلعب دوره ثم يمرّر الجهاز.
   • وجهًا لوجه: شاشة مقسومة، كلاكما في الوقت نفسه (أزرار اختيار للسرعة).
   الأسئلة متكافئة: لكل خانة نفس العملية والمستوى والشكل، والأرقام مختلفة.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear, mathEl, mathText } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, buzz } from '../ui/audio.js';
import { confetti, replay, reducedMotion } from '../ui/fx.js';
import { t } from '../i18n.js';
import { friendTemplates, friendSpec, friendWinner, DIFFICULTIES } from '../core/modes.js';
import { createSession } from '../core/session.js';
import { commitRound } from '../core/progression.js';
import { randomSeed } from '../core/rng.js';
import { topbar, seg, field } from './setup.js';

const COLORS = ['#38D6F5', '#FF7BB0'];

registerScreen('friendSetup', (app) => {
  const pref = app.data.prefs.friend;
  const el = h('main', topbar(t('mode.friend'), t('mode.friendSub')));
  const nameIn = (i) => h('input.input', { maxlength: 12, value: pref.names[i] || '', placeholder: t(i ? 'fr.p2Def' : 'fr.p1Def'), aria: { label: t(i ? 'fr.p2' : 'fr.p1') },
    on: { change: (e) => { pref.names[i] = e.target.value.trim().slice(0, 12); app.save(); } } });
  el.append(h('section.card',
    h('div.field', h('label', h('span', { style: { color: COLORS[0] } }, '● '), t('fr.p1')), nameIn(0)),
    h('div.field', h('label', h('span', { style: { color: COLORS[1] } }, '● '), t('fr.p2')), nameIn(1))),
  h('section.card',
    field(t('fr.layout'), seg([['turns', t('fr.turns')], ['split', t('fr.split')]], pref.layout, (v) => { pref.layout = v; app.save(); }, t('fr.layout')), `${t('fr.turns')}: ${t('fr.turnsSub')} · ${t('fr.split')}: ${t('fr.splitSub')}`),
    field(t('fr.count'), seg([[6, num(6)], [10, num(10)], [15, num(15)]], pref.count, (v) => { pref.count = +v; app.save(); }, t('fr.count'))),
    field(t('setup.difficulty'), seg(DIFFICULTIES.map((d) => [d, t('diff.' + d)]), pref.diff, (v) => { pref.diff = v; app.save(); }, t('setup.difficulty')))),
  h('p.note', t('fr.equal')), h('p.note', t('fr.tiebreak')),
  h('button.btn.primary.block.lg', { id: 'startFriend', on: { click: () => { sfx.tap(); startMatch(); } } }, icon('play'), t('common.start')));
  return { el };
});

function names() {
  const p = app.data.prefs.friend;
  return [p.names[0] || t('fr.p1Def'), p.names[1] || t('fr.p2Def')];
}

function startMatch(first = 0) {
  const pref = app.data.prefs.friend;
  const seed = randomSeed();
  const M = { seed, names: names(), first, layout: pref.layout, results: [null, null], diff: pref.diff,
    templates: friendTemplates({ count: pref.count, diff: pref.diff, seed }) };
  if (M.layout === 'split') {
    // الشاشة المقسومة: أزرار فقط (اختيار أو مقارنة) لتناسب نصف الشاشة
    M.templates = M.templates.map((tp) => ({ ...tp, format: tp.format === 'compare' ? 'compare' : 'choice' }));
    return app.go('friendSplit', { M });
  }
  app.go('friendHandoff', { M, p: first });
}

/* ---------------- بالتناوب ---------------- */
registerScreen('friendHandoff', (app, { M, p }) => {
  const other = M.results[1 - p];
  const el = h('main.handoff',
    h('div', { html: mascotSVG({ skin: p === 0 ? 'sky' : 'rose', acc: 'none', mood: 'happy', size: 90, label: t('mascot.name') }) }),
    h('p.note', t('fr.handTo', { name: M.names[p] })),
    h('div.big', { style: { color: COLORS[p] } }, t('fr.turnOf', { name: M.names[p] })),
    other ? h('p.chip.gold', t('fr.scoreToBeat', { n: num(other.score) })) : null,
    h('p.note', `${t('fr.count')}: ${num(M.templates.length)} · ${t('diff.' + M.diff)}`),
    h('button.btn.primary.block.lg', { 'data-autofocus': true, style: { marginTop: '18px' }, on: { click: () => {
      sfx.tap();
      const spec = friendSpec(M.templates, p, M.seed);
      app.go('play', { kind: 'friend', custom: {
        spec,
        meta: { label: `${t('mode.friend')} · ${M.names[p]}`, pausable: true, explain: false, timed: true, countdown: true },
        onDone: (sum) => {
          M.results[p] = sum;
          if (M.results[1 - p]) app.go('friendResult', { M }, { replace: true });
          else app.go('friendHandoff', { M, p: 1 - p }, { replace: true });
        },
        onAbort: () => app.go('friendSetup', {}, { replace: true }),
      } }, { replace: true });
    } } }, icon('play'), t('fr.ready')),
    h('button.btn.ghost.block', { on: { click: () => { sfx.tap(); app.back(); } } }, t('common.back')));
  return { el };
});

/* ---------------- النتيجة ---------------- */
registerScreen('friendResult', (app, { M }) => {
  const [a, b] = M.results;
  const w = friendWinner(a, b);
  if (!M.committed) {
    M.committed = true;
    commitRound(app.data, { id: 'friend-' + M.seed, mode: 'friend', score: 0, correct: 0, answered: 0, bestStreak: 0, perOp: {} });
    app.save();
  }
  const pct = (s) => num(Math.round(s.accuracy * 100)) + (app.settings.digits === 'arabic' ? '٪' : '%');
  const sec = (ms) => t('common.sec', { n: (ms / 1000).toFixed(1) }).replace('.', app.settings.digits === 'arabic' ? '٫' : '.');
  const pl = (i, s) => h('div.pl' + (w === i ? '.win' : ''), { style: { borderColor: w === i ? null : COLORS[i] } },
    h('div.pn', (w === i ? '👑 ' : '') + M.names[i]), h('div.ps', num(s.score)),
    h('div.pd', `${t('res.of', { a: num(s.correct), b: num(s.answered) })} · ${pct(s)}`), h('div.pd', sec(s.activeMs)));
  const el = h('main',
    h('section.result-hero',
      h('div', { html: mascotSVG({ skin: app.data.cosmetics.skin, acc: app.data.cosmetics.acc, mood: 'cheer', size: 90, label: t('mascot.name') }) }),
      h('h1', { 'data-autofocus': true }, w === -1 ? t('res.draw') : t('res.winner', { name: M.names[w] }))),
    h('div.vs-table', pl(0, a), h('strong', t('fr.vs')), pl(1, b)),
    h('p.note', { style: { textAlign: 'center', marginTop: '10px' } }, t('fr.tiebreak')),
    h('div.stack', { style: { marginTop: '18px' } },
      h('button.btn.primary.block.lg', { on: { click: () => { sfx.tap(); app.stack.pop(); startMatch(1 - M.first); } } }, icon('refresh'), t('res.rematch')),
      h('button.btn.ghost.block', { on: { click: () => { sfx.tap(); app.go('home', {}, { root: true }); } } }, icon('home'), t('res.home'))));
  return { el, afterMount: () => { sfx.fanfare(); confetti(); } };
});

/* ---------------- وجهًا لوجه (شاشة مقسومة) ---------------- */
registerScreen('friendSplit', (app, { M }) => {
  const el = h('main.game-view');
  const sessions = [0, 1].map((p) => createSession(friendSpec(M.templates, p, M.seed)));
  const panes = [], state = [{ locked: true, timer: null }, { locked: true, timer: null }];
  let ended = false, paused = false, overlay = null;

  const quit = h('button.icon-btn', { aria: { label: t('game.quit') }, on: { click: () => askQuit() } }, icon('close'));
  const pauseB = h('button.icon-btn', { aria: { label: t('game.pause') }, on: { click: () => pause() } }, icon('pause'));
  const mid = h('div.split-mid', quit, h('span.chip', `${M.names[1]} ${t('fr.vs')} ${M.names[0]}`), pauseB);

  for (const p of [1, 0]) {
    const sc = h('span.sc', num(0));
    const prog = h('span.faint');
    const card = h('div.qcard');
    const ans = h('div');
    const pane = h('section.split-pane' + (p === 1 && app.data.prefs.friend.flip !== false ? '.flip' : ''), { style: { '--pc': COLORS[p] }, aria: { label: M.names[p] } },
      h('div.ph', h('span', { style: { color: COLORS[p] } }, M.names[p]), prog, sc), card, ans);
    panes[p] = { pane, sc, prog, card, ans, inputs: [] };
  }
  el.append(h('div.split-wrap', panes[1].pane, mid, panes[0].pane), h('p.faint', { style: { textAlign: 'center', margin: '6px 0 0' } }, t('fr.splitHint')));

  function render(p) {
    const s = sessions[p], P = panes[p], q = s.question;
    clear(P.card); clear(P.ans); P.inputs = [];
    P.card.className = 'qcard';
    P.prog.textContent = `${num(s.index + 1)}/${num(M.templates.length)}`;
    P.sc.textContent = num(s.state.score);
    if (s.phase === 'ended') {
      P.card.append(h('div', { style: { fontWeight: 800 } }, t('fr.done')));
      return;
    }
    if (q.format === 'compare') {
      const mk = (side, part, lab) => { const b = h('button.cmp-btn', { aria: { label: `${lab}: ${mathText(part.parts)}` }, on: { click: () => answer(p, side, b) } }, mathEl(part.parts, { size: 'sm' })); P.inputs.push(b); return b; };
      const L = mk('left', q.left, t('game.left'));
      const eq = h('button.cmp-eq', { aria: { label: t('fmt.equal') }, on: { click: () => answer(p, 'equal', eq) } }, '=');
      P.inputs.push(eq);
      const R = mk('right', q.right, t('game.right'));
      P.card.append(h('div.fmt', t('fmt.compare')), h('div.compare', L, eq, R));
    } else {
      P.card.append(mathEl(q.parts, { dir: q.dir === 'ui' ? 'ui' : 'ltr' }));
      const grid = h('div.choices');
      q.choices.forEach((v) => { const b = h('button.choice', { data: { v: String(v) }, on: { click: () => answer(p, v, b) } }, num(v)); P.inputs.push(b); grid.appendChild(b); });
      P.ans.append(grid);
    }
    if (!reducedMotion()) replay(P.card, 'in');
    state[p].locked = false;
  }

  function answer(p, v, btn) {
    if (ended || paused || state[p].locked) return;
    const s = sessions[p];
    const r = s.answer(v, performance.now());
    if (!r.accepted) return;
    state[p].locked = true;
    const P = panes[p];
    P.inputs.forEach((b) => { b.disabled = true; });
    P.card.classList.add(r.correct ? 'correct' : 'wrong');
    if (btn) btn.classList.add(r.correct ? 'ok' : 'bad');
    if (!r.correct) {
      if (r.q.format === 'choice') P.inputs.find((b) => Number(b.dataset.v) === r.q.answer)?.classList.add('ok');
      else ({ left: P.inputs[0], equal: P.inputs[1], right: P.inputs[2] })[r.q.answer]?.classList.add('ok');
    }
    r.correct ? sfx.correct() : sfx.wrong();
    buzz(r.correct ? 10 : 50);
    P.sc.textContent = num(s.state.score);
    state[p].timer = setTimeout(() => {
      const res = s.next(performance.now());
      render(p);
      if (res === 'ended') checkEnd();
    }, r.correct ? 380 : 900);
  }

  function checkEnd() {
    if (sessions.every((s) => s.phase === 'ended') && !ended) {
      ended = true; cleanup();
      M.results = sessions.map((s) => s.summary());
      app.go('friendResult', { M }, { replace: true });
    }
  }
  function pause() {
    if (ended || paused) return;
    paused = true;
    const now = performance.now();
    sessions.forEach((s, p) => { clearTimeout(state[p].timer); s.pause(now); });
    el.querySelectorAll('.qcard').forEach((c) => c.classList.add('hidden-q'));
    overlay = h('div.overlay', { role: 'dialog', aria: { modal: 'true' } }, h('div.panel', h('h2', t('game.paused')), h('p.note', t('game.pausedNote')),
      h('div.stack', h('button.btn.primary.block.lg', { on: { click: resume } }, t('game.resume')), h('button.btn.ghost.block', { on: { click: () => askQuit() } }, t('game.quit')))));
    document.body.appendChild(overlay);
  }
  function resume() {
    overlay?.remove(); overlay = null; paused = false;
    const now = performance.now();
    sessions.forEach((s, p) => { const r = s.resume(now); render(p); if (r === 'ended') checkEnd(); });
  }
  async function askQuit() {
    if (!paused) pause();
    const ok = await app.confirm({ title: t('game.quitTitle'), body: t('game.quitBody'), ok: t('game.quit'), cancel: t('game.keepPlaying'), danger: true });
    if (!ok) return;
    ended = true; cleanup(); app.back();
  }
  function onKey(e) {
    if (ended || paused || document.querySelector('.modal-backdrop')) return;
    const map0 = { 1: 0, 2: 1, 3: 2, 4: 3 }, map1 = { 7: 0, 8: 1, 9: 2, 0: 3 };
    const k = e.key;
    for (const [p, map] of [[0, map0], [1, map1]]) {
      if (k in map) { const b = panes[p].inputs[map[k]]; if (b && !b.disabled) { e.preventDefault(); b.click(); } }
    }
    if (k === 'Escape') pause();
  }
  function cleanup() { state.forEach((s) => clearTimeout(s.timer)); document.removeEventListener('keydown', onKey); overlay?.remove(); }
  document.addEventListener('keydown', onKey);
  return {
    el,
    afterMount: () => { const now = performance.now(); sessions.forEach((s, p) => { s.start(now); render(p); }); },
    destroy: cleanup,
    onBack: () => { askQuit(); return true; },
    onHide: () => pause(),
  };
});
