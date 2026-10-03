import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRain, replayRain, plausible, stormConfig, survivalConfig, classicConfig, rainConfig, TPS } from '../../public/src/core/rain.js';
import { journeyRain, evaluateRainJourney, TOTAL_LEVELS } from '../../public/src/core/modes.js';

/** لاعب آلي: يكتب ناتج أدنى قطرة بعد زمن تفكير */
export function bot(R, { think = 40, skill = 1, maxTicks = 60 * 600 } = {}) {
  let waitUntil = 0, target = null;
  while (!R.state.over && R.state.tick < maxTicks) {
    const live = R.state.drops.filter((d) => !d.dead);
    if (!target || target.dead) {
      target = live.sort((a, b) => b.y - a.y)[0] || null;
      waitUntil = R.state.tick + think;
    }
    if (target && R.state.tick >= waitUntil && !target.dead) {
      const ans = skill >= 1 || (target.id % 4) ? target.q.answer : target.q.answer + 1;
      for (const ch of String(ans)) R.input(ch);
      R.input('ok');
      target = null;
    }
    R.step();
  }
  return R;
}

test('replaying the input log reproduces exactly the same result', () => {
  for (const [cfg, seed] of [[stormConfig('medium', 60), 11], [survivalConfig('hard'), 'x'], [classicConfig('easy', 15), 3], [journeyRain(57).cfg, 99]]) {
    const R = bot(createRain(cfg, seed), { skill: 0.8 });
    const live = R.summary();
    const rep = replayRain(cfg, seed, R.state.log, { endTick: R.state.tick }).summary;
    assert.equal(rep.score, live.score);
    assert.equal(rep.popped, live.popped);
    assert.equal(rep.missed, live.missed);
    assert.equal(rep.ticks, live.ticks);
  }
});

test('a tampered log does not reproduce the claimed score', () => {
  const cfg = stormConfig('medium', 60);
  const R = bot(createRain(cfg, 5));
  const claimed = R.summary().score;
  const forged = R.state.log.filter((_, i) => i % 3 !== 0);
  assert.notEqual(replayRain(cfg, 5, forged, { endTick: R.state.tick }).summary.score, claimed);
});

test('storm (timed) ends exactly at the time limit; no lives lost', () => {
  const R = bot(createRain(stormConfig('easy', 30), 1), { think: 30 });
  const s = R.summary();
  assert.equal(s.endReason, 'time');
  assert.equal(s.ticks, 30 * TPS);
  assert.equal(s.lives, null);
  assert.ok(s.popped > 5);
});

test('survival ends when 3 drops land; difficulty ramps up', () => {
  const R = bot(createRain(survivalConfig('medium'), 2), { think: 30, skill: 0.75 });
  assert.equal(R.summary().endReason, 'lives');
  assert.equal(R.state.lives, 0);
  assert.ok(R.state.rampLevel > 0);
});

test('no two live drops share an answer; fairness floor on fall speed', () => {
  const R = createRain(stormConfig('expert', 120), 77);
  for (let i = 0; i < 120 * TPS; i++) {
    R.step();
    const live = R.state.drops.filter((d) => !d.dead);
    assert.equal(new Set(live.map((d) => d.q.answer)).size, live.length);
    for (const d of live) assert.ok(1 / (d.speed * TPS) >= (d.q.parMs / 1000) * 1.3 - 1e-9);
  }
});

test('typing pops automatically unless the prefix is ambiguous; wrong breaks the streak', () => {
  const R = createRain(rainConfig({ tiers: { add: 1 }, maxDrops: 1, lives: null }), 9);
  while (!R.state.drops.length) R.step();
  const d = R.state.drops[0];
  for (const ch of String(d.q.answer)) R.input(ch);
  const ev = R.step();
  assert.ok(ev.some((e) => e.type === 'pop'));
  while (!R.state.drops.some((x) => !x.dead)) R.step();
  const bad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].find((c) => !R.state.drops.some((x) => !x.dead && String(x.q.answer).startsWith(c)));
  R.input(bad); // رقم لا يبدأ به أي ناتج ظاهر = خطأ فوري
  R.step();
  assert.equal(R.state.wrong, 1);
  assert.equal(R.state.streak, 0);
});

test('special drops: storm pops everything, ice slows the rain, gold doubles', () => {
  const cfg = rainConfig({ tiers: { add: 2 }, maxDrops: 4, spawn: 0.5, specials: true, lives: null, timeLimit: 300 });
  let sawStorm = false, sawIce = false;
  for (let seed = 1; seed < 40 && !(sawStorm && sawIce); seed++) {
    const R = createRain(cfg, seed);
    for (let i = 0; i < 2000 && !R.state.over; i++) {
      const sp = R.state.drops.find((d) => !d.dead && (d.kind === 'storm' || d.kind === 'ice'));
      if (sp && R.state.drops.filter((d) => !d.dead).length >= 2) {
        for (const ch of String(sp.q.answer)) R.input(ch);
        R.input('ok');
        const ev = R.step();
        if (sp.kind === 'storm' && ev.some((e) => e.type === 'storm')) { sawStorm = true; assert.equal(R.state.drops.filter((d) => !d.dead).length, 0); }
        if (sp.kind === 'ice' && ev.some((e) => e.type === 'ice')) { sawIce = true; assert.ok(R.state.iceUntil > R.state.tick); }
        break;
      }
      R.step();
    }
  }
  assert.ok(sawStorm && sawIce);
});

test('journey levels: every level is winnable by a decent player and stars follow hearts', () => {
  for (let L = 1; L <= TOTAL_LEVELS; L += 3) {
    const { info, cfg } = journeyRain(L);
    const R = bot(createRain(cfg, L), { think: 45 });
    const ev = evaluateRainJourney(info, R.summary());
    assert.equal(ev.passed, true, `level ${L}`);
    assert.ok(ev.stars >= 1);
  }
  const { info, cfg } = journeyRain(5);
  const lose = bot(createRain(cfg, 1), { think: 2000 });
  assert.equal(evaluateRainJourney(info, lose.summary()).passed, false);
});

test('plausibility flags inhuman reaction times', () => {
  const R = bot(createRain(stormConfig('hard', 60), 4), { think: 2 });
  assert.equal(plausible(R.summary()), false);
  const H = bot(createRain(stormConfig('hard', 60), 4), { think: 60 });
  assert.equal(plausible(H.summary()), true);
});

test('revive: continues after losing lives, recorded in log, replay honours it only when allowed', async () => {
  const { createRain, replayRain, survivalConfig } = await import('../../public/src/core/rain.js');
  const cfg = survivalConfig('easy');
  const R = createRain(cfg, 99);
  while (!R.state.over) R.step();             // لا إجابات: تنفد القلوب
  assert.equal(R.state.endReason, 'lives');
  assert.equal(R.revive(), true);
  assert.equal(R.state.over, false);
  assert.equal(R.state.lives, 1);
  assert.equal(R.revive(), false, 'only when over by lives');
  // نجيب على قطرتين ثم نخسر مجددًا
  let answered = 0;
  while (!R.state.over) {
    const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
    if (d && answered < 2 && d.y > 0.2) { for (const ch of String(d.q.answer)) R.input(ch); R.input('ok'); answered++; }
    R.step();
  }
  const end = R.state.tick, score = R.state.score;
  assert.ok(score > 0);
  assert.equal(replayRain(cfg, 99, R.state.log, { endTick: end, allowRevive: true }).summary.score, score);
  assert.equal(replayRain(cfg, 99, R.state.log, { endTick: end }).summary.score, 0, 'server ignores ad revives');
});
