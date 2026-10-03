import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordSkill, newSkill, tierFromSkill, MIN_SAMPLE } from '../../public/src/core/adaptive.js';
import { parTime } from '../../public/src/core/questions.js';

const fast = (tier) => parTime('add', tier, 'input') * 0.6;
function feed(skill, results, tier = 2) {
  let s = skill, changes = [];
  for (const c of results) { const r = recordSkill(s, { correct: c, ms: fast(tier), topic: 'add', tier, format: 'input' }); s = r.skill; changes.push(r.change); }
  return { s, changes };
}

test('no change before minimum sample', () => {
  const { changes } = feed(newSkill(2), Array(MIN_SAMPLE - 1).fill(true));
  assert.ok(changes.every((c) => c === 0));
});
test('consistent fast accuracy raises the level gradually (≤0.5 per step)', () => {
  const { s, changes } = feed(newSkill(2), Array(30).fill(true));
  assert.ok(s.r > 2 && s.r <= 4.5, `r=${s.r}`);
  assert.ok(changes.every((c) => c <= 0.5));
});
test('a single mistake does not lower the level', () => {
  const { s } = feed(newSkill(5), [true, true, true, true, true, false, true]);
  assert.ok(s.r >= 5);
});
test('poor accuracy over a full sample lowers the level, never below 1', () => {
  const { s } = feed(newSkill(3), Array(40).fill(false));
  assert.equal(s.r, 1);
  const { s: s2 } = feed(newSkill(5), [false, false, false, false, true, false]);
  assert.ok(s2.r < 5);
});
test('tierFromSkill clamps', () => {
  assert.equal(tierFromSkill({ r: 3.75 }), 3);
  assert.equal(tierFromSkill(undefined), 1);
  assert.equal(tierFromSkill({ r: 12 }), 10);
});
