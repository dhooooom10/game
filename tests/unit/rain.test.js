import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRain, RAIN_DIFFS } from '../../public/src/core/rain.js';

test('rain: drops spawn, never share an answer, fall and cost lives', () => {
  const R = createRain('medium', 5);
  for (let i = 0; i < 400 && !R.state.over; i++) {
    R.update(0.05);
    const live = R.state.drops.filter((d) => !d.dead).map((d) => d.q.answer);
    assert.equal(new Set(live).size, live.length);
  }
  assert.equal(R.state.over, true);
  assert.equal(R.state.won, false);
  assert.equal(R.state.lives, 0);
});

test('rain: typing the answer pops; ambiguous prefixes wait for ✓; wrong resets streak', () => {
  const R = createRain('easy', 9);
  while (!R.state.drops.length) R.update(0.1);
  const d = R.state.drops[0];
  let ev;
  for (const ch of String(d.q.answer)) ev = R.type(ch);
  assert.equal(ev.type, 'pop');
  assert.equal(R.state.popped, 1);
  assert.ok(ev.points >= 100);
  R.state.typed = '';
  const w = R.type('9'); R.type('9'); const ev2 = R.submit(true);
  assert.equal((w && w.type) || ev2.type, 'wrong');
  assert.equal(R.state.streak, 0);
});

test('rain: winning after target pops', () => {
  const R = createRain('easy', 3);
  for (let i = 0; i < 5000 && !R.state.over; i++) {
    R.update(0.05);
    const d = R.state.drops.find((x) => !x.dead);
    if (d) { R.state.typed = String(d.q.answer); R.submit(true); }
  }
  assert.equal(R.state.won, true);
  assert.equal(R.state.popped, RAIN_DIFFS.easy.target);
});
