/* =========================================================================
   الأنماط — كل نمط يبني «مواصفة جولة» لمحرّك session.js ويقيّم النتيجة.
   كل الأنماط تتشارك مولّد الأسئلة نفسه.
   ========================================================================= */
import { createRng, hashString } from './rng.js';
import { createQuestionFactory, generateQuestion, formatsFor, clampTier, OPS, parTime } from './questions.js';
import { tierFromSkill } from './adaptive.js';
import { accuracyBonus } from './scoring.js';
import { findPath, lessonStars } from './curriculum.js';

/* ---------------- أدوات ---------------- */
function pickFormat(rng, topic, weights) {
  const allowed = formatsFor(topic);
  const items = Object.entries(weights).filter(([f, w]) => w > 0 && allowed.includes(f));
  return items.length ? rng.weighted(items) : 'input';
}

/* =========================================================================
   رحلة المستويات — ١٠ عوالم × ١٠ مراحل (أسماء العوالم من النسخة الأصلية)
   ========================================================================= */
export const WORLD_COUNT = 10, LEVELS_PER_WORLD = 10, TOTAL_LEVELS = 100;

// لكل عالم: نطاق مستوى الصعوبة لكل عملية [بداية، نهاية] والصيغ
export const WORLDS = [
  { key: 'w1', icon: '🌦️', color: '#5FD3F5', ops: { add: [1, 2], sub: [1, 2] }, formats: { input: 2, choice: 3 } },
  { key: 'w2', icon: '☁️', color: '#7EC8E8', ops: { add: [2, 3], sub: [2, 3], mul: [1, 2] }, formats: { input: 3, choice: 2, missing: 1 } },
  { key: 'w3', icon: '💧', color: '#4FB3E8', ops: { add: [3, 3], sub: [3, 3], mul: [2, 3], div: [1, 2] }, formats: { input: 3, choice: 2, missing: 1 } },
  { key: 'w4', icon: '🌧️', color: '#4A9BE0', ops: { add: [3, 4], sub: [3, 4], mul: [3, 3], div: [2, 3] }, formats: { input: 3, choice: 2, missing: 1, compare: 1 } },
  { key: 'w5', icon: '🌊', color: '#3C88DA', ops: { add: [4, 5], sub: [4, 5], mul: [3, 4], div: [3, 4], order: [2, 3] }, formats: { input: 3, choice: 1, missing: 2, compare: 2 } },
  { key: 'w6', icon: '⚡', color: '#8E7BEE', ops: { add: [5, 6], sub: [5, 6], mul: [4, 4], div: [4, 4], order: [3, 3] }, formats: { input: 3, choice: 1, missing: 2, compare: 1 } },
  { key: 'w7', icon: '🌪️', color: '#B06FE0', ops: { add: [6, 6], sub: [6, 7], mul: [4, 5], div: [4, 5], order: [3, 4] }, formats: { input: 3, choice: 1, missing: 2, compare: 2 } },
  { key: 'w8', icon: '🌀', color: '#E06FA8', ops: { add: [6, 7], sub: [8, 8], mul: [5, 5], div: [5, 5], order: [4, 4] }, formats: { input: 4, choice: 1, missing: 2, compare: 1 } },
  { key: 'w9', icon: '🔥', color: '#F0844C', ops: { add: [7, 8], sub: [8, 9], mul: [5, 6], div: [5, 6], order: [4, 5] }, formats: { input: 4, choice: 1, missing: 2, compare: 2 } },
  { key: 'w10', icon: '👑', color: '#FFC94A', ops: { add: [8, 9], sub: [9, 9], mul: [6, 7], div: [6, 7], order: [5, 5] }, formats: { input: 4, choice: 1, missing: 2, compare: 2 } },
];

export const worldOf = (level) => Math.floor((level - 1) / LEVELS_PER_WORLD);

/** وصف مرحلة: نوعها وهدفها ومستوى صعوبتها */
export function levelInfo(level) {
  const L = Math.max(1, Math.min(TOTAL_LEVELS, level));
  const w = worldOf(L), i = ((L - 1) % LEVELS_PER_WORLD) + 1;
  const world = WORLDS[w];
  const kind = i === 10 ? 'boss' : (i === 4 || i === 8) ? 'sprint' : 'classic';
  const frac = (i - 1) / 9;
  const tiers = {};
  for (const [op, [a, b]] of Object.entries(world.ops)) tiers[op] = clampTier(a + (b - a) * (kind === 'boss' ? 1 : frac));
  const questions = kind === 'boss' ? 12 : w === 0 ? 8 : 10;
  let goal = null, timeLimitMs = null, lives = null;
  if (kind === 'sprint') {
    goal = w === 0 ? 8 : 10;
    // الوقت المتاح: مجموع الزمن المتوقّع × ١٫٨ مقرّبًا لأقرب ٥ ثوانٍ
    const ops = Object.keys(tiers);
    const avgPar = ops.reduce((s, op) => s + parTime(op, tiers[op], 'input'), 0) / ops.length;
    timeLimitMs = Math.ceil((goal * avgPar * 1.8) / 5000) * 5000;
  }
  if (kind === 'boss') lives = 3;
  return { level: L, world: w, index: i, kind, tiers, formats: world.formats, questions: kind === 'sprint' ? null : questions, goal, timeLimitMs, lives };
}

export function journeySpec(level, { seed = Date.now() } = {}) {
  const info = levelInfo(level);
  const rng = createRng(seed);
  const fac = createQuestionFactory(rng);
  const topics = Object.keys(info.tiers);
  return {
    id: `j${level}-${seed}`, mode: 'journey', level: info.level, info,
    totalQuestions: info.questions, goalCorrect: info.goal, timeLimitMs: info.timeLimitMs, lives: info.lives,
    useSpeed: info.kind === 'sprint', resumePolicy: 'swap',
    source: () => {
      const topic = rng.pick(topics);
      return fac.make({ topic, tier: info.tiers[topic], format: pickFormat(rng, topic, info.formats) });
    },
  };
}

export function evaluateJourney(info, sum) {
  let passed = false, stars = 0;
  if (info.kind === 'classic') {
    passed = sum.endReason === 'done' && sum.accuracy >= 0.7;
    stars = !passed ? 0 : sum.accuracy >= 0.95 ? 3 : sum.accuracy >= 0.85 ? 2 : 1;
  } else if (info.kind === 'sprint') {
    passed = sum.endReason === 'goal';
    const f = info.timeLimitMs ? sum.timeLeftMs / info.timeLimitMs : 0;
    stars = !passed ? 0 : f >= 0.4 ? 3 : f >= 0.2 ? 2 : 1;
  } else {
    passed = sum.endReason === 'done' && sum.livesLeft > 0;
    stars = passed ? Math.max(1, Math.min(3, sum.livesLeft)) : 0;
  }
  const bonus = info.kind === 'classic' ? accuracyBonus(sum.correct, sum.answered) : 0;
  return { passed, stars, bonus, finalScore: sum.score + (passed ? bonus : 0) };
}

/* =========================================================================
   تحدّي الوقت
   ========================================================================= */
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
const START_TIER = { easy: 2, medium: 4, hard: 6 };
const TIME_OPS = { easy: ['add', 'sub', 'mul'], medium: OPS, hard: OPS };
const TIME_FORMATS = { easy: { input: 3, choice: 3 }, medium: { input: 4, choice: 2, missing: 1, compare: 1 }, hard: { input: 4, choice: 1, missing: 2, compare: 1 } };
export const TIME_DURATIONS = [30, 60, 120];

export function timeSpec(durationSec = 60, diff = 'medium', { seed = Date.now() } = {}) {
  const rng = createRng(seed);
  const fac = createQuestionFactory(rng);
  const base = START_TIER[diff] || 4;
  return {
    id: `t${durationSec}${diff}-${seed}`, mode: 'time', duration: durationSec, diff,
    totalQuestions: null, timeLimitMs: durationSec * 1000, lives: null, useSpeed: true, resumePolicy: 'swap',
    source: (i, ctx) => {
      const topic = rng.pick(TIME_OPS[diff] || OPS);
      const tier = clampTier(base + Math.min(3, Math.floor(ctx.correct / 6)) - (topic === 'div' || topic === 'mul' ? 1 : 0));
      return fac.make({ topic, tier, format: pickFormat(rng, topic, TIME_FORMATS[diff]) });
    },
  };
}
export const timeRecordKey = (dur, diff) => `time:${dur}:${diff}`;

/* =========================================================================
   البقاء — ٣ محاولات، ومؤقت لكل سؤال يقصر تدريجيًا
   ========================================================================= */
const SURV_START_MS = { easy: 15000, medium: 12000, hard: 10000 };
export function survivalPerQuestionMs(diff, correct) {
  const start = SURV_START_MS[diff] || 12000;
  return Math.max(5000, start - correct * 200);
}
export function survivalSpec(diff = 'medium', { seed = Date.now() } = {}) {
  const rng = createRng(seed);
  const fac = createQuestionFactory(rng);
  const base = START_TIER[diff] || 4;
  return {
    id: `s${diff}-${seed}`, mode: 'survival', diff,
    totalQuestions: null, timeLimitMs: null, lives: 3, useSpeed: true, resumePolicy: 'swap',
    perQuestionMs: (S) => survivalPerQuestionMs(diff, S.correct),
    source: (i, ctx) => {
      const topic = rng.pick(TIME_OPS[diff] || OPS);
      const tier = clampTier(base + Math.min(4, Math.floor(ctx.correct / 5)) - (topic === 'div' || topic === 'mul' ? 1 : 0));
      return fac.make({ topic, tier, format: pickFormat(rng, topic, TIME_FORMATS[diff]) });
    },
  };
}
export const survivalRecordKey = (diff) => `survival:${diff}`;

/* =========================================================================
   التدريب الحر
   opts: { topics:[...], level:'auto'|1..10, format:'mixed'|..., timer:false|true, length:10|20|null }
   ========================================================================= */
export const PRACTICE_TOPICS = ['add', 'sub', 'mul', 'div', 'order', 'frac', 'percent', 'power'];
export const PRACTICE_Q_MS = 20000;
export function practiceSpec(opts, skills = {}, { seed = Date.now() } = {}) {
  const rng = createRng(seed);
  const fac = createQuestionFactory(rng);
  const topics = (opts.topics && opts.topics.length ? opts.topics : ['add']).filter((t) => PRACTICE_TOPICS.includes(t));
  const weights = opts.format && opts.format !== 'mixed' ? { [opts.format]: 1 } : { input: 3, choice: 2, missing: 1, compare: 1 };
  return {
    id: `p-${seed}`, mode: 'practice', opts,
    totalQuestions: opts.length || null, timeLimitMs: null, lives: null, useSpeed: false,
    perQuestionMs: opts.timer ? PRACTICE_Q_MS : null,
    resumePolicy: opts.timer ? 'swap' : 'keep',
    source: () => {
      const topic = rng.pick(topics);
      const tier = opts.level === 'auto' || opts.level == null ? tierFromSkill(skills[topic]) : clampTier(opts.level);
      return fac.make({ topic, tier, format: pickFormat(rng, topic, weights) });
    },
  };
}

/* =========================================================================
   درس من المنهج
   ========================================================================= */
export function lessonSpec(pid, li, { seed = Date.now() } = {}) {
  const path = findPath(pid);
  if (!path || !path.lessons[li]) throw new Error('lesson not found');
  const lesson = path.lessons[li];
  const rng = createRng(seed);
  const fac = createQuestionFactory(rng);
  const fmts = lesson.formats || (lesson.choiceOnly ? ['choice'] : ['input', 'choice']);
  const weights = Object.fromEntries(fmts.map((f) => [f, f === 'input' ? 2 : 1]));
  const items = lesson.topics.map((t) => [t, t.w || 1]);
  return {
    id: `l${pid}${li}-${seed}`, mode: 'lesson', pid, li, lesson,
    totalQuestions: lesson.q || 10, timeLimitMs: null, lives: null, useSpeed: false, resumePolicy: 'keep',
    source: () => {
      const t = rng.weighted(items);
      return fac.make({ topic: t.topic, tier: t.tier, cfg: t.cfg, format: pickFormat(rng, t.topic, weights) });
    },
  };
}
export function evaluateLesson(spec, sum) {
  const stars = lessonStars(sum.accuracy, sum.answered, spec.totalQuestions);
  return { passed: stars > 0, stars };
}

/* =========================================================================
   التحدي اليومي — ١٥ سؤالًا ثابتة لكل يوم (البذرة = التاريخ)
   ========================================================================= */
export const DAILY_COUNT = 15;
export function dailyQuestions(dateStr) {
  const rng = createRng('daily:' + dateStr);
  const fac = createQuestionFactory(rng);
  const order = rng.shuffle(['add', 'sub', 'mul', 'div', 'add', 'sub', 'mul', 'div', 'order', 'add', 'sub', 'mul', 'div', 'add', 'mul']);
  const qs = [];
  for (let i = 0; i < DAILY_COUNT; i++) {
    const topic = order[i];
    const tier = clampTier(2 + Math.floor(i / 3) - (topic === 'order' ? 1 : 0));
    const format = pickFormat(rng, topic, { input: 4, choice: 2, missing: 2, compare: 1 });
    qs.push(fac.make({ topic, tier, format }));
  }
  return qs;
}
export function dailySpec(dateStr) {
  const qs = dailyQuestions(dateStr);
  return {
    id: `d${dateStr}`, mode: 'daily', date: dateStr,
    totalQuestions: DAILY_COUNT, timeLimitMs: null, lives: null, useSpeed: true, resumePolicy: 'skip',
    source: (i) => qs[i],
  };
}
export function evaluateDaily(sum) {
  const bonus = accuracyBonus(sum.correct, sum.answered + sum.skipped);
  return { bonus, finalScore: sum.score + bonus };
}

/* =========================================================================
   تحدّي صديق على الجهاز نفسه — أسئلة متكافئة في الصعوبة
   لكل خانة قالب ثابت (العملية + المستوى + الصيغة) والأرقام تختلف لكل لاعب،
   فلا يستفيد الثاني من مشاهدة أسئلة الأول.
   ========================================================================= */
export function friendTemplates({ count = 10, diff = 'medium', topics = OPS, seed }) {
  const rng = createRng('friend:' + seed);
  const base = START_TIER[diff] || 4;
  const list = topics.length ? topics : OPS;
  const out = [];
  for (let i = 0; i < count; i++) {
    const topic = list[i % list.length];
    out.push({ topic, tier: clampTier(base + Math.floor(i / Math.max(3, Math.ceil(count / 3))) - (topic === 'mul' || topic === 'div' ? 1 : 0)),
      format: pickFormat(rng, topic, TIME_FORMATS[diff] || TIME_FORMATS.medium) });
  }
  return rng.shuffle(out);
}
export function friendSpec(templates, player, seed) {
  return {
    id: `f${seed}-${player}`, mode: 'friend', player,
    totalQuestions: templates.length, timeLimitMs: null, lives: null, useSpeed: true, resumePolicy: 'swap',
    source: (i, ctx) => {
      const tpl = templates[i];
      const rng = createRng(hashString(`${seed}:${player}:${i}:${ctx.swaps}`));
      return generateQuestion({ rng, ...tpl });
    },
  };
}
/** يحدد الفائز: النقاط ثم عدد الصحيح ثم الوقت الأقل */
export function friendWinner(a, b) {
  if (a.score !== b.score) return a.score > b.score ? 0 : 1;
  if (a.correct !== b.correct) return a.correct > b.correct ? 0 : 1;
  if (a.activeMs !== b.activeMs) return a.activeMs < b.activeMs ? 0 : 1;
  return -1;
}
