import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen, answer, playRound, phase, waitAsking, rainPlay, rainState } from './helpers.js';

let srv, browser, URL_;
before(async () => { srv = await startServer(); browser = await launch(); URL_ = srv.url + '?e2e=1'; });
after(async () => { await browser.close(); await srv.close(); });

const data = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__mc.data)));
const skipTut = (page) => page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });

test('first run: drop tutorial → level 1 → 3 stars (no drop landed) → progress persists after reload', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await waitScreen(page, 'home');
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
  await page.click('#playNow');
  await waitScreen(page, 'rainPlay');
  assert.ok(await page.locator('.rain-coach .bubble').isVisible(), 'coach explains the drops');
  await page.waitForFunction(() => window.__mc.current.rain().state.drops.length > 0);
  await rainPlay(page, { until: async () => (await page.evaluate(() => window.__mc.current.rain?.().cfg.target)) !== 4 });
  // انتقل تلقائيًا إلى المرحلة ١
  await page.waitForFunction(() => window.__mc.current?.name === 'rainPlay' && window.__mc.current.rain().cfg.target >= 10, null, { timeout: 15000 });
  assert.equal((await data(page)).settings.tutorialDone, true);
  await rainPlay(page, { every: 250 });
  await waitScreen(page, 'results');
  assert.equal(await page.locator('.stars .s.on').count(), 3);
  let d = await data(page);
  assert.equal(d.journey.stars[1], 3);
  assert.equal(d.journey.unlocked, 2);
  assert.equal(d.stats.rounds, 1);
  assert.ok(d.stats.correct >= 10, 'each popped drop counted');
  assert.ok(d.badges.first);
  await page.reload();
  await waitScreen(page, 'home');
  d = await data(page);
  assert.equal(d.journey.unlocked, 2);
  assert.match(await page.locator('.play-sub').innerText(), /2|٢/);
  assert.deepEqual(page.errors, []);
});

test('the drop tutorial can be skipped', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.click('#playNow');
  await waitScreen(page, 'rainPlay');
  await page.click('#skipTutorial');
  await page.waitForFunction(() => window.__mc.current?.rain?.().cfg.target >= 10);
  assert.equal((await data(page)).settings.tutorialDone, true);
});

test('losing a level (3 drops land) encourages a retry and does not unlock the next level', async () => {
  const page = await newPage(browser);
  await page.clock.install();
  await page.goto(URL_);
  await skipTut(page);
  await page.click('#playNow');
  await waitScreen(page, 'rainPlay');
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__mc.current.name)) === 'rainPlay'; i++) await page.clock.runFor(2000);
  await waitScreen(page, 'results');
  const d = await data(page);
  assert.equal(d.journey.unlocked, 1);
  assert.ok(!d.journey.stars[1]);
  assert.ok(await page.locator('#replayBtn').isVisible(), 'direct replay button');
  assert.equal(await page.locator('.tip').count(), 1);
  await page.click('#replayBtn');
  await waitScreen(page, 'rainPlay');
});

test('touch keypad responds on pointer down and only once per tap', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.click('#playNow');
  await waitScreen(page, 'rainPlay');
  await page.waitForTimeout(2400);
  const count = () => page.evaluate(() => { const R = window.__mc.current.rain(); return R.state.log.length + R.state.queue.length; });
  const key = page.locator('.rain-keypad .key').first();
  const box = await key.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  const c0 = await count();
  await page.mouse.down();
  assert.equal(await count(), c0 + 1, 'input registered on press, before release');
  await page.mouse.up();
  await page.waitForTimeout(80);
  assert.equal(await count(), c0 + 1, 'release does not type again');
});

test('double click on a practice choice registers only one answer', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.evaluate(() => window.__mc.go('play', { kind: 'practice', args: { opts: { topics: ['add'], level: 2, format: 'choice', timer: false, length: 10 } } }));
  await waitAsking(page);
  const ans = await page.evaluate(() => window.__mc.current.session.question.answer);
  await page.locator(`.choice[data-v="${ans}"]`).dblclick();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__mc.current.session.state.answers.length), 1);
  assert.equal((await data(page)).stats.questions, 1);
});

test('Arabic-Indic digits from a physical keyboard pop drops', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.click('#playNow');
  await waitScreen(page, 'rainPlay');
  await page.waitForFunction(() => window.__mc.current.rain().state.drops.some((d) => !d.dead), null, { timeout: 8000 });
  const ans = await page.evaluate(() => window.__mc.current.rain().state.drops.find((d) => !d.dead).q.answer);
  for (const ch of String(ans).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c])) await page.evaluate((k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), ch);
  await page.waitForFunction(() => window.__mc.current.rain().state.popped === 1);
});

test('practice: wrong answer shows correct answer + explanation and waits for Next', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.evaluate(() => window.__mc.go('play', { kind: 'practice', args: { opts: { topics: ['div'], level: 3, format: 'input', timer: false, length: 10 } } }));
  await answer(page, false);
  await page.waitForSelector('.feedback .explain');
  assert.match(await page.locator('.feedback').innerText(), /الإجابة الصحيحة/);
  await page.waitForTimeout(1800);
  assert.equal(await phase(page), 'feedback');
  await page.click('.next-btn');
  await waitAsking(page);
});

test('quit mid-level: no round or reward saved; popped drops still counted', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.click('#playNow');
  await waitScreen(page, 'rainPlay');
  await rainPlay(page, { until: async () => (await rainState(page)).popped >= 1 });
  await page.click('.hud .icon-btn >> nth=0');
  await page.getByRole('button', { name: 'خروج', exact: true }).last().click();
  await waitScreen(page, 'home');
  const d = await data(page);
  assert.equal(d.stats.rounds, 0);
  assert.ok(d.stats.questions >= 1);
  assert.equal(d.xp, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('mc2:active:' + window.__mc.pid)), null);
});

test('refresh mid-level → resume restores the exact storm (paused) → finish; rewards applied once', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.click('#playNow');
  await waitScreen(page, 'rainPlay');
  await rainPlay(page, { until: async () => (await rainState(page)).popped >= 3 });
  await page.waitForTimeout(1200); // تُحفظ اللقطة كل ثانية
  const before = await rainState(page);
  await page.reload();
  await waitScreen(page, 'home');
  await page.getByRole('button', { name: 'استئناف' }).click();
  await waitScreen(page, 'rainPlay');
  const after = await rainState(page);
  assert.ok(after.popped >= 3 && after.popped <= before.popped + 1, 'progress restored by replaying the input log');
  assert.ok(await page.locator('.overlay').isVisible(), 'restored paused');
  await page.getByRole('button', { name: 'متابعة' }).click();
  await rainPlay(page, { every: 250 });
  await waitScreen(page, 'results');
  let d = await data(page);
  assert.equal(d.stats.rounds, 1);
  const xp = d.xp;
  await page.reload();
  await waitScreen(page, 'home');
  d = await data(page);
  assert.equal(d.xp, xp);
  assert.equal(await page.locator('.modal').count(), 0);
});

test('pause hides the drops and freezes the storm; going to background pauses too', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.evaluate(() => window.__mc.go('rainPlay', { kind: 'time', args: { dur: 60, diff: 'medium' } }));
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.overlay');
  assert.equal(await page.locator('.sky.veiled').count(), 1);
  const t1 = (await rainState(page)).tick;
  await page.waitForTimeout(700);
  assert.equal((await rainState(page)).tick, t1, 'no ticks while paused');
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.waitForTimeout(300);
  assert.ok((await rainState(page)).tick > t1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForSelector('.overlay');
});

test('time storm ends exactly when the clock runs out and saves the record', async () => {
  const page = await newPage(browser);
  await page.clock.install();
  await page.goto(URL_);
  await skipTut(page);
  await page.evaluate(() => window.__mc.go('rainPlay', { kind: 'time', args: { dur: 30, diff: 'easy' } }));
  await page.clock.runFor(2000);
  for (let i = 0; i < 4; i++) {
    await page.clock.runFor(1500);
    const ans = await page.evaluate(() => window.__mc.current.rain().state.drops.filter((d) => !d.dead).sort((a, b) => b.y - a.y)[0]?.q.answer);
    if (ans != null) { for (const ch of String(ans)) await page.keyboard.press(ch); await page.keyboard.press('Enter'); }
    await page.clock.runFor(100);
  }
  const popped = (await rainState(page)).popped;
  assert.ok(popped >= 2);
  await page.clock.runFor(31000);
  await waitScreen(page, 'results');
  const d = await data(page);
  assert.equal(d.records['time:30:easy'].value, popped);
  assert.match(await page.locator('h1').innerText(), /انتهى الوقت/);
});

test('daily challenge: one official result (no pause), replays are practice only', async () => {
  const page = await newPage(browser);
  await page.clock.install();
  await page.goto(URL_);
  await skipTut(page);
  await page.click('#dailyCard');
  await page.getByRole('button', { name: 'ابدأ تحدي اليوم' }).click();
  await waitScreen(page, 'rainPlay');
  assert.equal(await page.locator('.hud button[aria-label="إيقاف مؤقت"]').count(), 0, 'no pause in daily');
  for (let i = 0; i < 50 && (await page.evaluate(() => window.__mc.current.name)) === 'rainPlay'; i++) await page.clock.runFor(2000);
  await waitScreen(page, 'results');
  let d = await data(page);
  const today = Object.keys(d.daily.results)[0];
  const official = d.daily.results[today];
  assert.equal(d.daily.streak, 1);
  assert.ok(d.missions.list.find((x) => x.id === 'daily1').claimed);
  const xp1 = d.xp;
  await page.click('#replayBtn');
  await waitScreen(page, 'rainPlay');
  for (let i = 0; i < 50 && (await page.evaluate(() => window.__mc.current.name)) === 'rainPlay'; i++) await page.clock.runFor(2000);
  await waitScreen(page, 'results');
  d = await data(page);
  assert.deepEqual(d.daily.results[today], official);
  assert.ok(d.xp - xp1 < 50, 'no second daily bonus');
  assert.match(await page.locator('main').innerText(), /جولة تدريب/);
});

test('survival ends after 3 drops land and saves the record', async () => {
  const page = await newPage(browser);
  await page.clock.install();
  await page.goto(URL_);
  await skipTut(page);
  await page.evaluate(() => window.__mc.go('rainPlay', { kind: 'survival', args: { diff: 'medium' } }));
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__mc.current.name)) === 'rainPlay'; i++) await page.clock.runFor(2000);
  await waitScreen(page, 'results');
  assert.equal((await data(page)).records['survival:medium'].value, 0);
});

test('card practice still works end to end', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await skipTut(page);
  await page.evaluate(() => window.__mc.go('play', { kind: 'practice', args: { opts: { topics: ['mul'], level: 3, format: 'mixed', timer: false, length: 10 } } }));
  await playRound(page);
  await waitScreen(page, 'results');
  assert.equal((await data(page)).stats.rounds, 1);
});
