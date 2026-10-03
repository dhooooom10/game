/* =========================================================================
   تشغيل الجولات: بناء مواصفة كل نمط، وتقييم النتيجة، وتطبيق المكافآت مرة واحدة.
   ========================================================================= */
import { journeySpec, evaluateJourney, levelInfo, timeSpec, survivalSpec, practiceSpec, lessonSpec, evaluateLesson,
  dailySpec, evaluateDaily, timeRecordKey, survivalRecordKey, TOTAL_LEVELS, WORLDS, worldOf } from './core/modes.js';
import { commitRound, recordDaily, todayStr } from './core/progression.js';
import { findPath, lessonKey } from './core/curriculum.js';
import { parTime } from './core/questions.js';
import { randomSeed } from './core/rng.js';
import { t } from './i18n.js';

export const PERSISTED = new Set(['journey', 'time', 'survival', 'practice', 'lesson', 'daily']);

/* ---------- أسئلة الشرح التفاعلي (ثابتة وسهلة) ---------- */
const N = (n) => ({ n });
const TUT = [
  { kind: 'expr', topic: 'add', op: 'add', tier: 1, format: 'input', dir: 'ltr', parts: [N(2), { op: '+' }, N(3), { eq: true }, { blank: true }], answer: 5, parMs: 5000, sig: 'tut1',
    explain: { key: 'ex.addCheck', p: { e: [N(2), { op: '+' }, N(3), { eq: true }, N(5)], back: [N(5), { op: '−' }, N(3), { eq: true }, N(2)] } } },
  { kind: 'expr', topic: 'add', op: 'add', tier: 1, format: 'choice', dir: 'ltr', parts: [N(4), { op: '+' }, N(4), { eq: true }, { blank: true }], answer: 8, choices: [6, 8, 9, 7], parMs: 5000, sig: 'tut2',
    explain: { key: 'ex.addCheck', p: { e: [N(4), { op: '+' }, N(4), { eq: true }, N(8)], back: [N(8), { op: '−' }, N(4), { eq: true }, N(4)] } } },
  { kind: 'missing', topic: 'add', op: 'add', tier: 1, format: 'missing', dir: 'ltr', parts: [N(5), { op: '+' }, { blank: true }, { eq: true }, N(8)], answer: 3, parMs: 6000, sig: 'tut3',
    explain: { key: 'ex.missing', p: { e: [N(8), { op: '−' }, N(5), { eq: true }, N(3)] } } },
];

/**
 * يبني جولة. يعيد { spec, meta } حيث meta تصف سلوك الواجهة.
 */
export function buildRun(kind, args, data, seed = randomSeed()) {
  let spec, meta = { title: '', label: '', pausable: true, explain: false, timed: false, countdown: true };
  switch (kind) {
    case 'journey': {
      spec = journeySpec(args.level, { seed });
      const info = spec.info;
      meta.title = t('jr.levelN', { n: args.level });
      meta.label = `${t('jr.levelN', { n: args.level })} · ${t('world.' + WORLDS[info.world].key)}`;
      meta.timed = info.kind === 'sprint';
      meta.goalLabel = info.kind === 'sprint' ? t('jr.kind.sprint', { g: info.goal, s: info.timeLimitMs / 1000 }) : null;
      break;
    }
    case 'time':
      spec = timeSpec(args.dur, args.diff, { seed });
      meta.label = `${t('mode.time')} · ${t('common.sec', { n: args.dur })} · ${t('diff.' + args.diff)}`;
      meta.timed = true;
      break;
    case 'survival':
      spec = survivalSpec(args.diff, { seed });
      meta.label = `${t('mode.survival')} · ${t('diff.' + args.diff)}`;
      meta.timed = true;
      break;
    case 'practice':
      spec = practiceSpec(args.opts, data.skill, { seed });
      meta.label = `${t('mode.practice')} · ${args.opts.topics.map((x) => t('op.' + x)).join('، ')}`;
      meta.explain = true; meta.countdown = false;
      break;
    case 'lesson': {
      spec = lessonSpec(args.pid, args.li, { seed });
      const path = findPath(args.pid);
      const L = path.lessons[args.li];
      meta.label = `${path.icon} ${pick(L.n, data)}`;
      meta.explain = true; meta.countdown = false;
      break;
    }
    case 'daily':
      spec = dailySpec(args.date);
      meta.label = `${t('daily.title')}${args.official ? '' : ' · ' + t('daily.practice')}`;
      meta.pausable = false; meta.timed = true;
      break;
    case 'tutorial':
      spec = { id: 'tutorial-' + seed, mode: 'tutorial', totalQuestions: 3, timeLimitMs: null, lives: null, useSpeed: false, resumePolicy: 'keep', source: (i) => TUT[i] };
      meta.label = t('mode.tutorial'); meta.explain = false; meta.countdown = false; meta.tutorial = true;
      break;
    default:
      throw new Error('kind ' + kind);
  }
  return { spec, meta, seed };
}

export const pick = (obj, data) => obj[data.settings.lang] || obj.en || obj.ar;

/* ---------- نصيحة التحسين ---------- */
export function tipFor(sum, timed) {
  const wrongBy = {}, slowBy = {};
  for (const a of sum.answers) {
    if (a.skipped) continue;
    if (!a.correct) wrongBy[a.op] = (wrongBy[a.op] || 0) + 1;
    if (a.ms != null) { const s = (slowBy[a.op] ||= { ms: 0, par: 0, n: 0 }); s.ms += a.ms; s.par += parTime(a.topic, a.tier, a.format); s.n++; }
  }
  const worst = Object.entries(wrongBy).sort((a, b) => b[1] - a[1])[0];
  if (sum.answered >= 3 && sum.accuracy < 0.7) return worst && worst[1] >= 2 ? { key: 'tip.wrongOp', op: worst[0] } : { key: 'tip.accuracy' };
  if (worst && worst[1] >= 2) return { key: 'tip.wrongOp', op: worst[0] };
  const slow = Object.entries(slowBy).filter(([, s]) => s.n >= 2).map(([op, s]) => [op, s.ms / s.par]).sort((a, b) => b[1] - a[1])[0];
  if (slow && slow[1] > 1.4) return timed ? { key: 'tip.speed' } : { key: 'tip.slowOp', op: slow[0] };
  if (sum.bestStreak < 5 && sum.answered >= 6) return { key: 'tip.streak' };
  return { key: 'tip.great' };
}

/**
 * ينهي الجولة: يقيّم، يحدّث التقدّم، يطبّق المكافآت مرة واحدة، ويعيد بيانات شاشة النتيجة.
 */
export function finishRun(kind, args, spec, sum, data, date = todayStr()) {
  const base = { id: sum.id || spec.id, mode: kind === 'lesson' ? 'lesson' : kind, score: sum.score, correct: sum.correct, answered: sum.answered,
    bestStreak: sum.bestStreak, perOp: sum.perOp, activeMs: sum.activeMs };
  const view = { kind, args, sum, stars: null, score: sum.score, record: null, notes: [], mood: 'happy', tip: tipFor(sum, ['time', 'survival', 'daily'].includes(kind)) };
  let round = base;

  if (kind === 'journey') {
    const info = levelInfo(args.level);
    const ev = evaluateJourney(info, sum);
    const old = data.journey.stars[args.level] || 0;
    if (ev.passed) {
      data.journey.stars[args.level] = Math.max(old, ev.stars);
      if (args.level >= data.journey.unlocked && args.level < TOTAL_LEVELS) data.journey.unlocked = args.level + 1;
    }
    const prevBest = data.journey.best[args.level] || 0;
    if (ev.finalScore > prevBest) data.journey.best[args.level] = ev.finalScore;
    round = { ...base, score: ev.finalScore, passed: ev.passed, stars: ev.stars, starsGained: Math.max(0, ev.stars - old), level: args.level };
    Object.assign(view, {
      title: ev.passed ? (info.kind === 'boss' ? t('res.bossPassed') : t('res.levelPassed', { n: args.level })) : t('res.levelFailed'),
      stars: ev.stars, score: ev.finalScore, passed: ev.passed, mood: ev.passed ? (ev.stars === 3 ? 'cheer' : 'happy') : 'think',
      bonus: ev.passed ? ev.bonus : 0, info,
      record: prevBest && ev.finalScore > prevBest ? { prev: prevBest } : null,
      celebrate: ev.passed && (ev.stars === 3 || info.kind === 'boss' || (ev.stars > old && old === 0 && info.world >= 5)),
    });
    if (!ev.passed) view.notes.push(info.kind === 'sprint' ? t('res.sprintRule', { n: info.goal }) : info.kind === 'boss' ? t('res.bossRule') : t('res.passRule'));
  } else if (kind === 'time' || kind === 'survival') {
    const key = kind === 'time' ? timeRecordKey(args.dur, args.diff) : survivalRecordKey(args.diff);
    round = { ...base, recordKey: key, recordValue: sum.correct, duration: args.dur, diff: args.diff };
    Object.assign(view, { title: kind === 'time' ? t('res.timeUp') : t('res.survivalEnd', { n: sum.correct }), mood: sum.correct >= 10 ? 'cheer' : 'happy', recordKey: key });
  } else if (kind === 'practice') {
    Object.assign(view, { title: t('res.practiceEnd'), mood: sum.accuracy >= 0.8 ? 'cheer' : 'happy' });
  } else if (kind === 'lesson') {
    const ev = evaluateLesson(spec, sum);
    const key = lessonKey(args.pid, args.li);
    const old = data.lessons.done[key] || 0;
    const path = findPath(args.pid);
    if (ev.passed) {
      data.lessons.done[key] = Math.max(old, ev.stars);
      const nextIdx = args.li + 2;
      if (nextIdx <= path.lessons.length) data.lessons.unlocked[args.pid] = Math.max(data.lessons.unlocked[args.pid] || 1, nextIdx);
    }
    const pathComplete = path.lessons.every((_, i) => (data.lessons.done[lessonKey(args.pid, i)] || 0) > 0);
    round = { ...base, passed: ev.passed, stars: ev.stars, starsGained: Math.max(0, ev.stars - old), pathComplete };
    Object.assign(view, { title: ev.passed ? t('res.lessonPassed') : t('res.lessonFailed'), stars: ev.stars, passed: ev.passed, mood: ev.passed ? (ev.stars === 3 ? 'cheer' : 'happy') : 'think', celebrate: ev.stars === 3 && old < 3 });
    if (!ev.passed) view.notes.push(t('res.lessonRule'));
  } else if (kind === 'daily') {
    const ev = evaluateDaily(sum);
    let official = false;
    if (args.official) official = recordDaily(data, args.date, { score: ev.finalScore, correct: sum.correct, total: sum.answers.length, ms: sum.activeMs });
    round = { ...base, score: ev.finalScore, official, recordKey: official ? 'daily' : null, recordValue: ev.finalScore };
    if (!official) round.id = spec.id + '-p' + Date.now(); // جولات التدريب لا تتعارض مع الرسمية ولا تمنح مكافأة يومية
    Object.assign(view, { title: t('res.dailyEnd'), score: ev.finalScore, bonus: ev.bonus, mood: 'cheer', official, recordKey: official ? 'daily' : null });
    view.notes.push(official ? t('res.official') : t('res.practiceRun'));
  } else if (kind === 'tutorial') {
    return { view: { ...view, title: t('tut.done') }, rewards: null };
  }

  const rewards = commitRound(data, round, date);
  if (rewards.records?.length && rewards.records[0].prev != null) view.record = { prev: rewards.records[0].prev };
  else if (rewards.records?.length && kind !== 'journey') view.firstRecord = true;
  if (view.record) view.celebrate = true;
  view.rewards = rewards;
  return { view, rewards };
}

/** أفضل مرحلة للعب الآن (أول مرحلة غير مجتازة، أو أول مرحلة بأقل من ٣ نجوم) */
export function nextJourneyLevel(data) {
  const u = Math.min(TOTAL_LEVELS, data.journey.unlocked);
  if (!data.journey.stars[u]) return u;
  for (let L = 1; L <= TOTAL_LEVELS; L++) if ((data.journey.stars[L] || 0) < 3) return L;
  return TOTAL_LEVELS;
}
export { worldOf };
