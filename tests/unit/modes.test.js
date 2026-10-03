import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelInfo, journeySpec, evaluateJourney, dailyQuestions, dailySpec, friendTemplates, friendSpec, friendWinner, timeSpec, survivalSpec, survivalPerQuestionMs, practiceSpec, lessonSpec, evaluateLesson, TOTAL_LEVELS } from '../../public/src/core/modes.js';
import { createSession } from '../../public/src/core/session.js';
import { PATHS } from '../../public/src/core/curriculum.js';

function play(spec, { correctEvery = 1, step = 1000 } = {}) {
  const s = createSession(spec);
  let t = 0; s.start(t);
  for (let i = 0; i < 500 && s.phase !== 'ended'; i++) {
    t += step;
    const q = s.question;
    const right = (i % correctEvery) === 0;
    const val = right ? q.answer : (q.format === 'compare' ? (q.answer === 'left' ? 'right' : 'left') : q.answer + 1);
    const r = s.answer(val, t);
    if (!r.accepted && s.phase === 'ended') break;
    t += 10;
    s.next(t);
  }
  return s.summary(t);
}

test('every journey level is well-formed and tiers never jump more than 1 between adjacent levels', () => {
  let prev = null;
  for (let L = 1; L <= TOTAL_LEVELS; L++) {
    const info = levelInfo(L);
    assert.ok(['classic', 'sprint', 'boss'].includes(info.kind));
    if (info.kind === 'sprint') assert.ok(info.timeLimitMs >= 20000 && info.goal > 0);
    if (info.kind === 'boss') assert.equal(info.lives, 3);
    if (prev) for (const op of Object.keys(info.tiers)) if (prev.tiers[op] != null) {
      assert.ok(info.tiers[op] - prev.tiers[op] <= 2, `L${L} ${op} jump`);
    }
    prev = info;
  }
});

test('journey: perfect classic run → 3 stars; poor run fails', () => {
  const info = levelInfo(1);
  const good = play(journeySpec(1, { seed: 1 }));
  assert.deepEqual(evaluateJourney(info, good).stars, 3);
  const bad = play(journeySpec(1, { seed: 2 }), { correctEvery: 2 });
  assert.equal(evaluateJourney(info, bad).passed, false);
});

test('journey sprint and boss evaluation', () => {
  const s = levelInfo(4);
  const sum = play(journeySpec(4, { seed: 3 }), { step: 500 });
  const ev = evaluateJourney(s, sum);
  assert.equal(ev.passed, true); assert.equal(ev.stars, 3);
  const slow = play(journeySpec(4, { seed: 3 }), { step: 60000 });
  assert.equal(evaluateJourney(s, slow).passed, false);
  const b = levelInfo(10);
  const bsum = play(journeySpec(10, { seed: 4 }), { correctEvery: 1 });
  assert.equal(evaluateJourney(b, bsum).stars, 3);
  const bfail = play(journeySpec(10, { seed: 4 }), { correctEvery: 3 });
  assert.equal(evaluateJourney(b, bfail).passed, false);
});

test('daily questions are identical for the same date and differ across dates', () => {
  const a = dailyQuestions('2026-10-03'), b = dailyQuestions('2026-10-03'), c = dailyQuestions('2026-10-04');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((q) => q.sig), c.map((q) => q.sig));
  assert.equal(a.length, 15);
  const sum = play(dailySpec('2026-10-03'));
  assert.equal(sum.answered, 15);
});

test('friend mode: both players get equivalent (same op/tier/format) but different questions', () => {
  const tpl = friendTemplates({ count: 10, diff: 'medium', seed: 99 });
  const A = createSession(friendSpec(tpl, 0, 99)), B = createSession(friendSpec(tpl, 1, 99));
  A.start(0); B.start(0);
  let diff = 0;
  for (let i = 0; i < 10; i++) {
    const qa = A.question, qb = B.question;
    assert.equal(qa.topic, qb.topic); assert.equal(qa.tier, qb.tier); assert.equal(qa.format, qb.format);
    if (qa.sig !== qb.sig) diff++;
    A.answer(qa.answer, i * 1000 + 500); A.next(i * 1000 + 600);
    B.answer(qb.answer, i * 1000 + 500); B.next(i * 1000 + 600);
  }
  assert.ok(diff >= 7);
  assert.equal(friendWinner({ score: 10, correct: 1, activeMs: 5 }, { score: 9, correct: 9, activeMs: 1 }), 0);
  assert.equal(friendWinner({ score: 10, correct: 1, activeMs: 5 }, { score: 10, correct: 1, activeMs: 3 }), 1);
  assert.equal(friendWinner({ score: 10, correct: 1, activeMs: 5 }, { score: 10, correct: 1, activeMs: 5 }), -1);
});

test('time attack ends at limit; survival ends on lives', () => {
  const t = play(timeSpec(30, 'medium', { seed: 5 }), { step: 2000 });
  assert.equal(t.endReason, 'time');
  assert.ok(t.correct >= 10 && t.correct <= 16);
  const s = play(survivalSpec('easy', { seed: 6 }), { correctEvery: 4 });
  assert.equal(s.endReason, 'lives');
  assert.equal(survivalPerQuestionMs('medium', 0), 12000);
  assert.equal(survivalPerQuestionMs('medium', 1000), 5000);
});

test('practice respects chosen topics and fixed level', () => {
  const s = createSession(practiceSpec({ topics: ['mul'], level: 4, format: 'choice', length: 10 }, {}, { seed: 7 }));
  s.start(0);
  for (let i = 0; i < 10; i++) { assert.equal(s.question.topic, 'mul'); assert.equal(s.question.tier, 4); assert.equal(s.question.format, 'choice'); s.answer(s.question.answer, i * 10 + 5); s.next(i * 10 + 6); }
  assert.equal(s.phase, 'ended');
});

test('every curriculum lesson generates valid questions and evaluates stars', () => {
  for (const p of PATHS) p.lessons.forEach((_, i) => {
    const spec = lessonSpec(p.id, i, { seed: i + 1 });
    const sum = play(spec);
    assert.equal(evaluateLesson(spec, sum).stars, 3, `${p.id}|${i}`);
  });
});
