import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../../public/src/core/session.js';
import { createRng } from '../../public/src/core/rng.js';
import { generateQuestion } from '../../public/src/core/questions.js';
import { answerPoints, streakMultiplier, speedBonus, accuracyBonus } from '../../public/src/core/scoring.js';

const fixedSource = () => {
  const rng = createRng(1);
  return (i, ctx) => generateQuestion({ rng, topic: 'add', tier: 2, format: 'input' });
};
const spec = (o = {}) => ({ id: 'r1', mode: 'test', source: fixedSource(), ...o });

test('double answer on the same question is ignored', () => {
  const s = createSession(spec({ totalQuestions: 3 }));
  s.start(0);
  const a = s.question.answer;
  const r1 = s.answer(a, 1000);
  const r2 = s.answer(a, 1001);
  assert.equal(r1.accepted, true);
  assert.equal(r2.accepted, false);
  assert.equal(s.state.correct, 1);
  assert.equal(s.state.answers.length, 1);
});

test('answer at the exact last moment is accepted; after it is rejected', () => {
  const s = createSession(spec({ timeLimitMs: 60000 }));
  s.start(0);
  const r = s.answer(s.question.answer, 60000);
  assert.equal(r.accepted, true);
  assert.equal(r.endsRound, true);
  assert.equal(s.next(60000), 'ended');
  assert.equal(s.state.endReason, 'time');

  const s2 = createSession(spec({ timeLimitMs: 60000 }));
  s2.start(0);
  const r2 = s2.answer(s2.question.answer, 60001);
  assert.equal(r2.accepted, false);
  assert.equal(s2.phase, 'ended');
  assert.equal(s2.state.correct, 0);
});

test('tick ends round on time up and the open question is not counted as wrong', () => {
  const s = createSession(spec({ timeLimitMs: 5000 }));
  s.start(0);
  assert.equal(s.tick(4000), null);
  assert.deepEqual(s.tick(5001), { type: 'ended', reason: 'time' });
  const sum = s.summary();
  assert.equal(sum.wrong, 0); assert.equal(sum.answered, 0);
});

test('pause excludes time and swaps the question on resume', () => {
  const s = createSession(spec({ timeLimitMs: 10000 }));
  s.start(0);
  const q1 = s.question;
  s.pause(3000);
  assert.equal(s.answer(q1.answer, 3500).accepted, false, 'cannot answer while paused');
  assert.equal(s.remainingMs(999999), 7000, 'paused time does not count');
  assert.equal(s.resume(50000), 'swapped');
  assert.notDeepEqual(s.question, q1);
  assert.equal(s.remainingMs(52000), 5000);
});

test('skip policy (daily): leaving marks the shown question as skipped', () => {
  const s = createSession(spec({ totalQuestions: 3, resumePolicy: 'skip' }));
  s.start(0);
  s.pause(100);
  assert.equal(s.resume(200), 'skipped');
  assert.equal(s.state.skipped, 1);
  assert.equal(s.phase, 'feedback');
  s.next(300);
  assert.equal(s.index, 1);
  const sum = s.summary();
  assert.equal(sum.answered, 0, 'skipped not counted as answered');
});

test('per-question timeout costs a life and ends the round at zero lives', () => {
  const s = createSession(spec({ lives: 2, perQuestionMs: 1000 }));
  s.start(0);
  let ev = s.tick(1001);
  assert.equal(ev.type, 'timeout');
  assert.equal(s.state.lives, 1);
  s.next(1100);
  ev = s.tick(2200);
  assert.equal(ev.type, 'timeout');
  assert.equal(ev.result.endsRound, true);
  assert.equal(s.next(2300), 'ended');
  assert.equal(s.state.endReason, 'lives');
});

test('answer after per-question deadline is converted to timeout', () => {
  const s = createSession(spec({ lives: 3, perQuestionMs: 1000 }));
  s.start(0);
  const r = s.answer(s.question.answer, 1500);
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'question-timeout');
  assert.equal(s.state.timeouts, 1);
});

test('goal ends sprint; totalQuestions ends classic', () => {
  const s = createSession(spec({ goalCorrect: 2, timeLimitMs: 100000 }));
  s.start(0);
  s.answer(s.question.answer, 100); s.next(200);
  const r = s.answer(s.question.answer, 300);
  assert.equal(r.endsRound, true);
  s.next(400);
  assert.equal(s.state.endReason, 'goal');
  const c = createSession(spec({ totalQuestions: 2 }));
  c.start(0); c.answer(-999, 10); c.next(20); c.answer(c.question.answer, 30);
  assert.equal(c.next(40), 'ended');
  const sum = c.summary();
  assert.equal(sum.correct, 1); assert.equal(sum.wrong, 1); assert.equal(sum.accuracy, 0.5);
});

test('snapshot/restore resumes paused with same progress', () => {
  const sp = spec({ totalQuestions: 5 });
  const s = createSession(sp);
  s.start(0); s.answer(s.question.answer, 1000); s.next(1100);
  const snap = s.snapshot(2000);
  const r = createSession({ ...sp, source: fixedSource() }, JSON.parse(JSON.stringify(snap)));
  assert.equal(r.phase, 'paused');
  assert.equal(r.state.correct, 1);
  assert.equal(r.resume(5000), 'swapped');
  assert.equal(r.index, 1);
  r.answer(r.question.answer, 6000);
  assert.equal(r.state.correct, 2);
});

test('scoring rules', () => {
  assert.equal(streakMultiplier(1), 1);
  assert.equal(streakMultiplier(3), 1.2);
  assert.equal(streakMultiplier(50), 1.5);
  assert.equal(speedBonus(1000, 2000), 50);
  assert.equal(speedBonus(4000, 2000), 0);
  assert.equal(speedBonus(3000, 2000), 25);
  assert.deepEqual(answerPoints({ correct: false, tier: 5, streak: 3 }).total, 0);
  assert.equal(answerPoints({ correct: true, tier: 1, streak: 1 }).total, 100);
  assert.equal(answerPoints({ correct: true, tier: 3, streak: 6 }).total, 180);
  assert.equal(answerPoints({ correct: true, tier: 1, streak: 1, ms: 500, parMs: 2000, useSpeed: true }).total, 150);
  assert.equal(answerPoints({ correct: true, tier: 1, streak: 1, ms: 500, parMs: 2000, useSpeed: false }).total, 100);
  assert.equal(accuracyBonus(10, 10), 200);
  assert.equal(accuracyBonus(7, 10), 0);
  assert.equal(accuracyBonus(4, 4), 0, 'too few answers');
});

test('session score equals sum of answer points', () => {
  const s = createSession(spec({ totalQuestions: 6, useSpeed: true }));
  s.start(0);
  let t = 0;
  for (let i = 0; i < 6; i++) { t += 1500; s.answer(i === 2 ? -1 : s.question.answer, t); s.next(t); }
  const sum = s.summary();
  assert.equal(sum.score, sum.answers.reduce((a, x) => a + x.points, 0));
  assert.equal(sum.bestStreak, 3);
});
