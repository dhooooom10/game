/* =========================================================================
   شاشة المطر — اللعبة الأساسية. تخدم: الرحلة، عاصفة الوقت، البقاء، التحدي
   اليومي، الشرح، المطر الكلاسيكي، وكل مباريات الأونلاين والبطولات.
   • استجابة فورية: الأزرار تعمل عند لمس الإصبع (pointerdown) لا عند رفعه.
   • محرّك حتمي بنبضات ثابتة؛ الإدخال يُسجَّل لإعادة التشغيل والتحقق.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear, mathText, mathEl } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, buzz } from '../ui/audio.js';
import { floatText, replay, reducedMotion, confetti } from '../ui/fx.js';
import { t } from '../i18n.js';
import { createRain, TICK_MS, TPS, RAIN_DIFFS } from '../core/rain.js';
import { recordAnswer } from '../core/progression.js';
import { randomSeed } from '../core/rng.js';
import { normalizeDigits } from '../core/numbers.js';
import { streakMultiplier } from '../core/scoring.js';
import { buildRainRun, finishRainRun } from '../runs.js';
import { buildDrop, sizeDrop, dropDefsSVG, popBurst, groundSplash } from '../ui/drop.js';


/* ---------------- اللعب ---------------- */
registerScreen('rainPlay', (app, params) => {
  const data = app.data;
  const online = params.online || null;          // مباراة أونلاين (الإعدادات والبذرة من الخادم)
  const kind = online ? 'online' : params.kind;
  const built = online ? { cfg: online.cfg, seed: online.seed, meta: online.meta } : buildRainRun(kind, params.args || {}, data, params.restore?.seed);
  const { cfg, seed, meta } = built;
  if (params.restore?.id) built.id = params.restore.id;
  let R = createRain(cfg, seed);
  const realtime = !!meta.realtime;              // لا إيقاف: الوقت يمضي حتى لو غادرت (اليومي والأونلاين)
  const persist = !online && meta.persist;

  let raf = 0, last = 0, acc = 0, ended = false, paused = false, overlay = null, started = false, lastSave = 0, lastReport = 0, lastSec = null;
  const dropEls = new Map();

  /* ---------- العناصر ---------- */
  const scoreEl = h('span', num(0));
  const livesEl = h('span.lives');
  const streakEl = h('span.chip.streak-chip', { hidden: true });
  const goalEl = h('span.chip');
  const timerFill = h('i'); const timerEl = h('div.timer', timerFill); const timerText = h('span.timer-text');
  const iceEl = h('span.chip.ice-chip', { hidden: true }, '❄️');
  const oppBox = h('div.opp-box', { hidden: !online });
  const sky = h('div.sky.rain-sky', { aria: { label: meta.label } },
    h('div', { html: dropDefsSVG() }), h('div.sky-streaks', { aria: { hidden: 'true' } }), h('div.sky-streaks.far', { aria: { hidden: 'true' } }),
    h('div.ground', { aria: { hidden: 'true' } }, h('i.wave'), h('i.wave.w2')));
  if (meta.tint) sky.style.setProperty('--sky-tint', meta.tint);
  const coach = h('div.rain-coach', { hidden: true });
  const display = h('div.display.empty', { role: 'status', aria: { live: 'polite' } }, t('game.typeHere'));
  const live = h('div.sr-only', { aria: { live: 'polite' } });
  const kp = h('div.keypad.rain-keypad', { role: 'group', aria: { label: t('game.typeHere') } });

  const negAllowed = Object.entries(cfg.tiers).some(([op, tier]) => (op === 'sub' && tier >= 8) || (op === 'add' && tier >= 9));
  /** زر سريع الاستجابة: يعمل عند اللمس، ويدعم لوحة المفاتيح (click بلا مؤشر) */
  const fastKey = (label, fn, cls = '', aria) => {
    const b = h('button.key' + (cls ? '.' + cls : ''), { type: 'button', aria: { label: aria || (typeof label === 'string' ? label : null) } }, label);
    b.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); b.classList.add('press'); fn(); });
    b.addEventListener('pointerup', () => b.classList.remove('press'));
    b.addEventListener('pointerleave', () => b.classList.remove('press'));
    b.addEventListener('click', (e) => { if (e.detail === 0) fn(); });
    kp.appendChild(b); return b;
  };
  for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) fastKey(num(d), () => press(d), '', num(d));
  if (negAllowed) fastKey('−', () => press('-'), 'fn', t('game.neg')); else fastKey('C', () => press('clear'), 'fn', t('game.del'));
  fastKey(num('0'), () => press('0'), '', num('0'));
  fastKey(icon('backspace'), () => press('back'), 'fn', t('game.del'));
  fastKey(h('span', { style: { display: 'inline-flex', gap: '8px', alignItems: 'center' } }, icon('check'), t('game.check')), () => press('ok'), 'go', t('game.check'));

  const quitBtn = h('button.icon-btn', { aria: { label: t('game.quit') }, on: { click: () => askQuit() } }, icon('close'));
  const pauseBtn = meta.tutorial
    ? h('button.btn.sm.ghost', { id: 'skipTutorial', on: { click: () => { ended = true; cleanup(); data.settings.tutorialDone = true; app.save(); app.go('rainPlay', { kind: 'journey', args: { level: 1 } }, { replace: true }); } } }, t('tut.skip'))
    : realtime ? null : h('button.icon-btn', { aria: { label: t('game.pause') }, on: { click: () => pause() } }, icon('pause'));
  const center = h('div.grow');
  if (R.limitTicks) center.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('div', { style: { flex: '1' } }, timerEl), timerText));
  const el = h('main.game-view.rain-view',
    h('div.hud', quitBtn, center, pauseBtn, h('div.score', scoreEl, h('small', t('game.score')))),
    h('div.hud-sub', h('span.label', meta.label), goalEl, streakEl, iceEl, livesEl),
    oppBox, h('div.sky-wrap', sky, coach), h('div.answer-area', display, kp), live);

  /* ---------- HUD ---------- */
  function paintHud(lost = false) {
    const S = R.state;
    scoreEl.textContent = num(S.score);
    if (S.lives != null) {
      clear(livesEl);
      for (let i = 0; i < 3; i++) { const ic = icon('heart', 'fill' + (i >= S.lives ? ' lost' : '')); if (lost && i === S.lives) ic.classList.add('lose-anim'); livesEl.appendChild(ic); }
      livesEl.setAttribute('aria-label', t('a11y.lives', { n: S.lives }));
    } else livesEl.hidden = true;
    goalEl.hidden = !cfg.target;
    if (cfg.target) goalEl.textContent = '💧 ' + t('rain.pops', { a: num(S.popped), b: num(cfg.target) });
    else { goalEl.hidden = false; goalEl.textContent = '💧 ' + num(S.popped); }
    if (S.streak >= 2) { streakEl.hidden = false; clear(streakEl).append(icon('fire'), h('span', `${num(S.streak)} · ×${num(streakMultiplier(S.streak).toFixed(1))}`)); }
    else streakEl.hidden = true;
  }
  function paintTyped() {
    const typed = R.previewTyped();
    display.classList.remove('bad');
    if (!typed) { display.classList.add('empty'); display.textContent = t('game.typeHere'); }
    else { display.classList.remove('empty'); display.textContent = num(typed).replace('-', '−'); }
  }
  function paintTimer() {
    if (!R.limitTicks) return;
    const rem = R.remainingMs();
    timerFill.style.transform = `scaleX(${Math.max(0, rem / (R.limitTicks * TICK_MS))})`;
    const sec = Math.ceil(rem / 1000);
    timerText.textContent = num(sec);
    const danger = sec <= 5, warn = sec <= 10;
    timerEl.classList.toggle('warn', warn && !danger); timerEl.classList.toggle('danger', danger); timerText.classList.toggle('danger', danger);
    if (sec !== lastSec) { lastSec = sec; if (danger && sec > 0) sfx.tick(); }
  }

  /* ---------- الإدخال ---------- */
  function press(k) {
    if (ended || paused || !started) return;
    if (k !== 'ok') sfx.key();
    R.input(k);
    paintTyped();
  }

  /* ---------- الأحداث المرئية ---------- */
  function dropLabel(q) {
    const parts = q.format === 'missing' ? q.parts : q.parts.filter((p) => !p.eq && !p.blank);
    return mathText(parts);
  }
  function spawnEl(d) {
    const expr = mathEl(d.q.format === 'missing' ? d.q.parts : d.q.parts.filter((p) => !p.eq && !p.blank), { size: 'inline', cls: 'dq' });
    const de = buildDrop(d.kind, expr, dropLabel(d.q));
    sky.appendChild(de);
    sizeDrop(de);
    de._w = de.offsetWidth; de._h = de.offsetHeight;
    dropEls.set(d.id, de);
    placeOne(d, de);
    live.textContent = dropLabel(d.q);
  }
  function burst(de, color) {
    if (reducedMotion()) return;
    const r = de.getBoundingClientRect(), s = sky.getBoundingClientRect();
    popBurst(sky, r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.62, color);
  }
  function handle(events) {
    for (const ev of events) {
      if (ev.type === 'spawn') spawnEl(ev.drop);
      else if (ev.type === 'pop') {
        const de = dropEls.get(ev.drop.id);
        if (de) {
          burst(de, ev.drop.kind === 'gold' ? '#FFD86B' : ev.drop.kind === 'ice' ? '#DFF8FF' : ev.drop.kind === 'storm' ? '#B9A6FF' : '#7BE3FF');
          floatText(de, '+' + num(ev.points), ev.drop.kind === 'gold' ? 'gold' : '');
          de.classList.add('popped'); setTimeout(() => de.remove(), 260); dropEls.delete(ev.drop.id);
        }
        if (!ev.chain) { sfx.pop(); buzz(12); }
        const a = R.state.answers[R.state.answers.length - 1];
        if (meta.stats && a && a.correct) recordAnswer(data, { ...a, adapt: true });
        const st = R.state.streak;
        if (!ev.chain && (st === 5 || st === 10 || st % 15 === 0)) { sfx.combo(); buzz([10, 40, 10]); floatText(sky, t('game.streakMsg', { n: st, m: streakMultiplier(st).toFixed(1) }), 'gold'); replay(streakEl, 'bump'); }
        if (meta.tutorial) coachSay();
      } else if (ev.type === 'miss') {
        const de = dropEls.get(ev.drop.id);
        if (de) {
          if (!reducedMotion()) groundSplash(sky, de._x + de._w / 2);
          de.classList.add('splash'); setTimeout(() => de.remove(), 300); dropEls.delete(ev.drop.id);
        }
        sfx.splash(); buzz(90);
        replay(sky.querySelector('.ground'), 'hit');
        if (!reducedMotion()) replay(sky, 'shake');
        if (meta.stats) recordAnswer(data, { ...R.state.answers[R.state.answers.length - 1], adapt: true });
        live.textContent = t('game.timeout', { a: num(ev.drop.q.answer) });
        floatText(sky.querySelector('.ground'), num(ev.drop.q.answer).replace('-', '−'), 'bad');
        paintHud(true);
        continue;
      } else if (ev.type === 'wrong') {
        sfx.wrong(); buzz(40); replay(display, 'bad');
      } else if (ev.type === 'ice') {
        sfx.reward(); sky.classList.add('frozen');
      } else if (ev.type === 'storm') {
        sfx.fanfare(); if (!reducedMotion()) replay(sky, 'flash');
      } else if (ev.type === 'over') {
        paintHud();
        return finish();
      }
    }
    if (events.length) { paintHud(); paintTyped(); }
  }

  /* ---------- الحلقة (نبضات ثابتة) ---------- */
  let skyW = 0, skyH = 0;
  const measure = () => { skyW = sky.clientWidth; skyH = sky.clientHeight; };
  window.addEventListener('resize', measure);
  /** موضع قطرة واحدة (الأبعاد محفوظة مسبقًا لتجنّب إعادة حساب التخطيط في كل إطار) */
  function placeOne(d, de) {
    if (!skyW) measure();
    const w = de._w || 90, hh = de._h || 96;
    const x = 6 + d.x * Math.max(0, skyW - w - 12);
    const y = -hh * 0.35 + d.y * (skyH - 20 - hh * 0.65);
    de._x = x;
    const tf = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    de.style.transform = tf; de.style.setProperty('--tf', tf);
    const near = d.y > 0.72;
    if (de._near !== near) { de._near = near; de.classList.toggle('near', near); }
    // الأقرب إلى الأرض فوق غيرها: أوضح للعين أيّها الأخطر
    const z = 1 + Math.floor(d.y * 40);
    if (de._z !== z) { de._z = z; de.style.zIndex = z; }
  }
  function placeDrops() {
    for (const d of R.state.drops) {
      const de = dropEls.get(d.id);
      if (!de || d.dead) continue;
      placeOne(d, de);
    }
    sky.classList.toggle('frozen', R.state.tick < R.state.iceUntil);
    iceEl.hidden = !(R.state.tick < R.state.iceUntil);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (paused || ended || !started) { last = now; return; }
    acc += Math.min(250, now - last); last = now;
    let steps = 0;
    while (acc >= TICK_MS && steps < 15 && !ended) { acc -= TICK_MS; steps++; handle(R.step()); }
    if (ended) return;
    placeDrops(); paintTimer();
    if (persist && now - lastSave > 1000) { lastSave = now; persistNow(); }
    if (online && now - lastReport > 400) { lastReport = now; online.report?.({ tick: R.state.tick, score: R.state.score, popped: R.state.popped, lives: R.state.lives }); }
    if (online?.ghosts) paintGhosts();
  }

  /* ---------- الخصوم (أونلاين) ---------- */
  const oppRows = new Map();
  function oppRow(o) {
    if (oppRows.has(o.id)) return oppRows.get(o.id);
    const bar = h('i'); const sc = h('b', num(0));
    const row = h('div.opp', { style: { '--oc': o.color || 'var(--pink)' } }, h('span.on', o.name), h('div.bar', bar), sc);
    oppBox.appendChild(row);
    const r = { row, bar, sc }; oppRows.set(o.id, r); return r;
  }
  function setOpp(id, name, score, done = false, color) {
    const r = oppRow({ id, name, color });
    r.sc.textContent = num(score);
    const max = Math.max(1, R.state.score, ...[...oppRows.values()].map((x) => x._s || 0), score);
    r._s = score;
    for (const x of oppRows.values()) x.bar.style.width = Math.min(100, ((x._s || 0) / max) * 100) + '%';
    r.row.classList.toggle('done', done);
  }
  function paintGhosts() {
    for (const g of online.ghosts) {
      let s = 0; for (const [tk, sc] of g.timeline) { if (tk <= R.state.tick) s = sc; else break; }
      setOpp(g.id, g.name, s, R.state.tick >= g.timeline[g.timeline.length - 1][0], g.color);
    }
  }
  if (online) {
    for (const o of online.opponents || []) setOpp(o.id, o.name, 0, false, o.color);
    online.onProgress = (id, name, score, done, color) => setOpp(id, name, score, done, color);
  }

  /* ---------- الشرح التفاعلي ---------- */
  function coachSay() {
    const n = R.state.popped;
    const msg = n === 0 ? t('rtut.1') : n === 1 ? t('rtut.2') : n === 2 ? t('rtut.3') : t('rtut.4');
    coach.hidden = false;
    clear(coach).append(h('div.coach', h('span', { html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: n ? 'cheer' : 'happy', size: 44, label: t('mascot.name') }) }), h('div.bubble', msg)));
  }

  /* ---------- الإيقاف ---------- */
  function pause() {
    if (ended || paused || !started || realtime) return;
    paused = true; persistNow();
    sky.classList.add('veiled');
    overlay = h('div.overlay', { role: 'dialog', aria: { modal: 'true', label: t('game.paused') } }, h('div.panel',
      h('div', { html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: 'think', size: 64, label: t('mascot.name') }) }),
      h('h2', t('game.paused')), h('p.note', t('rain.pausedNote')),
      h('div.stack', h('button.btn.primary.block.lg', { 'data-autofocus': true, on: { click: resume } }, icon('play'), t('game.resume')),
        h('button.btn.ghost.block', { on: { click: () => askQuit(true) } }, t('game.quit')))));
    document.body.appendChild(overlay);
    overlay.querySelector('[data-autofocus]').focus();
  }
  function resume() {
    sfx.tap(); overlay?.remove(); overlay = null; sky.classList.remove('veiled');
    paused = false; last = performance.now(); acc = 0;
  }
  async function askQuit(fromPause = false) {
    if (ended) return;
    sfx.tap();
    if (!fromPause && !realtime) pause();
    const official = kind === 'daily' && params.args?.official;
    const body = online ? t('online.quitBody') : official ? t('game.quitDaily') : t('game.quitBody');
    const ok = await app.confirm({ title: t('game.quitTitle'), body, ok: t('game.quit'), cancel: t('game.keepPlaying'), danger: true });
    if (!ok) return;
    overlay?.remove(); overlay = null;
    if (official || online) { handle(R.quit()); return; }
    ended = true; cleanup();
    if (persist) app.store.clearActive(app.pid);
    app.back();
  }

  /* ---------- النهاية ---------- */
  function finish() {
    if (ended) return;
    ended = true; cleanup();
    const sum = R.summary();
    if (persist) app.store.clearActive(app.pid);
    if (online) return online.finish({ log: R.state.log, endTick: R.state.tick, summary: sum, timeline: R.state.timeline });
    if (meta.tutorial) {
      data.settings.tutorialDone = true; app.save(); sfx.win(); confetti({ count: 60 });
      return app.go('rainPlay', { kind: 'journey', args: { level: 1 } }, { replace: true });
    }
    const { view } = finishRainRun(kind, params.args || {}, { id: built.id, seed }, sum, data);
    if (kind === 'daily' && view.official) import('./online.js').then((m) => m.uploadDaily(app, params.args.date, R.state.log, R.state.tick)).catch(() => {});
    app.save();
    app.go('results', { view }, { replace: true });
  }

  function persistNow() {
    if (!persist || ended || !started) return;
    app.store.saveActive(app.pid, { engine: 'rain', kind, args: params.args, seed, id: built.id, log: R.state.log, tick: R.state.tick, savedAt: Date.now() });
  }

  /* ---------- لوحة المفاتيح ---------- */
  function onKey(e) {
    if (ended || document.querySelector('.modal-backdrop')) return;
    if (paused) { if (e.key === 'Enter') resume(); return; }
    const k = normalizeDigits(e.key);
    if (/^\d$/.test(k)) { e.preventDefault(); press(k); }
    else if (k === '-' && negAllowed) { e.preventDefault(); press('-'); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press('ok'); }
    else if (e.key === 'Escape') { if (realtime) askQuit(); else pause(); }
  }
  function cleanup() { window.removeEventListener('resize', measure); cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); overlay?.remove(); document.querySelectorAll('.countdown').forEach((x) => x.remove()); }
  document.addEventListener('keydown', onKey);

  /* ---------- البدء / الاستعادة ---------- */
  function restore() {
    const rs = params.restore;
    R = createRain(cfg, seed);
    // نعيد البناء بإعادة إدخال السجل نبضة بنبضة حتى نفس اللحظة
    let i = 0;
    while (R.state.tick < rs.tick && !R.state.over) {
      while (i < rs.log.length && rs.log[i][0] === R.state.tick) { R.input(String(rs.log[i][1])); i++; }
      R.step();
    }
    for (const d of R.state.drops) if (!d.dead) spawnEl(d);
    started = true; paintHud(); paintTyped();
    if (realtime) {
      // التحدي اليومي: الوقت مضى أثناء غيابك — نكمل المحاكاة بلا إدخال
      const missed = Math.max(0, Math.round((Date.now() - (rs.savedAt || Date.now())) / TICK_MS));
      for (let k = 0; k < missed && !R.state.over; k++) handle(R.step());
      if (ended) return;
      last = performance.now(); raf = requestAnimationFrame(loop);
      return;
    }
    raf = requestAnimationFrame(loop);
    pause();
  }
  function begin() {
    if (params.restore) return restore();
    paintHud();
    if (meta.tutorial) coachSay();
    const startNow = () => { started = true; last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); };
    const steps = reducedMotion() || meta.tutorial ? [] : [num(3), num(2), num(1), t('game.go')];
    if (online?.startAt) {
      // مزامنة البداية مع الخادم
      const cd = h('div.countdown', { aria: { hidden: 'true' } }, h('span'));
      document.body.appendChild(cd);
      const tickCd = () => {
        const ms = online.startAt - online.now();
        if (ms <= 0) { cd.remove(); sfx.go(); startNow(); return; }
        const s = Math.ceil(ms / 1000); const sp = cd.firstChild;
        if (sp.textContent !== num(s)) { sp.textContent = num(s); replay(sp, 'x'); sfx.count(); }
        setTimeout(tickCd, 50);
      };
      tickCd();
      return;
    }
    if (!steps.length) return startNow();
    const cd = h('div.countdown', { aria: { hidden: 'true' } }, h('span'));
    document.body.appendChild(cd);
    let i = 0;
    const show = () => { cd.firstChild.textContent = steps[i]; replay(cd.firstChild, 'x'); (i === steps.length - 1 ? sfx.go : sfx.count)(); };
    show();
    const iv = setInterval(() => {
      i++;
      if (i >= steps.length) { clearInterval(iv); cd.remove(); return; }
      show();
      if (i === steps.length - 1) { startNow(); setTimeout(() => cd.remove(), 350); clearInterval(iv); }
    }, 420);
  }

  return {
    el, rain: () => R,
    afterMount: begin,
    destroy: () => { if (!ended) persistNow(); cleanup(); },
    onBack: () => { askQuit(); return true; },
    onHide: () => {
      if (ended) return;
      if (!realtime) pause();
      else { persistNow(); app._hiddenAt = Date.now(); }
    },
    onShow: () => {
      if (ended || !realtime || !app._hiddenAt || !started) return;
      // الأنماط الآنية: نحاكي الوقت الذي مضى في الخلفية (القطرات استمرت بالسقوط)
      const missed = Math.round((Date.now() - app._hiddenAt) / TICK_MS);
      app._hiddenAt = null;
      for (let k = 0; k < missed && !R.state.over; k++) handle(R.step());
      last = performance.now(); acc = 0;
    },
  };
});

export { TPS, RAIN_DIFFS, randomSeed };
