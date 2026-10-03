import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProfileData, commitRound, levelFromXp, xpForLevel, recordAnswer, ensureMissions, recordDaily, currentDailyStreak, metrics, recommendation, isUnlocked, COSMETICS } from '../../public/src/core/progression.js';

const D = '2026-10-03';
const round = (o = {}) => ({ id: 'r' + Math.random(), mode: 'time', score: 1000, correct: 12, answered: 14, bestStreak: 5, perOp: {}, ...o });

test('commitRound applies rewards exactly once per round id', () => {
  const d = newProfileData();
  const r = round({ id: 'same' });
  const a = commitRound(d, r, D);
  const xp1 = d.xp, rounds1 = d.stats.rounds;
  const b = commitRound(d, r, D);
  assert.equal(a.applied, true); assert.equal(b.applied, false);
  assert.equal(d.xp, xp1); assert.equal(d.stats.rounds, rounds1);
  assert.equal(d.history.length, 1);
});

test('records only update when beaten', () => {
  const d = newProfileData();
  let res = commitRound(d, round({ recordKey: 'time:60:medium', recordValue: 10, score: 900 }), D);
  assert.equal(res.records.length, 1);
  res = commitRound(d, round({ recordKey: 'time:60:medium', recordValue: 8, score: 800 }), D);
  assert.equal(res.records.length, 0);
  assert.equal(d.records['time:60:medium'].value, 10);
  res = commitRound(d, round({ recordKey: 'time:60:medium', recordValue: 12, score: 1200 }), D);
  assert.equal(res.records[0].prev, 10);
});

test('xp level curve', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(xpForLevel(1) - 1).level, 1);
  assert.equal(levelFromXp(xpForLevel(1)).level, 2);
  assert.equal(levelFromXp(xpForLevel(1) + xpForLevel(2)).level, 3);
});

test('missions progress and are claimed once', () => {
  const d = newProfileData();
  ensureMissions(d, D, 'x');
  assert.equal(d.missions.list.length, 3);
  assert.equal(d.missions.list[0].id, 'daily1');
  const r1 = commitRound(d, round({ mode: 'daily', official: true }), D);
  assert.ok(r1.missions.some((m) => m.id === 'daily1'));
  const r2 = commitRound(d, round({ mode: 'daily', official: true }), D);
  assert.ok(!r2.missions.some((m) => m.id === 'daily1'), 'not claimed twice');
  assert.equal(ensureMissions(d, D, 'x'), false, 'same day keeps missions');
  assert.equal(ensureMissions(d, '2026-10-04', 'x'), true);
});

test('badges are awarded once', () => {
  const d = newProfileData();
  const r = commitRound(d, round({ answered: 10, correct: 10 }), D);
  assert.ok(r.badges.includes('first'));
  assert.ok(r.badges.includes('perfect'));
  const r2 = commitRound(d, round({ answered: 10, correct: 10 }), D);
  assert.ok(!r2.badges.includes('perfect'));
});

test('daily official result recorded once; streak counts consecutive days', () => {
  const d = newProfileData();
  assert.equal(recordDaily(d, '2026-10-01', { score: 500 }), true);
  assert.equal(recordDaily(d, '2026-10-01', { score: 900 }), false);
  assert.equal(d.daily.results['2026-10-01'].score, 500);
  recordDaily(d, '2026-10-02', { score: 100 });
  assert.equal(d.daily.streak, 2);
  assert.equal(currentDailyStreak(d, '2026-10-03'), 2, 'still alive next day');
  assert.equal(currentDailyStreak(d, '2026-10-05'), 0, 'broken after a gap');
  recordDaily(d, '2026-10-05', { score: 100 });
  assert.equal(d.daily.streak, 1);
});

test('recordAnswer updates stats; metrics computed; skipped ignored', () => {
  const d = newProfileData();
  recordAnswer(d, { op: 'add', topic: 'add', tier: 2, format: 'input', correct: true, ms: 2000 }, D);
  recordAnswer(d, { op: 'add', topic: 'add', tier: 2, format: 'input', correct: false, ms: 4000 }, D);
  recordAnswer(d, { op: 'mul', topic: 'mul', tier: 2, format: 'choice', correct: true, ms: null, timeout: false }, D);
  recordAnswer(d, { op: 'mul', topic: 'mul', tier: 2, format: 'choice', skipped: true, correct: false, ms: null }, D);
  const m = metrics(d, D);
  assert.equal(m.questions, 3);
  assert.equal(m.correct, 2);
  assert.equal(m.avgMs, 3000);
  assert.equal(m.perOp.add.acc, 0.5);
  assert.equal(m.days.at(-1).q, 3);
  assert.equal(m.days.length, 14);
});

test('empty metrics and recommendation need data', () => {
  const d = newProfileData();
  assert.equal(metrics(d, D).empty, true);
  assert.equal(recommendation(d).key, 'rec.needData');
  for (let i = 0; i < 20; i++) recordAnswer(d, { op: 'div', topic: 'div', tier: 2, format: 'input', correct: i % 2 === 0, ms: 3000 }, D);
  for (let i = 0; i < 20; i++) recordAnswer(d, { op: 'add', topic: 'add', tier: 2, format: 'input', correct: true, ms: 2000 }, D);
  const r = recommendation(d);
  assert.equal(r.key, 'rec.accuracy'); assert.equal(r.op, 'div');
});

test('cosmetics unlock by level/badge', () => {
  const d = newProfileData();
  const crown = COSMETICS.acc.find((x) => x.id === 'crown');
  const cap = COSMETICS.acc.find((x) => x.id === 'cap');
  assert.equal(isUnlocked(d, cap), false);
  d.xp = 1000;
  assert.equal(isUnlocked(d, cap), true);
  assert.equal(isUnlocked(d, crown), false);
  d.badges.world1 = D;
  assert.equal(isUnlocked(d, crown), true);
});
