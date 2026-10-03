/* شاشة «مطر المعادلات» الكلاسيكية. */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { sfx, buzz } from '../ui/audio.js';
import { floatText, replay, reducedMotion } from '../ui/fx.js';
import { t } from '../i18n.js';
import { createRain, RAIN_DIFFS, RAIN_LIVES } from '../core/rain.js';
import { recordAnswer, commitRound } from '../core/progression.js';
import { randomSeed } from '../core/rng.js';
import { normalizeDigits } from '../core/numbers.js';
import { topbar, seg, field } from './setup.js';
import { mathText } from '../ui/dom.js';


registerScreen('rainSetup', (app) => {
  const pref = app.data.prefs.rain;
  const rules = h('p.note');
  const recBox = h('div.chip.gold');
  const paint = () => {
    rules.textContent = t('rain.rules', { n: RAIN_DIFFS[pref.diff].target });
    const r = app.data.records['rain:' + pref.diff];
    recBox.textContent = r ? '🏆 ' + t('setup.record', { n: num(r.value) }) : t('setup.noRecord');
  };
  const el = h('main', topbar(t('mode.rain'), t('mode.rainSub')),
    h('section.card', field(t('setup.difficulty'), seg(['easy', 'medium', 'hard', 'expert'].map((d) => [d, t('diff.' + d)]), pref.diff, (v) => { pref.diff = v; app.save(); paint(); }, t('setup.difficulty'))), recBox),
    h('div', { style: { marginTop: '12px' } }, rules), h('p.note', t('rain.hint')),
    h('button.btn.primary.block.lg', { id: 'startRain', on: { click: () => { sfx.tap(); app.go('rainPlay', { diff: pref.diff }); } } }, icon('play'), t('common.start')));
  paint();
  return { el };
});

registerScreen('rainPlay', (app, { diff }) => {
  const data = app.data;
  const seed = randomSeed();
  const R = createRain(diff, seed);
  const S = R.state;
  let raf = 0, last = 0, ended = false, paused = false, overlay = null;
  const dropEls = new Map();

  const scoreEl = h('span', num(0));
  const livesEl = h('span.lives');
  const popsEl = h('span.chip');
  const sky = h('div.sky', { aria: { label: t('mode.rain') } }, h('div.ground'));
  const display = h('div.display.empty', { role: 'status', aria: { live: 'polite' } }, t('game.typeHere'));
  const live = h('div.sr-only', { aria: { live: 'polite' } });
  const kp = h('div.keypad');
  const key = (label, fn, cls = '', aria) => kp.appendChild(h('button.key' + (cls ? '.' + cls : ''), { type: 'button', aria: { label: aria || label }, on: { click: fn } }, label));
  for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) key(num(d), () => press(d));
  const negAllowed = Object.values(RAIN_DIFFS[diff].tiers).some((x) => x >= 8);
  if (negAllowed) key('−', () => press('-'), 'fn', t('game.neg')); else key('C', () => { S.typed = ''; paintTyped(); }, 'fn', t('game.del'));
  key(num('0'), () => press('0'));
  kp.appendChild(h('button.key.fn', { type: 'button', aria: { label: t('game.del') }, on: { click: () => press('back') } }, icon('backspace')));
  kp.appendChild(h('button.key.go', { type: 'button', aria: { label: t('game.check') }, on: { click: () => submit() } }, icon('check'), ' ', t('game.check')));

  const el = h('main.game-view',
    h('div.hud',
      h('button.icon-btn', { aria: { label: t('game.quit') }, on: { click: () => askQuit() } }, icon('close')),
      h('div.grow', h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' } }, livesEl, popsEl)),
      h('button.icon-btn', { aria: { label: t('game.pause') }, on: { click: () => pause() } }, icon('pause')),
      h('div.score', scoreEl, h('small', t('game.score')))),
    sky, h('div.answer-area', display, kp), live);

  function paintHud() {
    scoreEl.textContent = num(S.score);
    clear(livesEl);
    for (let i = 0; i < RAIN_LIVES; i++) livesEl.appendChild(icon('heart', 'fill' + (i >= S.lives ? ' lost' : '')));
    livesEl.setAttribute('aria-label', t('a11y.lives', { n: S.lives }));
    popsEl.textContent = '💧 ' + t('rain.pops', { a: num(S.popped), b: num(S.cfg.target) });
  }
  function paintTyped() {
    display.classList.remove('bad');
    if (!S.typed) { display.classList.add('empty'); display.textContent = t('game.typeHere'); }
    else { display.classList.remove('empty'); display.textContent = num(S.typed).replace('-', '−'); }
  }
  function handle(ev) {
    if (!ev) return;
    if (ev.type === 'pop') {
      sfx.pop(); buzz(10);
      const de = dropEls.get(ev.drop.id);
      if (de) { floatText(de, '+' + num(ev.points)); de.classList.add('popped'); setTimeout(() => de.remove(), 300); dropEls.delete(ev.drop.id); }
      recordAnswer(data, { op: ev.drop.q.op, topic: ev.drop.q.topic, tier: ev.drop.q.tier, format: 'input', correct: true, ms: null, adapt: false });
      live.textContent = t('a11y.correctAnswer');
      if (S.streak === 5 || S.streak % 10 === 0) sfx.combo();
    } else if (ev.type === 'wrong') {
      sfx.wrong(); buzz(50);
      replay(display, 'bad');
      live.textContent = t('a11y.wrongAnswer');
    }
    paintTyped(); paintHud();
  }
  function press(k) { if (ended || paused) return; sfx.key(); handle(R.type(k)); paintTyped(); }
  function submit() { if (ended || paused) return; handle(R.submit(true)); }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (paused || ended) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const H = sky.clientHeight, W = sky.clientWidth;
    for (const ev of R.update(dt)) {
      if (ev.type === 'spawn') {
        const de = h('div.drop', { aria: { label: mathText(ev.drop.q.parts.slice(0, 3)) } }, mathText(ev.drop.q.parts.slice(0, 3)));
        sky.appendChild(de); dropEls.set(ev.drop.id, de);
        live.textContent = mathText(ev.drop.q.parts.slice(0, 3));
      } else if (ev.type === 'miss') {
        sfx.splash(); buzz(100);
        const de = dropEls.get(ev.drop.id);
        if (de) { de.classList.add('splash'); setTimeout(() => de.remove(), 300); dropEls.delete(ev.drop.id); }
        replay(sky.querySelector('.ground'), 'hit');
        recordAnswer(data, { op: ev.drop.q.op, topic: ev.drop.q.topic, tier: ev.drop.q.tier, format: 'input', correct: false, ms: null, timeout: true, adapt: false });
        paintHud();
      } else if (ev.type === 'over') { return finish(); }
    }
    for (const d of S.drops) {
      const de = dropEls.get(d.id);
      if (!de || d.dead) continue;
      const w = de.offsetWidth || 80;
      const x = 6 + d.x * Math.max(0, W - w - 12);
      const y = 10 + d.y * (H - 10 - de.offsetHeight - 6);
      const tf = `translate(${x}px, ${y}px)`;
      de.style.transform = tf; de.style.setProperty('--tf', tf);
      de.classList.toggle('near', d.y > 0.72);
    }
  }

  function finish() {
    if (ended) return;
    ended = true; cleanup();
    const sm = R.summary();
    const round = { id: 'rain-' + seed, mode: 'rain', score: sm.score, correct: sm.correct, answered: sm.answered, bestStreak: sm.bestStreak, perOp: {}, passed: sm.won, diff, recordKey: 'rain:' + diff, recordValue: sm.score };
    const rewards = commitRound(data, round);
    data.stats.rainPops += sm.popped;
    app.save();
    const view = { kind: 'rain', args: { diff }, title: sm.won ? t('res.rainWin') : t('res.rainLose'), mood: sm.won ? 'cheer' : 'sad', score: sm.score, passed: sm.won, stars: null, notes: [],
      sum: { accuracy: sm.accuracy, correct: sm.correct, answered: sm.answered, skipped: 0, avgMs: null, bestStreak: sm.bestStreak, answers: [] },
      rewards, record: rewards.records.length && rewards.records[0].prev != null ? { prev: rewards.records[0].prev } : null, firstRecord: rewards.records.length && rewards.records[0].prev == null,
      tip: sm.won ? { key: 'tip.great' } : { key: 'tip.streak' } };
    if (view.record) view.celebrate = true;
    app.go('results', { view }, { replace: true });
  }
  function pause() {
    if (ended || paused) return;
    paused = true;
    sky.classList.add('hidden-q');
    sky.querySelectorAll('.drop').forEach((d) => { d.style.filter = 'blur(10px)'; });
    overlay = h('div.overlay', { role: 'dialog', aria: { modal: 'true' } }, h('div.panel', h('h2', t('game.paused')), h('p.note', t('game.pausedKeep')),
      h('div.stack', h('button.btn.primary.block.lg', { on: { click: resume } }, icon('play'), t('game.resume')), h('button.btn.ghost.block', { on: { click: () => askQuit() } }, t('game.quit')))));
    document.body.appendChild(overlay);
  }
  function resume() {
    overlay?.remove(); overlay = null; paused = false;
    sky.querySelectorAll('.drop').forEach((d) => { d.style.filter = ''; });
  }
  async function askQuit() {
    if (!paused) pause();
    const ok = await app.confirm({ title: t('game.quitTitle'), body: t('game.quitBody'), ok: t('game.quit'), cancel: t('game.keepPlaying'), danger: true });
    if (!ok) return;
    ended = true; cleanup(); app.back();
  }
  function onKey(e) {
    if (ended || document.querySelector('.modal-backdrop')) return;
    if (paused) { if (e.key === 'Enter') resume(); return; }
    const k = normalizeDigits(e.key);
    if (/^\d$/.test(k)) { e.preventDefault(); press(k); }
    else if (k === '-' && negAllowed) press('-');
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') pause();
  }
  function cleanup() { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); overlay?.remove(); }
  document.addEventListener('keydown', onKey);
  paintHud();
  return {
    el, rain: R,
    afterMount: () => { last = performance.now(); raf = requestAnimationFrame(loop); if (reducedMotion()) { /* الحركة ضرورية هنا لكنها بطيئة وواضحة */ } },
    destroy: cleanup,
    onBack: () => { askQuit(); return true; },
    onHide: () => pause(),
  };
});
