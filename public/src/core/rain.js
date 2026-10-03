/* =========================================================================
   محرّك «المطر» — قلب اللعبة: قطرات تحمل مسائل تتساقط، واللاعب يكتب الناتج.
   -------------------------------------------------------------------------
   • حتمي بالكامل: الزمن «نبضات» ثابتة (60 في الثانية) والعشوائية من بذرة.
     كل إدخال يُسجَّل برقم النبضة، فيستطيع الخادم إعادة تشغيل الجولة حرفيًا
     والتحقق من النتيجة (لا يُقبل أي رقم مرسل من الجهاز دون إعادة حسابه).
   • قواعد العدالة: زمن سقوط القطرة ≥ زمن حلّها المتوقع × 1.3 دائمًا.
   • قطرات خاصة (اختيارية): ذهبية (نقاط ×2)، جليدية (تبطئ المطر 5 ثوانٍ)،
     برقية (تفجّر كل القطرات الظاهرة).
   ========================================================================= */
import { createRng } from './rng.js';
import { createQuestionFactory } from './questions.js';
import { answerPoints } from './scoring.js';

export const TPS = 60;                 // نبضة في الثانية
export const TICK_MS = 1000 / TPS;
const ICE_TICKS = 5 * TPS;

/** إعدادات افتراضية — كل نمط يغيّر ما يحتاجه */
export function rainConfig(o = {}) {
  return {
    tiers: { add: 2, sub: 2 },
    formats: { input: 1 },        // input أو missing (العدد المفقود داخل القطرة)
    travel: 9,                    // ثوانٍ لعبور السماء
    spawn: 2.8,                   // ثوانٍ بين القطرات
    maxDrops: 3,
    target: null,                 // عدد القطرات المطلوب (المراحل)
    lives: 3,                     // null = بلا قلوب
    timeLimit: null,              // بالثواني (عاصفة الوقت)
    ramp: null,                   // { every, mul, tierEvery, tierMax }
    specials: false,
    ...o,
  };
}

export function createRain(cfgIn, seed = 1) {
  const cfg = rainConfig(cfgIn);
  const rng = createRng(typeof seed === 'string' ? seed : seed >>> 0);
  const fac = createQuestionFactory(rng, { memory: 24 });
  const topics = Object.keys(cfg.tiers);
  const fmtItems = Object.entries(cfg.formats);
  const limitTicks = cfg.timeLimit ? Math.round(cfg.timeLimit * TPS) : null;

  const S = {
    tick: 0, drops: [], nextId: 1,
    spawnIn: Math.round(0.5 * TPS),
    lives: cfg.lives, popped: 0, missed: 0, wrong: 0,
    score: 0, streak: 0, bestStreak: 0,
    over: false, won: false, endReason: null,
    typed: '', iceUntil: 0,
    rampLevel: 0, tierBoost: 0,
    log: [], queue: [], answers: [], timeline: [],
    lastEvent: null,
  };

  const curTravel = () => {
    const r = cfg.ramp ? Math.pow(cfg.ramp.mul ?? 0.94, S.rampLevel) : 1;
    return cfg.travel * r;
  };
  const curSpawn = () => {
    const r = cfg.ramp ? Math.pow(cfg.ramp.mul ?? 0.94, S.rampLevel) : 1;
    return Math.max(0.8, cfg.spawn * r);
  };
  const live = () => S.drops.filter((d) => !d.dead);

  function spawn() {
    let q;
    for (let i = 0; i < 25; i++) {
      const topic = rng.pick(topics);
      const tier = Math.min(10, cfg.tiers[topic] + S.tierBoost);
      const format = fmtItems.length > 1 ? rng.weighted(fmtItems) : fmtItems[0][0];
      q = fac.make({ topic, tier, format: format === 'missing' ? 'missing' : 'input' });
      // لا تظهر قطرتان بنفس الإجابة معًا (حتى لا يلتبس الانفجار)
      if (!live().some((d) => d.q.answer === q.answer)) break;
    }
    // أرضية العدالة: لا تسقط أسرع من زمن الحل المتوقع × 1.3
    const travel = Math.max(curTravel(), (q.parMs / 1000) * 1.3, 3);
    let kind = 'normal';
    if (cfg.specials) {
      const r = rng.next();
      kind = r < 0.07 ? 'gold' : r < 0.11 ? 'ice' : r < 0.14 ? 'storm' : 'normal';
    }
    // موضع أفقي بعيد عن القطرات القريبة من الأعلى حتى لا تتراكب (حتمي: من البذرة)
    let x = rng.next(), bestGap = -1;
    const near = live().filter((o) => o.y < 0.45);
    for (let k = 0; k < 6; k++) {
      const cx = k === 0 ? x : rng.next();
      const gap = near.length ? Math.min(...near.map((o) => Math.abs(o.x - cx) + o.y * 0.8)) : 1;
      if (gap > bestGap) { bestGap = gap; x = cx; }
    }
    const d = { id: S.nextId++, q, kind, born: S.tick, y: 0, speed: 1 / (travel * TPS), x, dead: false };
    S.drops.push(d);
    return d;
  }

  function popDrop(d, events, chain = false) {
    d.dead = true; d.poppedAt = S.tick;
    S.popped++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    const height = Math.max(0, 1 - d.y);
    const p = answerPoints({ correct: true, tier: d.q.tier, streak: S.streak });
    let pts = p.total + Math.round(50 * height);
    if (d.kind === 'gold') pts *= 2;
    S.score += pts;
    const ms = Math.round((S.tick - d.born) * TICK_MS);
    S.answers.push({ op: d.q.op, topic: d.q.topic, tier: d.q.tier, format: d.q.format, correct: true, ms: chain ? null : ms });
    events.push({ type: 'pop', drop: d, points: pts, chain });
    if (cfg.ramp && S.popped % (cfg.ramp.every || 5) === 0) S.rampLevel++;
    if (cfg.ramp?.tierEvery && S.popped % cfg.ramp.tierEvery === 0) S.tierBoost = Math.min(cfg.ramp.tierMax ?? 3, S.tierBoost + 1);
    if (!chain && d.kind === 'ice') { S.iceUntil = S.tick + ICE_TICKS; events.push({ type: 'ice' }); }
    if (!chain && d.kind === 'storm') {
      events.push({ type: 'storm' });
      for (const o of live()) popDrop(o, events, true);
    }
  }

  function end(reason, won, events) {
    if (S.over) return;
    S.over = true; S.won = won; S.endReason = reason;
    S.timeline.push([S.tick, S.score]);
    events.push({ type: 'over', won, reason });
  }

  function resolve(forced, events) {
    if (!S.typed || S.typed === '-') { if (forced) S.typed = ''; return; }
    const val = Number(S.typed);
    const ds = live();
    const hit = ds.filter((d) => d.q.answer === val).sort((a, b) => b.y - a.y)[0];
    const amb = ds.some((d) => d.q.answer !== val && String(d.q.answer).startsWith(S.typed));
    const pre = ds.some((d) => String(d.q.answer).startsWith(S.typed));
    if (hit && (forced || !amb)) {
      S.typed = '';
      popDrop(hit, events);
      if (cfg.target && S.popped >= cfg.target) end('target', true, events);
      return;
    }
    if (forced || !pre) {
      S.wrong++; S.streak = 0; S.typed = '';
      events.push({ type: 'wrong' });
    }
  }

  function applyKey(k, events) {
    if (k === 'back') { S.typed = S.typed.slice(0, -1); return; }
    if (k === 'clear') { S.typed = ''; return; }
    if (k === 'ok') return resolve(true, events);
    if (k === '-') { S.typed = S.typed.startsWith('-') ? S.typed.slice(1) : '-' + S.typed; return resolve(false, events); }
    if (/^\d$/.test(k) && S.typed.replace('-', '').length < 6) { S.typed += k; return resolve(false, events); }
  }

  const api = {
    cfg, state: S, limitTicks,
    /** يضع مفتاحًا في الطابور؛ يُطبَّق في بداية النبضة التالية (ويُسجَّل للإعادة) */
    input(k) { if (!S.over) S.queue.push(k); },
    /** نص الإدخال المعروض فورًا (قبل تطبيق النبضة) — للواجهة فقط */
    previewTyped() {
      let t = S.typed;
      for (const k of S.queue) {
        if (k === 'back') t = t.slice(0, -1);
        else if (k === 'clear' || k === 'ok') t = '';
        else if (k === '-') t = t.startsWith('-') ? t.slice(1) : '-' + t;
        else if (/^\d$/.test(k) && t.replace('-', '').length < 6) t += k;
      }
      return t;
    },
    /** نبضة واحدة (1/60 ثانية). يعيد الأحداث. */
    step() {
      const events = [];
      if (S.over) return events;
      // ١) الإدخالات
      for (const k of S.queue) { S.log.push([S.tick, k]); applyKey(k, events); if (S.over) break; }
      S.queue.length = 0;
      if (S.over) return events;
      // ٢) الظهور
      S.spawnIn--;
      const alive = live().length;
      const room = cfg.target ? S.popped + alive < cfg.target : true;
      if (S.spawnIn <= 0 && alive < cfg.maxDrops && room) {
        events.push({ type: 'spawn', drop: spawn() });
        S.spawnIn = Math.round(curSpawn() * TPS);
      }
      // ٣) السقوط
      const slow = S.tick < S.iceUntil ? 0.45 : 1;
      for (const d of S.drops) {
        if (d.dead) continue;
        d.y += d.speed * slow;
        if (d.y >= 1) {
          d.dead = true; d.missedAt = S.tick;
          S.missed++; S.streak = 0;
          S.answers.push({ op: d.q.op, topic: d.q.topic, tier: d.q.tier, format: d.q.format, correct: false, ms: null, timeout: true });
          if (S.lives != null) S.lives--;
          events.push({ type: 'miss', drop: d });
          if (S.lives != null && S.lives <= 0) { end('lives', false, events); break; }
        }
      }
      S.drops = S.drops.filter((d) => !d.dead || S.tick - (d.poppedAt ?? d.missedAt ?? S.tick) < 30);
      S.tick++;
      if (S.tick % 30 === 0) S.timeline.push([S.tick, S.score]);
      if (!S.over && limitTicks && S.tick >= limitTicks) end('time', !cfg.target || S.popped >= cfg.target, events);
      return events;
    },
    /** إنهاء يدوي (خروج) */
    quit() { const ev = []; end('quit', false, ev); return ev; },
    remainingMs() { return limitTicks ? Math.max(0, (limitTicks - S.tick) * TICK_MS) : null; },
    summary() {
      const answered = S.popped + S.missed + S.wrong;
      const timed = S.answers.filter((a) => a.ms != null);
      const perOp = {};
      for (const a of S.answers) { const o = (perOp[a.op] ||= { q: 0, c: 0 }); o.q++; if (a.correct) o.c++; }
      return {
        score: S.score, correct: S.popped, popped: S.popped, missed: S.missed, wrong: S.wrong, answered,
        accuracy: answered ? S.popped / answered : 0, bestStreak: S.bestStreak, won: S.won, endReason: S.endReason,
        lives: S.lives, ticks: S.tick, activeMs: Math.round(S.tick * TICK_MS), timeLeftMs: api.remainingMs(),
        avgMs: timed.length ? Math.round(timed.reduce((s, a) => s + a.ms, 0) / timed.length) : null,
        perOp, answers: S.answers.slice(), skipped: 0,
      };
    },
  };
  return api;
}

/**
 * يعيد تشغيل جولة من سجل الإدخال ويعيد ملخصها. يُستخدم في الخادم للتحقق.
 * log: [[tick, key], ...] مرتّب. endTick: نبضة الانتهاء المعلنة من الجهاز.
 */
export function replayRain(cfg, seed, log, { endTick = null, maxTicks = 60 * 60 * 30 } = {}) {
  const R = createRain(cfg, seed);
  let i = 0;
  const cap = Math.min(maxTicks, endTick != null ? endTick + 1 : maxTicks);
  while (!R.state.over && R.state.tick < cap) {
    while (i < log.length && log[i][0] <= R.state.tick) {
      if (log[i][0] === R.state.tick) R.input(String(log[i][1]));
      i++;
    }
    R.step();
  }
  if (!R.state.over && endTick != null && R.state.tick >= endTick) R.quit();
  return { summary: R.summary(), timeline: R.state.timeline.slice(), state: R.state };
}

/** فحص معقولية بشرية: إجابات أسرع من 250ms بالمتوسط على مسائل حقيقية غير ممكنة */
export function plausible(summary) {
  const timed = summary.answers.filter((a) => a.correct && a.ms != null);
  if (timed.length < 5) return true;
  const fast = timed.filter((a) => a.ms < 250).length;
  return fast / timed.length < 0.3;
}

/* ---------------- إعدادات المطر لكل نمط ---------------- */
export const RAIN_DIFFS = {
  easy: { tiers: { add: 2, sub: 2 }, travel: 10, spawn: 3.2, maxDrops: 2 },
  medium: { tiers: { add: 3, sub: 3, mul: 2 }, travel: 9, spawn: 2.7, maxDrops: 3 },
  hard: { tiers: { add: 4, sub: 4, mul: 3, div: 3 }, travel: 8.5, spawn: 2.4, maxDrops: 3 },
  expert: { tiers: { add: 6, sub: 6, mul: 4, div: 4 }, travel: 8, spawn: 2.1, maxDrops: 4 },
};
export const RAIN_LIVES = 3;

/** عاصفة الوقت: أكبر عدد من القطرات خلال مدة محددة (بلا قلوب، المطر يشتد) */
export const stormConfig = (diff = 'medium', seconds = 60, specials = true) => rainConfig({
  ...RAIN_DIFFS[diff], lives: null, timeLimit: seconds, specials,
  ramp: { every: 6, mul: 0.95, tierEvery: 10, tierMax: 2 },
});
/** البقاء: مطر لا ينتهي يشتد تدريجيًا، و٣ قلوب */
export const survivalConfig = (diff = 'medium') => rainConfig({
  ...RAIN_DIFFS[diff], lives: 3, specials: true,
  ramp: { every: 5, mul: 0.94, tierEvery: 8, tierMax: 4 },
});
/** المطر الكلاسيكي: هدف قطرات و٣ قلوب */
export const classicConfig = (diff = 'medium', target = 20) => rainConfig({ ...RAIN_DIFFS[diff], lives: 3, target });
