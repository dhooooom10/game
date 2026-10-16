/* «تحدّيك الخاص» الموحّد: القواعد، الأرقام القياسية، المهام، شارتا البرق والصامد، ترقية البيانات القديمة، ومنع التكرار */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRain, stormConfig, survivalConfig } from '../../public/src/core/rain.js';
import { normalizeChallenge, challengeConfig, challengeRecordKey, migrateRecordKey, evaluateBadges, isCompleted, BADGE_RULES, COMPLETE_MIN_CORRECT } from '../../public/src/core/challenge.js';
import { newProfileData, normalizeData, commitRound, recordEvent, missionIncrement, setFeatures, ensureMissions } from '../../public/src/core/progression.js';
import { finishRainRun, migrateActiveRun } from '../../public/src/runs.js';

/** لاعب آلي: يجيب عن أدنى قطرة بعد think نبضة؛ يتوقف عن الإجابة بعد stopAfter إصابة */
function play(cfg, seed, { think = 30, stopAfter = Infinity, wrongEvery = 0, maxTicks = 60 * 600 } = {}) {
  const R = createRain(cfg, seed);
  let target = null, wait = 0, n = 0;
  while (!R.state.over && R.state.tick < maxTicks) {
    const live = R.state.drops.filter((d) => !d.dead);
    if (!target || target.dead) { target = live.sort((a, b) => b.y - a.y)[0] || null; wait = R.state.tick + think; }
    if (target && R.state.tick >= wait && R.state.popped < stopAfter) {
      n++;
      const ans = wrongEvery && n % wrongEvery === 0 ? target.q.answer + 1 : target.q.answer;
      for (const ch of String(ans)) R.input(ch);
      R.input('ok'); target = null;
    }
    R.step();
  }
  return R.summary();
}
const D = (date = '2026-03-01') => { const d = newProfileData('ar'); setFeatures({ online: true }); ensureMissions(d, date); return d; };
const setMissions = (d, ids) => { d.missions.list = ids.map((id) => ({ id, goal: id === 'rounds3' ? 3 : 1, progress: 0, done: false, claimed: false })); };

test('normalize: legacy custom fields, conflicting settings and bad values are fixed', () => {
  assert.deepEqual(normalizeChallenge({ mode: 'custom', ops: ['add'], level: 'hard', speed: 'insane', end: 'lives', accel: true }),
    { mode: 'custom', ops: ['add'], level: 'hard', speed: 'insane', dur: 0, lives: 3, accel: true });
  assert.equal(normalizeChallenge({ mode: 'custom', end: 't120' }).dur, 120);
  const c = normalizeChallenge({ mode: 'custom', dur: 0, lives: 0 });
  assert.equal(c.lives, 3, 'no time + unlimited tries would never end');
  assert.deepEqual(normalizeChallenge({ mode: 'time', dur: 999, diff: 'x' }), { mode: 'time', dur: 60, diff: 'medium' });
  assert.deepEqual(normalizeChallenge({ mode: 'survival', diff: 'hard' }), { mode: 'survival', diff: 'hard' });
});

test('one engine: time/survival reuse the storm/survival rules; custom uses its own speed without double acceleration', () => {
  assert.deepEqual(challengeConfig({ mode: 'time', dur: 30, diff: 'easy' }), stormConfig('easy', 30, true));
  assert.deepEqual(challengeConfig({ mode: 'survival', diff: 'medium' }), survivalConfig('medium'));
  const t = challengeConfig({ mode: 'time', dur: 60, diff: 'medium' });
  assert.equal(t.lives, null); assert.equal(t.timeLimit, 60); assert.equal(t.accel, null, 'time: ramp only');
  const s = challengeConfig({ mode: 'survival', diff: 'medium' });
  assert.equal(s.lives, 3); assert.equal(s.timeLimit, null); assert.equal(s.accel, null);
  const c = challengeConfig({ mode: 'custom', ops: ['add', 'sub'], level: 'easy', speed: 'fast', dur: 60, lives: 3, accel: true });
  assert.equal(c.ramp, null, 'custom: time acceleration only, no ramp'); assert.equal(c.accel, 0.08);
  assert.equal(c.lives, 3); assert.equal(c.timeLimit, 60); assert.ok(!c.turbo);
  assert.ok(Object.values(c.tiers).every((x) => x === 2), 'easy = single digits');
});

test('records are separated by mode and by every setting that changes difficulty; old keys migrate', () => {
  const keys = new Set([
    challengeRecordKey({ mode: 'time', dur: 60, diff: 'medium' }), challengeRecordKey({ mode: 'time', dur: 120, diff: 'medium' }),
    challengeRecordKey({ mode: 'time', dur: 60, diff: 'hard' }), challengeRecordKey({ mode: 'survival', diff: 'medium' }),
    challengeRecordKey({ mode: 'custom', speed: 'fast' }), challengeRecordKey({ mode: 'custom', speed: 'insane' }),
    challengeRecordKey({ mode: 'custom', lives: 3 }), challengeRecordKey({ mode: 'custom', accel: false }),
  ]);
  assert.equal(keys.size, 8);
  assert.equal(challengeRecordKey({ mode: 'time', dur: 60, diff: 'medium' }), 'time:60:medium', 'old time keys keep working');
  assert.equal(migrateRecordKey('custom:addmul:hard:insane:t60:1'), challengeRecordKey({ mode: 'custom', ops: ['add', 'mul'], level: 'hard', speed: 'insane', dur: 60, lives: 0, accel: true }));
  assert.equal(migrateRecordKey('time:60:medium:turbo'), 'legacy:time:60:medium:turbo');
});

test('old player data (v2) loads with progress, records, badges and settings preserved', () => {
  const old = {
    v: 2, xp: 1234, badges: { first: '2026-01-01', speed20: '2026-02-01' }, journey: { unlocked: 12, stars: { 1: 3, 2: 2 }, best: {} },
    records: { 'time:60:medium': { value: 18, score: 900 }, 'custom:add:easy:fast:t60:1': { value: 30, score: 1500 }, 'survival:hard:turbo': { value: 9, score: 300 } },
    prefs: { time: { dur: 120, diff: 'hard' }, survival: { diff: 'easy' }, custom: { ops: ['mul'], level: 'medium', speed: 'insane', end: 'lives', accel: false } },
    missions: { date: '2026-03-01', list: [{ id: 'daily1', goal: 1, progress: 0, done: false, claimed: false }, { id: 'survive10', goal: 1, progress: 1, done: true, claimed: true }, { id: 'time1', goal: 1, progress: 0, done: false, claimed: false }] },
  };
  setFeatures({ online: false });
  const d = normalizeData(old, 'ar');
  assert.equal(d.xp, 1234); assert.equal(d.journey.unlocked, 12); assert.equal(d.badges.speed20, '2026-02-01', 'earned badges kept');
  assert.equal(d.records['time:60:medium'].value, 18);
  assert.equal(d.records[challengeRecordKey({ mode: 'custom', ops: ['add'], level: 'easy', speed: 'fast', dur: 60, lives: 0, accel: true })].value, 30);
  assert.ok(d.records['legacy:survival:hard:turbo'] && !d.records['survival:hard:turbo'], 'turbo records archived, not mixed');
  assert.deepEqual(d.prefs.challenge.time, { mode: 'time', dur: 120, diff: 'hard' });
  assert.equal(d.prefs.challenge.custom.lives, 3); assert.equal(d.prefs.challenge.custom.dur, 0);
  assert.equal(d.prefs.time, undefined);
  // مهمة أُلغيت (survive10) تُستبدل بصالحة، ومكتملة تبقى مكتملة
  ensureMissions(d, '2026-03-01');
  assert.ok(d.missions.list.every((m) => m.id !== 'survive10'));
  assert.equal(d.missions.list.filter((m) => m.done).length, 1);
  assert.ok(!d.missions.list.some((m) => m.id === 'online1'), 'online missions hidden when online is unavailable');
  // جولة نشطة قديمة: «time» ← custom بإعدادات مطابقة؛ والتيربو القديم لا يُستأنف
  const act = migrateActiveRun({ engine: 'rain', kind: 'time', args: { dur: 30, diff: 'easy' }, seed: 5, log: [], tick: 0 });
  assert.equal(act.kind, 'custom');
  assert.deepEqual(challengeConfig(act.args), stormConfig('easy', 30, true));
  assert.equal(migrateActiveRun({ engine: 'rain', kind: 'survival', args: { diff: 'easy', turbo: true } }), null);
});

test('missions count only real completed play of the right kind', () => {
  const time = { mode: 'custom', sub: 'time', completed: true, correct: 9 };
  const m = (id) => ({ id, goal: 1 });
  assert.equal(missionIncrement(m('time1'), time), 1);
  assert.equal(missionIncrement(m('survive1'), time), 0);
  assert.equal(missionIncrement(m('time1'), { ...time, completed: false }), 0, 'not completed (quit/too few)');
  assert.equal(missionIncrement(m('survive1'), { mode: 'custom', sub: 'survival', completed: true }), 1);
  assert.equal(missionIncrement(m('custom1'), { mode: 'custom', sub: 'custom', completed: true }), 1);
  // تحدّي الصديق والأونلاين لا يُحتسبان «بقاء»
  for (const k of ['challenge', 'duel', 'room']) assert.equal(missionIncrement(m('survive1'), { mode: 'online', onlineKind: k, valid: true }), 0);
  assert.equal(missionIncrement(m('friend1'), { mode: 'online', onlineKind: 'challenge', valid: true }), 1);
  assert.equal(missionIncrement(m('online1'), { mode: 'online', onlineKind: 'challenge', valid: true }), 0);
  assert.equal(missionIncrement(m('online1'), { mode: 'online', onlineKind: 'ghost', valid: true }), 0, 'ghost is not a real opponent');
  assert.equal(missionIncrement(m('online1'), { mode: 'online', onlineKind: 'duel', valid: true }), 1);
  assert.equal(missionIncrement(m('friend1'), { mode: 'friend' }), 1);
});

test('finishing rounds: completion, missions + pearls once, no duplicate rewards on replayed id', () => {
  const d = D();
  setMissions(d, ['time1', 'survive1', 'custom1']);
  const a = { mode: 'time', dur: 30, diff: 'easy' };
  const sum = play(challengeConfig(a), 3);
  assert.equal(sum.endReason, 'time'); assert.ok(isCompleted(sum));
  const p0 = d.pearls, xp0 = d.xp;
  const r1 = finishRainRun('custom', a, { id: 'run-1', seed: 3 }, sum, d, '2026-03-01');
  assert.equal(r1.rewards.applied, true);
  assert.deepEqual(r1.rewards.missions.map((m) => m.id), ['time1']);
  assert.equal(d.pearls - p0, 5, 'mission pearls granted exactly once');
  const xp1 = d.xp;
  // نفس الجولة مرة ثانية (إعادة تحميل/إرسال مكرر) ← لا شيء
  const r2 = finishRainRun('custom', a, { id: 'run-1', seed: 3 }, sum, d, '2026-03-01');
  assert.equal(r2.rewards.applied, false); assert.equal(d.xp, xp1); assert.equal(d.pearls - p0, 5);
  assert.ok(xp1 > xp0);
  // جولة لم تكتمل (أقل من ٥ صحيحة) لا تُحتسب مهمة
  const short = play(challengeConfig({ mode: 'survival', diff: 'easy' }), 4, { stopAfter: 2 });
  assert.equal(short.endReason, 'lives');
  const r3 = finishRainRun('custom', { mode: 'survival', diff: 'easy' }, { id: 'run-2', seed: 4 }, short, d, '2026-03-01');
  assert.equal(r3.rewards.missions.length, 0);
  assert.equal(d.missions.list.find((m) => m.id === 'survive1').progress, 0);
  // حدث «أرسلت تحدّيًا» يُحتسب مرة واحدة
  setMissions(d, ['friend1']);
  assert.equal(recordEvent(d, { id: 'fc:x', type: 'friendSent' }, '2026-03-01').missions.length, 1);
  assert.equal(recordEvent(d, { id: 'fc:x', type: 'friendSent' }, '2026-03-01').applied, false);
});

test('Lightning badge: fast + accurate on enough questions at an eligible level, not easy, not revived', () => {
  const R = BADGE_RULES.speed20;
  const good = { answered: R.minAnswered + 2, popped: R.minAnswered + 2, avgMs: R.maxAvgMs - 500, endReason: 'time' };
  assert.equal(evaluateBadges({ mode: 'time', dur: 120, diff: 'medium' }, good).speed20.met, true);
  assert.equal(evaluateBadges({ mode: 'time', dur: 120, diff: 'easy' }, good).speed20.met, false, 'easy does not qualify');
  assert.equal(evaluateBadges({ mode: 'time', dur: 120, diff: 'medium' }, good, { revived: true }).speed20.met, false);
  assert.equal(evaluateBadges({ mode: 'custom', level: 'hard', speed: 'slow' }, good).speed20.met, false, 'slow speed does not qualify');
  assert.equal(evaluateBadges({ mode: 'time', dur: 120, diff: 'medium' }, { ...good, avgMs: R.maxAvgMs + 1 }).speed20.met, false, 'too slow');
  assert.equal(evaluateBadges({ mode: 'time', dur: 120, diff: 'medium' }, { ...good, popped: Math.floor(good.answered * 0.8) }).speed20.met, false, 'inaccurate');
  assert.equal(evaluateBadges({ mode: 'time', dur: 120, diff: 'medium' }, { ...good, answered: R.minAnswered - 1, popped: R.minAnswered - 1 }).speed20.met, false, 'too few');
  // جولة حقيقية بالمحرّك: لاعب سريع ودقيق في ١٢٠ ثانية متوسط ← يستحق
  const d = D();
  const a = { mode: 'time', dur: 120, diff: 'medium' };
  const sum = play(challengeConfig(a), 11, { think: 20 });
  const r = finishRainRun('custom', a, { id: 'L1', seed: 11 }, sum, d, '2026-03-01');
  assert.ok(sum.answered >= R.minAnswered && sum.avgMs <= R.maxAvgMs, JSON.stringify({ a: sum.answered, ms: sum.avgMs }));
  assert.ok(r.rewards.badges.includes('speed20'));
  // نفس الأداء بسهل ← لا شارة
  const d2 = D(); const e = { mode: 'time', dur: 120, diff: 'easy' };
  const r2 = finishRainRun('custom', e, { id: 'L2', seed: 11 }, play(challengeConfig(e), 11, { think: 20 }), d2, '2026-03-01');
  assert.ok(!r2.rewards.badges.includes('speed20'));
});

test('Survivor badge: survival rules, enough correct, medium+, no second chance', () => {
  const S = BADGE_RULES.survive25;
  const a = { mode: 'survival', diff: 'medium' };
  const sum = play(challengeConfig(a), 21, { think: 20, stopAfter: S.minCorrect + 1 });
  assert.equal(sum.endReason, 'lives'); assert.ok(sum.popped >= S.minCorrect);
  const d = D();
  assert.ok(finishRainRun('custom', a, { id: 'S1', seed: 21 }, sum, d, '2026-03-01').rewards.badges.includes('survive25'));
  assert.ok(d.badgeProgress.survive25.correct >= S.minCorrect);
  const d2 = D();
  assert.ok(!finishRainRun('custom', a, { id: 'S2', seed: 21, revived: true }, sum, d2, '2026-03-01').rewards.badges.includes('survive25'), 'revived voids it');
  const d3 = D(); const e = { mode: 'survival', diff: 'easy' };
  assert.ok(!finishRainRun('custom', e, { id: 'S3', seed: 21 }, sum, d3, '2026-03-01').rewards.badges.includes('survive25'), 'easy does not qualify');
  // تخصيص بوقت (ليس قواعد بقاء) لا يمنحها
  assert.equal(evaluateBadges({ mode: 'custom', level: 'medium', speed: 'fast', dur: 60, lives: 3 }, { ...sum }).survive25.met, false);
  // تخصيص بقواعد البقاء (بلا وقت، ٣ محاولات) مؤهل
  assert.equal(evaluateBadges({ mode: 'custom', level: 'medium', speed: 'fast', dur: 0, lives: 3 }, { ...sum }).survive25.met, true);
  assert.equal(evaluateBadges({ mode: 'custom', level: 'medium', speed: 'fast', dur: 0, lives: 5 }, { ...sum }).survive25.met, false, 'more than 3 tries');
  // لا تُمنح الشارتان بمجرد إنهاء أي تحدٍّ مخصّص
  const d4 = D();
  const c = { mode: 'custom', ops: ['add'], level: 'easy', speed: 'slow', dur: 60, lives: 0, accel: false };
  const rr = finishRainRun('custom', c, { id: 'C1', seed: 2 }, play(challengeConfig(c), 2), d4, '2026-03-01');
  assert.ok(!rr.rewards.badges.includes('speed20') && !rr.rewards.badges.includes('survive25'));
  assert.equal(COMPLETE_MIN_CORRECT, 5);
});

test('time-out and last-moment answer: an answer on the final tick counts, nothing after the limit', () => {
  const cfg = challengeConfig({ mode: 'time', dur: 30, diff: 'easy' });
  const R = createRain(cfg, 8);
  while (R.state.tick < R.limitTicks - 1) R.step();
  const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
  const before = R.state.popped;
  if (d) { for (const ch of String(d.q.answer)) R.input(ch); }
  R.step(); // آخر نبضة: الإدخال يُطبَّق ثم تنتهي الجولة
  assert.equal(R.state.over, true); assert.equal(R.state.endReason, 'time');
  if (d) assert.equal(R.state.popped, before + 1, 'last-tick answer counted');
  R.input('1'); R.step();
  assert.equal(R.state.popped, before + (d ? 1 : 0), 'input after the end is ignored');
});
