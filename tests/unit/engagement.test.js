import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRain, replayRain, rainConfig, stormConfig, survivalConfig, turbo, turboDuelConfig, speedTier, FEVER_AT, GIFT_BONUS, TURBO_ACCEL, TURBO_TIER_MAX } from '../../public/src/core/rain.js';
import { journeyRain } from '../../public/src/core/modes.js';
import { newProfileData, recordDaily, currentDailyStreak, shieldsNeeded, commitRound } from '../../public/src/core/progression.js';
import { nearMiss, openGifts, MAX_SHIELDS } from '../../public/src/runs.js';

function bot(R, { think = 40 } = {}) {
  let waitUntil = 0, target = null;
  while (!R.state.over && R.state.tick < 60 * 600) {
    const live = R.state.drops.filter((d) => !d.dead);
    if (!target || target.dead) { target = live.sort((a, b) => b.y - a.y)[0] || null; waitUntil = R.state.tick + think; }
    if (target && R.state.tick >= waitUntil && !target.dead) { for (const ch of String(target.q.answer)) R.input(ch); R.input('ok'); target = null; }
    R.step();
  }
  return R;
}

test('fever: from the 10th correct in a row points double until the streak breaks', () => {
  const cfg = rainConfig({ tiers: { add: 1 }, travel: 12, spawn: 1, maxDrops: 3, lives: null, timeLimit: 60, specials: false });
  const R = createRain(cfg, 5);
  const ev = []; const pts = [];
  let waitUntil = 0;
  while (!R.state.over) {
    const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
    if (d && R.state.tick >= waitUntil) {
      // خطأ متعمد بعد ١٤ إصابة لكسر السلسلة
      if (R.state.popped === 14 && R.state.wrong === 0) { R.input('9'); R.input('9'); R.input('ok'); }
      else { for (const c of String(d.q.answer)) R.input(c); R.input('ok'); }
      waitUntil = R.state.tick + 30;
    }
    for (const e of R.step()) { ev.push(e.type); if (e.type === 'pop') pts.push([R.state.streak, e.points, e.fever]); }
  }
  assert.equal(ev.filter((x) => x === 'fever').length >= 1, true);
  assert.ok(ev.includes('feverEnd'), 'a wrong answer ends the fever');
  const at = pts.find(([s]) => s === FEVER_AT + 1);
  assert.ok(at && at[2] === true, 'pops after the 10th are fever pops');
  assert.ok(pts.filter(([s]) => s <= FEVER_AT).every(([, , f]) => !f));
  assert.ok(R.summary().fevers >= 1);
  assert.equal(replayRain(cfg, 5, R.state.log, { endTick: R.state.tick }).summary.score, R.summary().score, 'fever scoring replays exactly');
});

test('mystery gift drops: deterministic bonus from the seed, counted in summary', () => {
  let found = null;
  for (let seed = 1; seed < 40 && !found; seed++) {
    const R = bot(createRain(stormConfig('easy', 90, true), seed), { think: 30 });
    if (R.summary().gifts > 0) found = { seed, R };
  }
  assert.ok(found, 'gift drops appear with specials');
  const s = found.R.summary();
  assert.ok(s.giftPts >= GIFT_BONUS[0] * s.gifts && s.giftPts <= GIFT_BONUS[GIFT_BONUS.length - 1] * s.gifts);
  const rep = replayRain(stormConfig('easy', 90, true), found.seed, found.R.state.log, { endTick: found.R.state.tick }).summary;
  assert.equal(rep.score, s.score); assert.equal(rep.giftPts, s.giftPts);
});

test('turbo: easy numbers (tiers capped), strong acceleration, faster than normal, speed tiers', () => {
  const base = survivalConfig('hard');
  const tb = turbo(base);
  assert.ok(Object.values(tb.tiers).every((v) => v <= TURBO_TIER_MAX)); assert.equal(TURBO_TIER_MAX, 2, 'turbo = single-digit numbers');
  assert.equal(tb.accel, TURBO_ACCEL); assert.equal(tb.turbo, true); assert.equal(tb.ramp.tierEvery, null);
  const R = createRain(turboDuelConfig(), 'T1');
  while (!R.state.over) R.step();
  assert.ok(R.summary().speedX >= 2, 'a 60 s turbo duel reaches at least double speed');
  assert.ok(R.summary().answers.length > 0);
  assert.equal(speedTier(1), 0); assert.equal(speedTier(1.5), 1); assert.equal(speedTier(2.2), 2); assert.equal(speedTier(3.1), 4);
});

test('journey: gradual acceleration grows with the worlds', () => {
  const a1 = journeyRain(1).cfg.accel, a50 = journeyRain(55).cfg.accel, a99 = journeyRain(99).cfg.accel;
  assert.ok(a1 > 0 && a1 < a50 && a50 <= a99 && a99 <= 0.08, `${a1} ${a50} ${a99}`);
});

test('near miss only when close to the record and not broken', () => {
  assert.equal(nearMiss(18, 20, false).left, 3);
  assert.equal(nearMiss(10, 20, false), null);
  assert.equal(nearMiss(21, 20, true), null);
  assert.equal(nearMiss(20, 20, false), null);
  assert.equal(nearMiss(5, null, false), null);
});

test('streak shields save a missed day and are consumed; gifts grant xp or shields (max 3)', () => {
  const d = newProfileData('ar');
  recordDaily(d, '2026-01-01', { score: 1 });
  recordDaily(d, '2026-01-02', { score: 1 });
  assert.equal(d.daily.streak, 2);
  assert.equal(currentDailyStreak(d, '2026-01-04'), 0, 'no shield: streak lost');
  d.shields = 1;
  assert.equal(shieldsNeeded(d, '2026-01-04'), 1);
  assert.equal(currentDailyStreak(d, '2026-01-04'), 2, 'shield keeps it alive');
  recordDaily(d, '2026-01-04', { score: 1 });
  assert.equal(d.daily.streak, 3); assert.equal(d.shields, 0);
  const g = newProfileData('en');
  const xp0 = g.xp;
  const out = openGifts(g, 10, 'run-x');
  assert.equal(out.length, 10);
  assert.ok(g.shields <= MAX_SHIELDS);
  assert.equal(g.xp - xp0, out.filter((o) => o.type === 'xp').reduce((a, o) => a + o.xp, 0));
  assert.deepEqual(openGifts(newProfileData('en'), 10, 'run-x'), out, 'deterministic per run');
});

test('new badges: fever, gift and speed (turbo badge retired with the turbo switch)', () => {
  const d = newProfileData('en');
  const rw = commitRound(d, { id: 'r1', mode: 'journey', passed: true, score: 100, correct: 22, answered: 22, bestStreak: 12, perOp: {}, speedX: 3.1, fevers: 1, gifts: 1, turbo: true });
  for (const b of ['fever', 'gift', 'speedx2', 'speedx3']) assert.ok(rw.badges.includes(b), b);
  assert.ok(!rw.badges.includes('turbo'));
});
