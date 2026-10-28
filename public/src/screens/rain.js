/* =========================================================================
   شاشة المطر — اللعبة الأساسية. تخدم: الرحلة، عاصفة الوقت، البقاء، التحدي
   اليومي، الشرح، المطر الكلاسيكي، وكل مباريات الأونلاين والبطولات.
   • استجابة فورية: الأزرار تعمل عند لمس الإصبع (pointerdown) لا عند رفعه.
   • محرّك حتمي بنبضات ثابتة؛ الإدخال يُسجَّل لإعادة التشغيل والتحقق.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear, mathText, mathEl, signed } from '../ui/dom.js';
import { mascotSVG, SKINS } from '../ui/mascot.js';
import { sfx, buzz, setLevels } from '../ui/audio.js';
import { floatText, replay, reducedMotion, confetti } from '../ui/fx.js';
import { t } from '../i18n.js';
import { createRain, TICK_MS, TPS, RAIN_DIFFS } from '../core/rain.js';
import { recordAnswer } from '../core/progression.js';
import { randomSeed } from '../core/rng.js';
import { normalizeDigits } from '../core/numbers.js';
import { streakMultiplier } from '../core/scoring.js';
import { buildRainRun, finishRainRun } from '../runs.js';
import { buildDrop, sizeDrop, dropDefsSVG, popBurst, groundSplash } from '../ui/drop.js';
import * as ads from '../net/ads.js';
import { pearls, spend } from '../core/wallet.js';
import { PEARL_PRICES } from '../core/products.js';


/** «×١٫٤» معزولة الاتجاه حتى لا تنقلب في الواجهة العربية */
export const speedText = (x) => '\u2066×' + num((x || 1).toFixed(1)) + '\u2069';

/* ---------------- اللعب ---------------- */
registerScreen('rainPlay', (app, params) => {
  const data = app.data;
  // منافسون على نفس الجوال (غرفة الأصدقاء): أشرطة نتائجهم السابقة تتحرك معك بنفس التوقيت
  const rivals = params.rivals || null;
  const party = params.party || null;
  const kind = params.kind;
  // البذرة: من جولة محفوظة، أو من رمز تحدٍّ/غرفة (نفس القطرات للجميع)، أو عشوائية
  const built = buildRainRun(kind, params.args || {}, data, params.restore?.seed ?? params.seed);
  const { cfg, seed, meta } = built;
  if (params.restore?.id) built.id = params.restore.id;
  let R = createRain(cfg, seed);
  const realtime = !!meta.realtime;              // لا إيقاف: الوقت يمضي حتى لو غادرت (اليومي والأونلاين)
  const persist = !party && meta.persist;

  let raf = 0, last = 0, acc = 0, ended = false, paused = false, revived = false, offering = false, overlay = null, started = false, lastSave = 0, lastSec = null;
  const dropEls = new Map();

  /* ---------- العناصر ---------- */
  const scoreEl = h('span', num(0));
  const livesEl = h('span.lives', { role: 'img' });
  const streakEl = h('span.chip.streak-chip', { hidden: true });
  // التقدّم نحو الهدف: شريط رفيع في أعلى الشاشة بدل شارة
  const goalFill = h('i'); const goalText = h('span.goal-t');
  const goalEl = h('div.goal-bar', { aria: { hidden: 'true' } }, goalFill, goalText);
  const timerFill = h('i'); const timerEl = h('div.timer', timerFill); const timerText = h('span.timer-text');
  const iceEl = h('span.chip.ice-chip', { hidden: true }, '❄️');
  const speedEl = h('span.chip.speed-chip', { hidden: !cfg.accel, aria: { label: t('rain.speedA11y') } });
  // خط الشبح: تقدّمك الآن مقابل رقمك القياسي — اكسره أمام عينيك
  const chase = meta.chase || null;
  let chaseBroken = false;
  const chaseFill = h('i'); const chaseText = h('span.chase-t');
  const chaseEl = chase ? h('div.chase', { aria: { hidden: 'true' } }, h('div.chase-bar', chaseFill, h('b.chase-mark')), chaseText) : null;
  const oppBox = h('div.opp-box', { hidden: !rivals?.ghosts?.length });
  // لون القطرات العادية = لون مظهر اللاعب (السماوي الافتراضي يبقى كما هو)
  const skinTint = app.data.cosmetics.skin && app.data.cosmetics.skin !== 'sky' ? SKINS[app.data.cosmetics.skin]?.[0] : null;
  const sky = h('div.sky.rain-sky', { aria: { label: meta.label }, style: skinTint ? { '--drop-tint': skinTint } : {} },
    h('div', { html: dropDefsSVG() }), h('div.sky-streaks', { aria: { hidden: 'true' } }), h('div.sky-streaks.far', { aria: { hidden: 'true' } }),
    h('div.ground', { aria: { hidden: 'true' } }, h('i.wave'), h('i.wave.w2')));
  if (meta.tint) sky.style.setProperty('--sky-tint', meta.tint);
  const coach = h('div.rain-coach', { hidden: true });
  // ما تكتبه يظهر فقاعةً داخل السماء (لا خانة منفصلة تأخذ مساحة)
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
  // لوحة مدمجة ٤×٣: [١ ٢ ٣ ⌫] [٤ ٥ ٦ ٠] [٧ ٨ ٩ ✓] — الإجابة الصحيحة تُطلق تلقائيًا، و✓ عند الحاجة فقط
  const digitKey = (d) => fastKey(num(d), () => press(d), '', num(d));
  ['1', '2', '3'].forEach(digitKey); fastKey(icon('backspace'), () => press('back'), 'fn', t('game.del'));
  ['4', '5', '6'].forEach(digitKey);
  if (negAllowed) fastKey('−', () => press('-'), 'fn', t('game.neg')); else digitKey('0');
  ['7', '8', '9'].forEach(digitKey);
  if (negAllowed) digitKey('0');
  fastKey(icon('check'), () => press('ok'), 'go' + (negAllowed ? '.wide' : ''), t('game.check'));

  const quitBtn = h('button.icon-btn', { aria: { label: t('game.quit') }, on: { click: () => askQuit() } }, icon('close'));
  const pauseBtn = meta.tutorial
    ? h('button.btn.sm.ghost', { id: 'skipTutorial', on: { click: () => { ended = true; cleanup(); data.settings.tutorialDone = true; app.save(); app.go('rainPlay', { kind: 'journey', args: { level: 1 } }, { replace: true }); } } }, t('tut.skip'))
    : realtime ? null : h('button.icon-btn', { aria: { label: t('game.pause') }, on: { click: () => pause() } }, icon('pause'));
  const center = h('div.grow');
  if (R.limitTicks) center.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('div', { style: { flex: '1' } }, timerEl), timerText));
  center.append(goalEl);
  const el = h('main.game-view.rain-view',
    h('div.hud', quitBtn, livesEl, center, h('div.score', h('span.sr-only', t('game.score') + ': '), icon('star', 'fill'), scoreEl), pauseBtn),
    h('span.sr-only', meta.label),
    chaseEl, oppBox,
    h('div.sky-wrap', sky, coach, h('div.sky-chips', streakEl, speedEl, iceEl), display),
    h('div.answer-area', kp), live);

  /* ---------- HUD ---------- */
  function paintHud(lost = false) {
    const S = R.state;
    scoreEl.textContent = num(S.score);
    if (S.lives != null) {
      clear(livesEl);
      for (let i = 0; i < 3; i++) { const ic = icon('heart', 'fill' + (i >= S.lives ? ' lost' : '')); if (lost && i === S.lives) ic.classList.add('lose-anim'); livesEl.appendChild(ic); }
      livesEl.setAttribute('aria-label', t('a11y.lives', { n: S.lives }));
    } else livesEl.hidden = true;
    if (cfg.target) { goalFill.style.transform = `scaleX(${Math.min(1, S.popped / cfg.target)})`; goalText.textContent = '💧 ' + t('rain.pops', { a: num(S.popped), b: num(cfg.target) }); }
    else { goalFill.style.transform = 'scaleX(0)'; goalText.textContent = '💧 ' + num(S.popped); }
    if (S.streak >= 2) { streakEl.hidden = false; clear(streakEl).append(icon('fire'), h('span', `${num(S.streak)} · ${speedText(streakMultiplier(S.streak))}`)); }
    else streakEl.hidden = true;
    if (cfg.accel) speedEl.textContent = '⚡ ' + speedText(R.speedX());
    if (chase) paintChase();
  }
  function paintChase() {
    const cur = chase.by === 'score' ? R.state.score : R.state.popped;
    const f = Math.min(1, cur / chase.value);
    chaseFill.style.transform = `scaleX(${f})`;
    chaseText.textContent = chaseBroken ? '🏆 ' + t('rain.recordBroken') : '🏁 ' + num(Math.max(0, chase.value - cur + 1));
    if (!chaseBroken && cur > chase.value) {
      chaseBroken = true; chaseEl.classList.add('broken');
      chaseText.textContent = '🏆 ' + t('rain.recordBroken');
      sfx.record(); buzz([20, 40, 20, 40, 60]); floatText(sky, t('rain.newRecordLive'), 'gold');
      if (!reducedMotion()) confetti({ count: 40 });
    }
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
  /** انفجار القطرة: رذاذ ملوّن + حلقة + رقم النقاط يطير من القطرة نفسها (أكبر مع السلسلة) */
  function burstFx(de, ev) {
    const color = ev.drop.kind === 'gold' ? '#FFD86B' : ev.drop.kind === 'ice' ? '#DFF8FF' : ev.drop.kind === 'storm' ? '#B9A6FF' : ev.drop.kind === 'gift' ? '#FF8FD0' : ev.fever ? '#FFB347' : '#7BE3FF';
    const special = ev.drop.kind !== 'normal' && ev.drop.kind != null;
    burst(de, color, special || ev.fever);
    const st = R.state.streak;
    floatText(de, signed('+' + num(ev.points)), [ev.drop.kind === 'gold' || ev.fever ? 'gold' : '', st >= 10 ? 'big' : ''].filter(Boolean).join('.'));
  }
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
    // تُعلن القطرة الجديدة فقط إن كانت السماء فارغة؛ وإلا تُقرأ أقرب قطرة بعد كل إجابة (announce)
    if (dropEls.size === 1) live.textContent = dropLabel(d.q);
  }
  // قارئ الشاشة: نتيجة الإجابة ثم أقرب قطرة (الأخطر) — بلا انتظار رؤية السماء
  function announce(first) {
    const next = R.state.drops.filter((d) => dropEls.has(d.id)).sort((a, b) => b.y - a.y)[0];
    live.textContent = [first, next ? dropLabel(next.q) : ''].filter(Boolean).join('. ');
  }
  function burst(de, color, big = false) {
    if (reducedMotion()) return;
    const r = de.getBoundingClientRect(), s = sky.getBoundingClientRect();
    // كلما طالت السلسلة كبر الانفجار
    popBurst(sky, r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.62, color, big ? 22 : 14 + Math.min(8, R.state.streak));
  }
  function handle(events) {
    for (const ev of events) {
      if (ev.type === 'spawn') spawnEl(ev.drop);
      else if (ev.type === 'pop') {
        const de = dropEls.get(ev.drop.id);
        if (de) {
          burstFx(de, ev);
          de.classList.add('popped'); setTimeout(() => de.remove(), 260); dropEls.delete(ev.drop.id);
        }
        if (!ev.chain) { sfx.pop(R.state.streak); buzz(ev.fever ? 18 : 12); }
        const a = R.state.answers[R.state.answers.length - 1];
        if (meta.stats && a && a.correct) recordAnswer(data, { ...a, adapt: true });
        const st = R.state.streak;
        replay(el.querySelector('.hud .score'), 'bump'); replay(display, 'ok-flash');
        if (!ev.chain && (st === 5 || st === 10 || st % 15 === 0)) {
          sfx.combo(); buzz([10, 40, 10]); floatText(sky, t('game.streakMsg', { n: st, m: streakMultiplier(st).toFixed(1) }), 'gold.big'); replay(streakEl, 'bump');
          if (!reducedMotion()) replay(sky, 'combo-pulse');
        }
        if (!ev.chain) announce(t('a11y.correctAnswer') + ' ' + signed('+' + num(ev.points)));
        if (meta.tutorial) coachSay();
      } else if (ev.type === 'miss') {
        const de = dropEls.get(ev.drop.id);
        if (de) {
          if (!reducedMotion()) groundSplash(sky, de._x + de._w / 2, water);
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
        // إجابة خطأ: اهتزاز + وميض أحمر + صوت
        sfx.wrong(); buzz([30, 40, 30]); replay(display, 'bad');
        announce(t('a11y.wrongAnswer'));
        if (!reducedMotion()) replay(sky, 'shake');
        replay(sky, 'wrong-flash');
      } else if (ev.type === 'speedup') {
        sfx.whoosh(); sfx.combo(); buzz([8, 30, 8]); floatText(sky, t('rain.fasterX', { x: speedText(R.speedX()) }), 'gold.big');
        if (!reducedMotion()) { replay(sky, 'speed-pulse'); replay(speedEl, 'bump'); }
        sky.style.setProperty('--speed', String(Math.min(3, R.speedX())));
        sky.classList.toggle('hyper', R.speedX() >= 2);
      } else if (ev.type === 'fever') {
        sfx.fever(); buzz([15, 30, 15, 30, 15]);
        sky.classList.add('fever'); el.classList.add('fever');
        floatText(sky, t('rain.fever'), 'gold');
      } else if (ev.type === 'feverEnd') {
        sky.classList.remove('fever'); el.classList.remove('fever');
      } else if (ev.type === 'gift') {
        sfx.gift(); buzz([10, 20, 10]);
        floatText(sky, t('rain.gift', { n: num(ev.bonus) }), 'gold');
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
  /* مستوى الماء: يرتفع مع كل قطرة تسقط (بالقلوب: كل قلب مفقود يرفعه ثُلثًا حتى ٤٠٪ من السماء،
     وبلا قلوب: ٣٪ لكل قطرة حتى ٣٠٪). مرئي فقط — المحرّك لا يتغير. */
  const ground = sky.querySelector('.ground');
  const maxLives = cfg.lives;
  let water = 20;
  const waterTarget = () => {
    const S = R.state;
    const f = maxLives ? Math.max(0, maxLives - (S.lives ?? maxLives)) / maxLives * 0.4 : Math.min(0.3, S.missed * 0.03);
    return 20 + f * (skyH || 300);
  };
  function paintWater(snap = false) {
    const tg = waterTarget();
    water = snap ? tg : water + (tg - water) * 0.08;
    if (Math.abs(tg - water) < 0.3) water = tg;
    ground.style.height = water.toFixed(1) + 'px';
    sky.classList.toggle('flooding', water > 20 + (skyH || 300) * 0.25);
  }
  window.addEventListener('resize', measure);
  /** موضع قطرة واحدة (الأبعاد محفوظة مسبقًا لتجنّب إعادة حساب التخطيط في كل إطار) */
  function placeOne(d, de) {
    if (!skyW) measure();
    const w = de._w || 90, hh = de._h || 96;
    const x = 6 + d.x * Math.max(0, skyW - w - 12);
    const y = -hh * 0.35 + d.y * (skyH - water - hh * 0.65);
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
    paintWater(); placeDrops(); paintTimer();
    if (persist && now - lastSave > 1000) { lastSave = now; persistNow(); }
    if (rivals?.ghosts?.length) paintGhosts();
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
    for (const g of rivals.ghosts) {
      let s = 0; for (const [tk, sc] of g.timeline) { if (tk <= R.state.tick) s = sc; else break; }
      setOpp(g.id, g.name, s, R.state.tick >= g.timeline[g.timeline.length - 1][0], g.color);
    }
  }
  if (rivals?.ghosts?.length) for (const g of rivals.ghosts) setOpp(g.id, g.name, 0, false, g.color);

  /* ---------- الشرح التفاعلي ---------- */
  function coachSay() {
    const n = R.state.popped;
    const msg = n === 0 ? t('rtut.1') : n === 1 ? t('rtut.2') : n === 2 ? t('rtut.3') : t('rtut.4');
    coach.hidden = false;
    clear(coach).append(h('div.coach', h('span', { html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: n ? 'cheer' : 'happy', size: 44, label: t('mascot.name') }) }), h('div.bubble', msg)));
  }

  /* ---------- الإيقاف ---------- */
  function quickToggle(kind, onIc, offIc, label) {
    const st = data.settings;
    const prevKey = '_prev_' + kind;
    const on = () => st[kind] > 0;
    const b = h('button.qa-btn', { type: 'button', aria: { pressed: String(on()), label } }, h('span.qa-ic', on() ? onIc : offIc), h('span', label));
    b.addEventListener('click', () => {
      if (on()) { st[prevKey] = st[kind]; st[kind] = 0; } else st[kind] = st[prevKey] || 0.8;
      setLevels({ sfx: st.sfx, music: 0 });
      app.save(); b.setAttribute('aria-pressed', String(on())); b.firstChild.textContent = on() ? onIc : offIc;
      if (kind === 'sfx' && on()) sfx.tap();
    });
    return b;
  }
  function pause() {
    if (ended || paused || !started || realtime) return;
    paused = true; persistNow();
    sky.classList.add('veiled');
    overlay = h('div.overlay', { role: 'dialog', aria: { modal: 'true', label: t('game.paused') } }, h('div.panel',
      h('div', { html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: 'think', size: 64, label: t('mascot.name') }) }),
      h('h2', t('game.paused')), h('p.note', t('rain.pausedNote')),
      // إعدادات سريعة أثناء اللعب: المؤثرات والموسيقى
      h('div.quick-audio', { role: 'group', aria: { label: t('set.title') } },
        quickToggle('sfx', '🔊', '🔇', t('set.sfx'))),
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
    const body = party ? t('party.quitBody') : official ? t('game.quitDaily') : t('game.quitBody');
    const ok = await app.confirm({ title: t('game.quitTitle'), body, ok: t('game.quit'), cancel: t('game.keepPlaying'), danger: true });
    if (!ok) return;
    overlay?.remove(); overlay = null;
    if (official || party) { handle(R.quit()); return; }
    ended = true; cleanup();
    if (persist) app.store.clearActive(app.pid);
    app.back();
  }

  /* ---------- فرصة ثانية بإعلان بمكافأة (اختياري، مرة واحدة، أنماط فردية فقط) ---------- */
  function canRevive() {
    // تحدي صديق: لا فرصة ثانية (النتيجتان على نفس القواعد)
    // غرفة الأصدقاء وتحدّي الرمز: لا فرصة ثانية (يجب أن تكون الشروط متساوية للجميع)
    return !party && !meta.duel && !meta.tutorial && ['journey', 'custom'].includes(kind) && R.state.endReason === 'lives' && !revived
      && (ads.rewardedReady() || pearls(data) >= PEARL_PRICES.revive);
  }
  function offerRevive() {
    offering = true; paused = true;
    sky.classList.add('veiled');
    const done = async (how) => {
      overlay?.remove(); overlay = null; sky.classList.remove('veiled');
      const paid = how === 'ad' ? await ads.showRewarded() : how === 'pearls' ? spend(data, PEARL_PRICES.revive) : false;
      if (paid && R.revive()) {
        if (how === 'pearls') app.save();
        revived = true;
        for (const d of R.state.drops) if (d.cleared) { const de = dropEls.get(d.id); if (de) { de.classList.add('popped'); setTimeout(() => de.remove(), 260); dropEls.delete(d.id); } }
        sfx.reward(); paintHud(true);
        offering = false; paused = false; last = performance.now(); acc = 0;
        return;
      }
      offering = false; paused = false; finish(true);
    };
    overlay = h('div.overlay', { role: 'dialog', aria: { modal: 'true', label: t('ads.reviveTitle') } }, h('div.panel',
      h('div', { style: { fontSize: '2.4rem' } }, '💧'),
      h('h2', t('ads.reviveTitle')), h('p.note', t('ads.reviveBody')),
      h('div.stack',
        ads.rewardedReady() ? h('button.btn.gold.block.lg', { id: 'reviveYes', 'data-autofocus': true, on: { click: () => done('ad') } }, '🎬 ', t('ads.reviveYes')) : null,
        pearls(data) >= PEARL_PRICES.revive ? h('button.btn.primary.block' + (ads.rewardedReady() ? '' : '.lg'), { id: 'revivePearls', 'data-autofocus': ads.rewardedReady() ? null : true, on: { click: () => done('pearls') } },
          '💎 ', t('wal.reviveBtn', { n: num(PEARL_PRICES.revive), b: num(pearls(data)) })) : null,
        h('button.btn.ghost.block', { id: 'reviveNo', on: { click: () => done(null) } }, t('ads.reviveNo')))));
    document.body.appendChild(overlay);
    overlay.querySelector('[data-autofocus]').focus();
  }

  /* ---------- النهاية ---------- */
  function finish(skipRevive = false) {
    if (ended || offering) return;
    if (!skipRevive && canRevive()) return offerRevive();
    ended = true; cleanup();
    const sum = R.summary();
    // غرفة على نفس الجوال: دور هذا اللاعب انتهى ← شاشة الغرفة (بلا مكافآت فردية؛ تُحتسب الغرفة كاملة في النهاية)
    if (party) return app.go('partyTurn', { party, result: { score: sum.score, popped: sum.popped, timeline: R.state.timeline.slice() } }, { replace: true });
    if (meta.tutorial) {
      data.settings.tutorialDone = true; app.save(); sfx.win(); confetti({ count: 60 });
      return app.go('rainPlay', { kind: 'journey', args: { level: 1 } }, { replace: true });
    }
    // المكافآت تُطبَّق مرة واحدة لكل معرّف جولة (commitRound)؛ نحفظ قبل حذف الجولة المعلّقة،
    // فإن أُغلق التطبيق بينهما تُستأنف الجولة وتنتهي بالمعرّف نفسه بلا مكافأة مكررة
    const { view } = finishRainRun(kind, params.args || {}, { id: built.id, seed, revived }, sum, data);
    // البذرة تحوّل الجولة إلى رمز تحدٍّ لصديق (يلعب نفس القطرات)؛ جولة بفرصة ثانية لا تتحول إلى تحدٍّ
    view.seed = typeof seed === 'number' ? seed : null;
    view.revived = revived;
    app.save();
    if (persist) app.store.clearActive(app.pid);
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
    while (R.state.tick < rs.tick) {
      if (R.state.over) {
        if (i < rs.log.length && rs.log[i][1] === 'rv' && rs.log[i][0] === R.state.tick && R.revive()) { i++; revived = true; continue; }
        break;
      }
      while (i < rs.log.length && rs.log[i][0] === R.state.tick && rs.log[i][1] !== 'rv') { R.input(String(rs.log[i][1])); i++; }
      R.step();
    }
    measure(); paintWater(true);
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
    onBack: () => { if (!offering) askQuit(); return true; },
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
