/* التيربو ⚡ والحمّى 🔥 وخط الشبح و«كدت تكسرها» وشارة السرعة ودروع السلسلة */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen } from './helpers.js';

let S, browser;
before(async () => { S = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

test('level 1 is lively from the start: fast drops with easy sums; difficulty then grows through the equations', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; });
  assert.equal(await p.locator('.turbo-row').count(), 0, 'no turbo switch any more');
  await p.click('#playNow');
  await waitScreen(p, 'rainPlay');
  const cfg = await p.evaluate(() => window.__mc.current.rain().cfg);
  assert.ok(cfg.travel <= 7.5, 'drops fall fast from level 1'); assert.ok(cfg.accel >= 0.05);
  assert.ok(Object.values(cfg.tiers).every((t) => t <= 2), 'with easy numbers');
  const later = await p.evaluate(async () => { const m = await import('/src/core/modes.js'); const a = m.journeyRain(1).cfg, b = m.journeyRain(60).cfg; return { a: Math.max(...Object.values(a.tiers)), b: Math.max(...Object.values(b.tiers)), ops: Object.keys(b.tiers).length, ta: a.travel, tb: b.travel }; });
  assert.ok(later.b > later.a && later.ops >= 3, 'harder equations later');
  assert.ok(later.ta - later.tb < 1.6, 'speed grows only a little');
  await p.waitForSelector('.speed-chip:not([hidden])');
  // نقفز في المحرك: الحمّى عبر ١٠ إصابات متتالية، ثم التسارع
  const ev = await p.evaluate(() => {
    const R = window.__mc.current.rain(); const types = new Set();
    for (let k = 0; k < 3000 && !R.state.over; k++) {
      const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
      if (d && k % 20 === 0) { for (const c of String(d.q.answer)) R.input(c); R.input('ok'); }
      for (const e of R.step()) types.add(e.type);
    }
    return [...types];
  });
  assert.ok(ev.includes('fever')); assert.ok(ev.includes('speedup'));
  assert.deepEqual(p.errors, []);
});

test('ghost line chases your record live; results show near miss and speed badge', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => {
    const d = window.__mc.data; d.settings.tutorialDone = true; d.prefs.turbo = { on: false };
    d.records['time:60:easy'] = { value: 3, score: 100, correct: 3, date: '2026-01-01' };
    window.__mc.go('rainPlay', { kind: 'custom', args: { mode: 'time', dur: 60, diff: 'easy' } });
  });
  await waitScreen(p, 'rainPlay');
  await p.waitForSelector('.chase');
  // ٤ إصابات تكسر الرقم ٣ أمام اللاعب
  for (let i = 0; i < 40; i++) {
    const n = await p.evaluate(() => {
      const R = window.__mc.current.rain(); const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
      if (d) { for (const ch of String(d.q.answer)) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }
      return R.state.popped;
    });
    if (n >= 4) break;
    await p.waitForTimeout(300);
  }
  await p.waitForSelector('.chase.broken', { timeout: 5000 });
  // شاشة النتائج: «كدت تكسرها» وشارة السرعة
  await p.evaluate(() => {
    const sum = { score: 300, popped: 18, correct: 18, answered: 19, accuracy: 0.95, skipped: 0, bestStreak: 12, avgMs: 1200, answers: [], speedX: 2.1, fevers: 1, gifts: 0 };
    window.__mc.go('results', { view: { engine: 'rain', kind: 'custom', args: { mode: 'time', dur: 60, diff: 'easy' }, sum, score: 300, title: 'x', notes: [], mood: 'happy',
      nearMiss: { left: 2, prev: 19 }, speed: { x: 2.1, tier: 2, prevBest: 1.4, newBest: true } } });
  });
  await waitScreen(p, 'results');
  await p.waitForSelector('#nearMiss');
  assert.match(await p.textContent('#nearMiss'), /كدت/);
  await p.waitForSelector('.speed-badge[data-tier="2"]');
  assert.deepEqual(p.errors, []);
});

test('streak shield shows in the daily dialog', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { const d = window.__mc.data; d.shields = 2; d.daily.last = '2026-01-01'; d.daily.streak = 4; window.__mc.go('challenges'); });
  await p.click('#dailyCard');
  await p.waitForSelector('.shield-box');
  assert.deepEqual(p.errors, []);
});

test('water level rises with every drop that lands; custom setup shows the number range (easy = single digits)', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.go('rainPlay', { kind: 'custom', args: { mode: 'survival', diff: 'easy' } }); });
  await waitScreen(p, 'rainPlay');
  await p.waitForFunction(() => window.__mc.current.rain().state.tick > 10, null, { timeout: 8000 });
  const h0 = await p.evaluate(() => document.querySelector('.sky .ground').getBoundingClientRect().height);
  // نترك قطرتين تسقطان (نقفز في المحرك حتى خسارة قلبين)
  await p.evaluate(() => { const R = window.__mc.current.rain(); while (R.state.lives > 1 && !R.state.over) R.step(); });
  await p.waitForFunction((h) => document.querySelector('.sky .ground').getBoundingClientRect().height > h + 60, h0, { timeout: 8000 });
  await p.evaluate(() => window.__mc.go('setupCustom'));
  await waitScreen(p, 'setupCustom');
  await p.click('#ch-custom');
  await p.click('.custom-fields >> text=سهل');
  assert.match(await p.textContent('#rangeHint'), /[1١].*[9٩]/);
  assert.deepEqual(p.errors, []);
});
