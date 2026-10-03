/* =========================================================================
   شاشة اللعب العامة — تخدم: الرحلة، تحدي الوقت، البقاء، التدريب، الدروس،
   التحدي اليومي، الشرح التفاعلي، ودور اللاعب في تحدي صديق.
   حلقة اللعب: سؤال ← إجابة ← تغذية راجعة فورية ← نقاط/سلسلة ← سؤال جديد.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, clear, icon, mathEl, mathText, richText, num } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, buzz } from '../ui/audio.js';
import { floatText, replay, reducedMotion, confetti } from '../ui/fx.js';
import { t } from '../i18n.js';
import { createSession } from '../core/session.js';
import { recordAnswer } from '../core/progression.js';
import { normalizeDigits, parseAnswer } from '../core/numbers.js';
import { streakMultiplier } from '../core/scoring.js';
import { buildRun, finishRun, PERSISTED } from '../runs.js';

const FEEDBACK_MS = { correct: 520, correctFast: 320, wrong: 1500, wrongFast: 1050 };

registerScreen('play', (app, params) => gameScreen(app, params));

export function gameScreen(app, params) {
  const data = app.data;
  const kind = params.kind;
  let spec, meta, seed;
  if (params.custom) ({ spec, meta } = params.custom);
  else {
    const restoreSeed = params.restore ? ((params.restore.seed ^ Math.imul((params.restore.snap.state.index + 1), 2654435761)) >>> 0) : undefined;
    ({ spec, meta, seed } = buildRun(kind, params.args, data, restoreSeed));
    if (params.restore) seed = params.restore.seed;
  }
  const session = createSession(spec, params.restore ? params.restore.snap : null);
  const persist = !params.custom && PERSISTED.has(kind);
  const fast = meta.timed;

  let locked = true, typed = '', nextTimer = null, raf = 0, ended = false, lastSec = null, waitingNext = false, overlay = null, cdTimer = null;

  /* ---------------- البناء ---------------- */
  const el = h('main.game-view', { aria: { label: meta.label } });
  const scoreEl = h('span', num(0));
  const quitBtn = h('button.icon-btn', { aria: { label: kind === 'practice' ? t('game.endNow') : t('game.quit') }, on: { click: () => askQuit() } }, icon('close'));
  const pauseBtn = meta.pausable && !meta.tutorial
    ? h('button.icon-btn', { aria: { label: t('game.pause') }, on: { click: () => pause() } }, icon('pause'))
    : null;
  const skipTut = meta.tutorial ? h('button.btn.sm.ghost', { on: { click: () => endTutorial() } }, t('tut.skip')) : null;
  const centerSlot = h('div.grow');
  const hud = h('div.hud', quitBtn, centerSlot, pauseBtn, skipTut, h('div.score', { aria: { live: 'off' } }, scoreEl, h('small', t('game.score'))));
  const labelEl = h('span.label', meta.label);
  const livesEl = h('span.lives', { role: 'img' });
  const streakEl = h('span.chip.streak-chip', { hidden: true });
  const hudSub = h('div.hud-sub', labelEl, streakEl, livesEl);
  const coach = h('div');
  const qcard = h('section.qcard', { aria: { live: 'off' } });
  const feedback = h('div.feedback', { role: 'status', aria: { live: 'polite' } });
  const qzone = h('div.qzone', coach, qcard, feedback);
  const answerArea = h('div.answer-area');
  const live = h('div.sr-only', { aria: { live: 'polite' } });
  el.append(hud, hudSub, h('div.game-cols', qzone, answerArea), live);

  // شريط الوقت أو نقاط التقدّم
  let timerEl = null, timerFill = null, timerText = null, dotsEl = null;
  const hasGlobalTimer = spec.timeLimitMs != null;
  const hasQTimer = spec.perQuestionMs != null;
  if (hasGlobalTimer || hasQTimer) {
    timerFill = h('i');
    timerEl = h('div.timer', { role: 'timer' }, timerFill);
    timerText = h('span.timer-text', { aria: { hidden: 'true' } });
    centerSlot.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('div', { style: { flex: '1' } }, timerEl), timerText));
  }
  if (spec.totalQuestions && spec.totalQuestions <= 20) {
    dotsEl = h('div.progress-dots', { aria: { hidden: 'true' } }, ...Array.from({ length: spec.totalQuestions }, () => h('i')));
    if (hasGlobalTimer || hasQTimer) centerSlot.append(h('div', { style: { marginTop: '6px' } }, dotsEl)); else centerSlot.append(dotsEl);
  } else if (!hasGlobalTimer && !hasQTimer) {
    centerSlot.append(h('div.label', { style: { textAlign: 'center', fontWeight: 800 } }, h('span.qcount')));
  }
  if (meta.goalLabel) labelEl.textContent = meta.goalLabel;

  /* ---------------- HUD ---------------- */
  function paintHud(lostLife = false) {
    const S = session.state;
    scoreEl.textContent = num(S.score);
    if (S.lives != null) {
      clear(livesEl);
      const max = spec.lives;
      for (let i = 0; i < max; i++) {
        const ic = icon('heart', 'fill' + (i >= S.lives ? ' lost' : ''));
        if (lostLife && i === S.lives) ic.classList.add('lose-anim');
        livesEl.appendChild(ic);
      }
      livesEl.setAttribute('aria-label', t('a11y.lives', { n: S.lives }));
    }
    if (S.streak >= 2) {
      streakEl.hidden = false;
      clear(streakEl).append(icon('fire'), h('span', `${num(S.streak)}${streakMultiplier(S.streak) > 1 ? ' · ×' + num(streakMultiplier(S.streak).toFixed(1)).replace('.', locale_dec()) : ''}`));
    } else streakEl.hidden = true;
    if (dotsEl) {
      [...dotsEl.children].forEach((d, i) => {
        const a = S.answers.find((x) => x.i === i);
        d.className = a ? (a.skipped ? 'skip' : a.correct ? 'ok' : 'bad') : i === S.index ? 'cur' : '';
      });
    }
    const qc = el.querySelector('.qcount');
    if (qc) qc.textContent = t('game.questionOpen', { i: S.index + 1 });
    if (spec.goalCorrect) labelEl.textContent = t('game.goal', { c: S.correct, n: spec.goalCorrect });
  }
  const locale_dec = () => (app.settings.digits === 'arabic' ? '٫' : '.');

  function paintTimer(now) {
    if (!timerEl) return;
    let rem, total;
    if (hasGlobalTimer) { rem = session.remainingMs(now); total = spec.timeLimitMs; }
    else { rem = session.questionRemainingMs(now); total = session.questionLimitMs(); if (rem == null) return; }
    const f = Math.max(0, Math.min(1, rem / total));
    timerFill.style.transform = `scaleX(${f})`;
    const sec = Math.ceil(rem / 1000);
    timerText.textContent = num(sec);
    const warn = hasGlobalTimer ? sec <= 10 : f < 0.4;
    const danger = hasGlobalTimer ? sec <= 5 : f < 0.2;
    timerEl.classList.toggle('warn', warn && !danger);
    timerEl.classList.toggle('danger', danger);
    timerText.classList.toggle('danger', danger);
    if (sec !== lastSec) {
      lastSec = sec;
      timerEl.setAttribute('aria-label', t('a11y.timer', { n: sec }));
      if (danger && sec > 0 && session.phase === 'asking') sfx.tick();
    }
  }

  /* ---------------- عرض السؤال ---------------- */
  let inputs = [];
  function renderQuestion() {
    const q = session.question;
    if (!q) return;
    clear(qcard); clear(answerArea); clear(feedback);
    feedback.className = 'feedback';
    qcard.className = 'qcard';
    typed = ''; waitingNext = false; inputs = [];
    const fmtKey = q.topic === 'count' ? 'fmt.count' : 'fmt.' + q.format;
    qcard.setAttribute('aria-label', t(fmtKey));
    qcard.append(h('div.fmt', t(fmtKey)));
    if (q.format === 'compare') {
      const mk = (side, part, lab) => {
        const b = h('button.cmp-btn', { aria: { label: `${lab}: ${mathText(part.parts)}` }, on: { click: () => answer(side, b) } }, mathEl(part.parts, { size: 'md' }), h('span.cl', lab));
        inputs.push(b); return b;
      };
      const eqb = h('button.cmp-eq', { aria: { label: t('fmt.equal') }, on: { click: () => answer('equal', eqb) } }, '=', h('small', t('fmt.equal')));
      inputs.push(eqb);
      const L = mk('left', q.left, t('game.left')), R = mk('right', q.right, t('game.right'));
      qcard.append(h('div.compare', L, eqb, R));
      live.textContent = `${t(fmtKey)} ${mathText(q.left.parts)} ، ${mathText(q.right.parts)}`;
    } else {
      const blank = q.format === 'missing' || q.parts.some((p) => p.blank) ? h('span.blank', '?') : null;
      qcard.append(mathEl(q.parts, { dir: q.dir === 'ui' ? 'ui' : 'ltr', blankEl: blank }));
      live.textContent = `${t(fmtKey)}: ${mathText(q.parts)}`;
      if (q.format === 'choice') renderChoices(q);
      else renderKeypad(q);
    }
    if (!reducedMotion()) replay(qcard, 'in');
    paintHud();
    if (meta.tutorial) paintCoach(t(['tut.2', 'tut.3', 'tut.4'][session.index] || 'tut.2'));
    locked = false;
  }

  function renderChoices(q) {
    const grid = h('div.choices', { role: 'group', aria: { label: t('fmt.choice') } });
    q.choices.forEach((v, i) => {
      const b = h('button.choice', { data: { v: String(v) }, aria: { label: num(v) }, on: { click: () => answer(v, b) } }, h('span.kb', { aria: { hidden: 'true' } }, num(i + 1)), num(v));
      inputs.push(b); grid.appendChild(b);
    });
    answerArea.appendChild(grid);
  }

  let displayEl = null;
  function renderKeypad(q) {
    displayEl = h('div.display.empty', { role: 'status', aria: { live: 'polite', label: t('game.typeHere') } }, t('game.typeHere'));
    const kp = h('div.keypad', { role: 'group', aria: { label: t('game.typeHere') } });
    const key = (label, onPress, cls = '', aria = null) => {
      const b = h('button.key' + (cls ? '.' + cls : ''), { type: 'button', aria: { label: aria || (typeof label === 'string' ? label : null) }, on: { click: () => { onPress(); } } }, label);
      inputs.push(b); kp.appendChild(b); return b;
    };
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) key(num(d), () => typeKey(d), '', num(d));
    if (q.allowNegative) key('−', () => typeKey('-'), 'fn', t('game.neg'));
    else key('C', () => { typed = ''; paintTyped(); sfx.key(); }, 'fn', t('game.del'));
    key(num('0'), () => typeKey('0'), '', num('0'));
    key(icon('backspace'), () => { typed = typed.slice(0, -1); paintTyped(); sfx.key(); }, 'fn', t('game.del'));
    key(h('span', { style: { display: 'inline-flex', gap: '8px', alignItems: 'center' } }, icon('check'), t('game.check')), () => submitTyped(), 'go', t('game.check'));
    answerArea.append(displayEl, kp);
  }

  function paintTyped() {
    if (!displayEl) return;
    displayEl.classList.remove('bad', 'ok');
    const shown = typed ? num(typed === '-' ? '-' : typed).replace('-', '−') : '';
    if (!typed) { displayEl.classList.add('empty'); displayEl.textContent = t('game.typeHere'); }
    else { displayEl.classList.remove('empty'); displayEl.textContent = typed === '-' ? '−' : shown; }
    const blank = qcard.querySelector('.blank');
    if (blank && session.question?.format === 'missing') { blank.textContent = typed ? (typed === '-' ? '−' : shown) : '?'; blank.classList.toggle('filled', !!typed); }
  }

  function typeKey(k) {
    if (locked || session.phase !== 'asking') return;
    sfx.key();
    if (k === '-') typed = typed.startsWith('-') ? typed.slice(1) : '-' + typed;
    else { if (typed.replace('-', '').length >= 6) return; typed = (typed === '0' ? '' : typed === '-0' ? '-' : typed) + k; }
    paintTyped();
    // قبول تلقائي عند كتابة الإجابة الصحيحة (إعداد قابل للإيقاف)
    if (app.settings.autoSubmit !== false && parseAnswer(typed) === session.question.answer) {
      const want = String(session.question.answer);
      if (typed.replace(/^-?0+(?=\d)/, '') === want || parseAnswer(typed) === session.question.answer) answer(parseAnswer(typed), null);
    }
  }
  function submitTyped() {
    if (locked || session.phase !== 'asking') return;
    const v = parseAnswer(typed);
    if (v == null) { if (displayEl) { replay(displayEl, 'bad'); } sfx.wrong(); return; }
    answer(v, null);
  }

  /* ---------------- الإجابة ---------------- */
  function answer(value, srcEl) {
    if (locked || session.phase !== 'asking') return;
    const now = performance.now();
    const r = session.answer(value, now);
    if (!r.accepted) {
      if (r.reason === 'question-timeout' && r.result) return handleResult(r.result, null);
      if (session.phase === 'ended') return finish();
      return;
    }
    handleResult(r, srcEl);
  }

  function handleResult(r, srcEl) {
    locked = true;
    inputs.forEach((b) => { b.disabled = true; });
    const q = r.q;
    if (!params.custom && kind !== 'tutorial') {
      const res = recordAnswer(data, { ...r.entry });
      app.save();
      if (res.change > 0) { /* ارتفع مستوى العملية — يظهر في «تقدّمي» */ }
    }
    persistNow();
    paintHud(!r.correct && session.state.lives != null);

    // إبراز الإجابات على الأزرار
    if (q.format === 'choice') {
      inputs.forEach((b) => { if (Number(b.dataset.v) === q.answer) { b.classList.add('ok'); b.prepend(icon('check')); } });
      if (!r.correct && srcEl) { srcEl.classList.add('bad'); srcEl.prepend(icon('x')); }
    } else if (q.format === 'compare') {
      const btn = { left: inputs[1], equal: inputs[0], right: inputs[2] };
      btn[q.answer]?.classList.add('ok');
      if (!r.correct && srcEl) srcEl.classList.add('bad');
    } else if (displayEl) {
      displayEl.classList.add(r.correct ? 'ok' : 'bad');
      if (!r.correct) { const blank = qcard.querySelector('.blank'); if (blank) { blank.textContent = num(q.answer).replace('-', '−'); blank.classList.add('bad'); } }
      else { const blank = qcard.querySelector('.blank'); if (blank) { blank.classList.add('ok'); blank.textContent = num(q.answer).replace('-', '−'); } }
    }
    qcard.classList.add(r.correct ? 'correct' : 'wrong');
    qcard.appendChild(h('span.mark.' + (r.correct ? 'ok' : 'bad'), { aria: { hidden: 'true' } }, icon(r.correct ? 'check' : 'x')));
    clear(feedback);
    const answerText = q.format === 'compare' ? t('rel.' + q.answer) : num(q.answer).replace('-', '−');
    if (r.correct) {
      const praise = t('game.praise').split('|');
      feedback.className = 'feedback ok';
      feedback.append(h('span', `${praise[(session.state.correct + session.index) % praise.length]} ${r.points.total ? '+' + num(r.points.total) : ''}`));
      sfx.correct(); buzz(12);
      if (!reducedMotion()) replay(qcard, 'pop');
      if (r.points.total) floatText(scoreEl, '+' + num(r.points.total));
      const st = session.state.streak;
      if (st === 3 || st === 5 || st % 10 === 0) {
        sfx.combo(); buzz([10, 40, 10]);
        floatText(qcard, t('game.streakMsg', { n: st, m: streakMultiplier(st).toFixed(1) }), 'gold');
        replay(streakEl, 'bump');
      }
      if (meta.tutorial) paintCoach(t('game.correct'));
    } else {
      feedback.className = 'feedback bad';
      feedback.append(h('span', r.timeout ? t('game.timeout', { a: answerText }) : t('game.wrong', { a: answerText })));
      sfx.wrong(); buzz(r.timeout ? 120 : 60);
      if (!reducedMotion()) replay(qcard, 'shake');
      if (meta.explain && q.explain) feedback.append(h('div.explain', icon('info'), ' ', richText(q.explain.key, q.explain.p)));
      if (meta.tutorial) paintCoach(t('tut.oops', { a: answerText }));
    }
    live.textContent = r.correct ? t('a11y.correctAnswer') : `${t('a11y.wrongAnswer')}. ${t('game.wrong', { a: answerText })}`;

    if (r.endsRound) { nextTimer = setTimeout(() => goNext(), r.correct ? 700 : 1500); return; }
    if (!r.correct && (meta.explain || meta.tutorial)) {
      // في التدريب ننتظر اللاعب ليقرأ الشرح
      waitingNext = true;
      const nb = h('button.btn.primary.block.next-btn', { on: { click: () => goNext() } }, t('game.next'));
      answerArea.prepend(nb);
      nb.focus({ preventScroll: true });
      return;
    }
    const delay = r.correct ? (fast ? FEEDBACK_MS.correctFast : FEEDBACK_MS.correct) : (fast ? FEEDBACK_MS.wrongFast : FEEDBACK_MS.wrong);
    nextTimer = setTimeout(() => goNext(), delay);
  }

  function goNext() {
    clearTimeout(nextTimer); nextTimer = null;
    if (ended) return;
    if (session.phase !== 'feedback') return;
    const res = session.next(performance.now());
    if (res === 'ended') return finish();
    persistNow();
    renderQuestion();
  }

  /* ---------------- الحلقة ---------------- */
  function loop() {
    raf = requestAnimationFrame(loop);
    if (ended) return;
    const now = performance.now();
    if (session.phase === 'asking' || session.phase === 'feedback') {
      const ev = session.tick(now);
      if (ev?.type === 'ended') return finish();
      if (ev?.type === 'timeout') { handleResult(ev.result, null); }
    }
    paintTimer(now);
  }

  /* ---------------- الإيقاف والاستئناف ---------------- */
  function pause(reason = 'user') {
    if (ended || overlay) return;
    const now = performance.now();
    if (!session.pause(now)) return;
    clearTimeout(nextTimer); nextTimer = null;
    persistNow();
    qcard.classList.add('hidden-q');
    showPauseOverlay(reason);
  }
  function showPauseOverlay(reason) {
    const policy = spec.resumePolicy || 'swap';
    const note = kind === 'daily' ? t('game.pausedDaily') : policy === 'keep' ? t('game.pausedKeep') : t('game.pausedNote');
    overlay = h('div.overlay', { role: 'dialog', aria: { modal: 'true', label: t('game.paused') } },
      h('div.panel',
        h('div', { html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: 'think', size: 70, label: t('mascot.name') }) }),
        h('h2', t('game.paused')), h('p.note', note),
        h('div.stack',
          h('button.btn.primary.block.lg', { 'data-autofocus': true, on: { click: () => resume() } }, icon('play'), t('game.resume')),
          h('button.btn.ghost.block', { on: { click: () => askQuit(true) } }, kind === 'practice' ? t('game.endNow') : t('game.quit')))));
    document.body.appendChild(overlay);
    overlay.querySelector('[data-autofocus]').focus();
  }
  function closeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  function resume() {
    sfx.tap();
    closeOverlay();
    qcard.classList.remove('hidden-q');
    const r = session.resume(performance.now());
    if (r === 'ended') return finish();
    if (r === 'skipped') {
      renderQuestion();
      locked = true; inputs.forEach((b) => { b.disabled = true; });
      feedback.className = 'feedback bad';
      clear(feedback).append(h('span', t('game.skipped')));
      paintHud();
      persistNow();
      nextTimer = setTimeout(() => goNext(), 1400);
      return;
    }
    renderQuestion();
    persistNow();
  }

  /* ---------------- الخروج ---------------- */
  async function askQuit(fromOverlay = false) {
    if (ended) return;
    sfx.tap();
    if (meta.tutorial) return endTutorial();
    const isDailyOfficial = kind === 'daily' && params.args?.official;
    const wasRunning = session.phase === 'asking' || session.phase === 'feedback';
    if (!fromOverlay && wasRunning && meta.pausable) pause('quit');
    const body = kind === 'practice' ? t('game.quitPractice') : isDailyOfficial ? t('game.quitDaily') : t('game.quitBody');
    const ok = await app.confirm({ title: t('game.quitTitle'), body, ok: kind === 'practice' ? t('game.endNow') : t('game.quit'), cancel: t('game.keepPlaying'), danger: kind !== 'practice' });
    if (!ok) return;
    closeOverlay();
    if (kind === 'practice' || isDailyOfficial) {
      session.end('quit', performance.now());
      return finish();
    }
    abandon();
  }
  function abandon() {
    ended = true;
    cleanup();
    if (persist) app.store.clearActive(app.pid);
    if (params.custom?.onAbort) return params.custom.onAbort();
    app.back();
  }

  function endTutorial() {
    ended = true; cleanup();
    data.settings.tutorialDone = true; app.save();
    app.go('play', { kind: 'journey', args: { level: 1 } }, { replace: true });
  }

  function finish() {
    if (ended) return;
    ended = true;
    cleanup();
    const sum = session.summary(performance.now());
    if (persist) app.store.clearActive(app.pid);
    if (params.custom) return params.custom.onDone(sum);
    if (meta.tutorial) {
      data.settings.tutorialDone = true; app.save();
      sfx.win(); confetti({ count: 50 });
      return app.go('play', { kind: 'journey', args: { level: 1 } }, { replace: true });
    }
    const { view } = finishRun(kind, params.args, spec, sum, data);
    app.save();
    app.go('results', { view }, { replace: true });
  }

  function persistNow() {
    if (!persist || ended) return;
    app.store.saveActive(app.pid, { kind, args: params.args, seed, snap: session.snapshot(performance.now()), savedAt: Date.now() });
  }

  function paintCoach(text) {
    clear(coach).append(h('div.coach', h('span', { html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: 'happy', size: 54, label: t('mascot.name') }) }), h('div.bubble', text)));
  }

  /* ---------------- لوحة المفاتيح ---------------- */
  function onKey(e) {
    if (ended || document.querySelector('.modal-backdrop')) return;
    if (overlay) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resume(); } return; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); if (meta.pausable && !meta.tutorial) pause(); else askQuit(); return; }
    if (waitingNext && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goNext(); return; }
    if (locked || session.phase !== 'asking') return;
    const q = session.question;
    const k = normalizeDigits(e.key);
    if (q.format === 'choice') {
      if (/^[1-4]$/.test(k)) { e.preventDefault(); const b = inputs[+k - 1]; if (b) answer(Number(b.dataset.v), b); }
      return;
    }
    if (q.format === 'compare') {
      if (e.key === 'ArrowLeft') { e.preventDefault(); answer('left', inputs[1]); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); answer('right', inputs[2]); }
      else if (e.key === '=' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); answer('equal', inputs[0]); }
      return;
    }
    if (/^\d$/.test(k)) { e.preventDefault(); typeKey(k); }
    else if (k === '-' && q.allowNegative) { e.preventDefault(); typeKey('-'); }
    else if (e.key === 'Backspace') { e.preventDefault(); typed = typed.slice(0, -1); paintTyped(); }
    else if (e.key === 'Enter') { e.preventDefault(); submitTyped(); }
  }

  function cleanup() {
    cancelAnimationFrame(raf); raf = 0;
    clearTimeout(nextTimer); clearInterval(cdTimer);
    document.removeEventListener('keydown', onKey);
    closeOverlay();
    document.querySelectorAll('.countdown').forEach((x) => x.remove());
  }

  /* ---------------- البدء ---------------- */
  function begin() {
    if (session.phase === 'paused') {
      // جولة مستعادة بعد تحديث/إغلاق الصفحة
      paintHud();
      showPauseOverlay('restore');
      raf = requestAnimationFrame(loop);
      return;
    }
    const startNow = () => {
      session.start(performance.now());
      renderQuestion();
      persistNow();
      raf = requestAnimationFrame(loop);
    };
    if (meta.tutorial) paintCoach(t('tut.1'));
    if (!meta.countdown) return startNow();
    const steps = reducedMotion() ? [t('game.go')] : [num(3), num(2), num(1), t('game.go')];
    let i = 0;
    const cd = h('div.countdown', { aria: { hidden: 'true' } }, h('span'));
    document.body.appendChild(cd);
    live.textContent = t('game.ready');
    const show = () => {
      const s = cd.firstChild;
      s.textContent = steps[i];
      replay(s, 'x');
      (i === steps.length - 1 ? sfx.go : sfx.count)();
    };
    show();
    cdTimer = setInterval(() => {
      i++;
      if (i >= steps.length) { clearInterval(cdTimer); cd.remove(); return; }
      show();
      if (i === steps.length - 1) { startNow(); setTimeout(() => cd.remove(), 380); clearInterval(cdTimer); }
    }, 480);
    if (steps.length === 1) { setTimeout(() => cd.remove(), 300); startNow(); }
  }

  paintHud();
  document.addEventListener('keydown', onKey);

  return {
    el, session,
    afterMount: begin,
    destroy: () => { if (!ended) { persistNow(); } cleanup(); },
    onBack: () => { askQuit(); return true; },
    onHide: () => {
      if (ended) return;
      if (session.phase === 'asking' || session.phase === 'feedback') pause('hidden');
      else persistNow();
    },
  };
}
