import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen, answer, playRound, screenName, phase, waitAsking, waitNextOrEnd } from './helpers.js';

let srv, browser, URL_;
before(async () => { srv = await startServer(); browser = await launch(); URL_ = srv.url + '?e2e=1'; });
after(async () => { await browser.close(); await srv.close(); });

const data = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__mc.data)));

test('first run: tutorial (skippable) → level 1 → 3 stars → progress persists after reload', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await waitScreen(page, 'home');
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
  await page.click('#playNow');
  await waitScreen(page, 'play');
  assert.equal(await page.evaluate(() => window.__mc.current.session.spec.mode), 'tutorial');
  await playRound(page);                       // يكمل الشرح وينتقل للمرحلة ١
  await page.waitForFunction(() => window.__mc.current?.session?.spec?.mode === 'journey');
  await playRound(page);                       // كل الإجابات صحيحة
  await waitScreen(page, 'results');
  assert.equal(await page.locator('.stars .s.on').count(), 3);
  let d = await data(page);
  assert.equal(d.journey.stars[1], 3);
  assert.equal(d.journey.unlocked, 2);
  assert.equal(d.settings.tutorialDone, true);
  assert.equal(d.stats.rounds, 1);
  assert.ok(d.badges.first);
  // إعادة التحميل: التقدّم باقٍ
  await page.reload();
  await waitScreen(page, 'home');
  d = await data(page);
  assert.equal(d.journey.unlocked, 2);
  assert.equal(d.stats.rounds, 1);
  assert.match(await page.locator('.play-sub').innerText(), /2|٢/);
  assert.deepEqual(page.errors, []);
});

test('skip tutorial button goes straight to level 1', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.click('#playNow');
  await waitScreen(page, 'play');
  await page.getByRole('button', { name: 'تخطَّ الشرح' }).click();
  await page.waitForFunction(() => window.__mc.current?.session?.spec?.mode === 'journey');
  assert.equal((await data(page)).settings.tutorialDone, true);
});

test('failing a level encourages retry and does not unlock the next one', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.click('#playNow');
  await waitScreen(page, 'play');
  await playRound(page, (i) => i % 2 === 0);  // دقة ~50٪
  await waitScreen(page, 'results');
  const d = await data(page);
  assert.equal(d.journey.unlocked, 1);
  assert.ok(!d.journey.stars[1]);
  assert.ok(await page.locator('#replayBtn').isVisible(), 'direct replay button');
  assert.ok((await page.locator('.tip').count()) === 1, 'improvement tip shown');
  await page.click('#replayBtn');
  await waitScreen(page, 'play');
});

test('double click on a choice registers only one answer', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.evaluate(() => window.__mc.go('play', { kind: 'practice', args: { opts: { topics: ['add'], level: 2, format: 'choice', timer: false, length: 10 } } }));
  await waitAsking(page);
  const ans = await page.evaluate(() => window.__mc.current.session.question.answer);
  await page.locator(`.choice[data-v="${ans}"]`).dblclick();
  await page.locator(`.choice[data-v="${ans}"]`).click({ force: true }).catch(() => {});
  await page.waitForTimeout(100);
  const n = await page.evaluate(() => window.__mc.current.session.state.answers.length);
  assert.equal(n, 1);
  assert.equal((await data(page)).stats.questions, 1);
});

test('Arabic-Indic digits typed on the keyboard are accepted', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.data.settings.autoSubmit = false; window.__mc.save(); });
  await page.evaluate(() => window.__mc.go('play', { kind: 'practice', args: { opts: { topics: ['mul'], level: 3, format: 'input', timer: false, length: 10 } } }));
  await waitAsking(page);
  const ans = await page.evaluate(() => window.__mc.current.session.question.answer);
  const ar = String(ans).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);
  for (const ch of ar) await page.keyboard.insertText(ch).catch(() => {});
  // insertText لا يطلق keydown؛ نرسل الأحداث مباشرة كما تفعل لوحة مفاتيح عربية
  if ((await page.evaluate(() => window.__mc.current.session.state.answers.length)) === 0) {
    for (const ch of ar) await page.evaluate((k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), ch);
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(() => window.__mc.current.session.state.answers.length === 1);
  assert.equal(await page.evaluate(() => window.__mc.current.session.state.correct), 1);
});

test('practice: wrong answer shows correct answer + explanation and waits for Next', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.evaluate(() => window.__mc.go('play', { kind: 'practice', args: { opts: { topics: ['div'], level: 3, format: 'input', timer: false, length: 10 } } }));
  await answer(page, false);
  await page.waitForSelector('.feedback .explain');
  assert.match(await page.locator('.feedback').innerText(), /الإجابة الصحيحة/);
  await page.waitForTimeout(1800);
  assert.equal(await phase(page), 'feedback', 'waits for the player');
  await page.click('.next-btn');
  await waitAsking(page);
});

test('quit mid-round: no round/reward saved; answers still counted', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.click('#playNow');
  await waitScreen(page, 'play');
  const q = await answer(page, true);
  await waitNextOrEnd(page, q.index);
  await page.click('.hud .icon-btn >> nth=0');
  await page.getByRole('button', { name: 'خروج', exact: true }).last().click();
  await waitScreen(page, 'home');
  const d = await data(page);
  assert.equal(d.stats.rounds, 0);
  assert.equal(d.stats.questions, 1);
  assert.equal(d.xp, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('mc2:active:' + window.__mc.pid)), null);
});

test('refresh mid-round → resume prompt → continue; rewards applied once', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.click('#playNow');
  await waitScreen(page, 'play');
  for (let i = 0; i < 3; i++) { const q = await answer(page, true); await waitNextOrEnd(page, q.index); }
  const before = await page.evaluate(() => window.__mc.current.session.state.correct);
  assert.equal(before, 3);
  await page.reload();
  await waitScreen(page, 'home');
  await page.getByRole('button', { name: 'استئناف' }).click();
  await waitScreen(page, 'play');
  assert.equal(await phase(page), 'paused');
  assert.equal(await page.evaluate(() => window.__mc.current.session.state.correct), 3);
  await page.getByRole('button', { name: 'متابعة' }).click();
  await playRound(page);
  await waitScreen(page, 'results');
  let d = await data(page);
  assert.equal(d.stats.rounds, 1);
  const xp = d.xp;
  assert.equal(d.stats.questions, 8, 'each answer counted once across the reload');
  // إعادة التحميل بعد النتيجة لا تكرر المكافأة ولا تعرض استئنافًا
  await page.reload();
  await waitScreen(page, 'home');
  d = await data(page);
  assert.equal(d.xp, xp);
  assert.equal(await page.locator('.modal').count(), 0);
});

test('pause hides the question and swaps it on resume; background tab auto-pauses', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.evaluate(() => window.__mc.go('play', { kind: 'time', args: { dur: 60, diff: 'medium' } }));
  await waitAsking(page);
  const sig1 = await page.evaluate(() => window.__mc.current.session.question.sig);
  await page.keyboard.press('Escape');
  assert.equal(await phase(page), 'paused');
  assert.equal(await page.locator('.qcard.hidden-q').count(), 1);
  const rem1 = await page.evaluate(() => window.__mc.current.session.remainingMs(performance.now()));
  await page.waitForTimeout(800);
  const rem2 = await page.evaluate(() => window.__mc.current.session.remainingMs(performance.now()));
  assert.equal(rem1, rem2, 'clock stopped while paused');
  await page.getByRole('button', { name: 'متابعة' }).click();
  const sig2 = await page.evaluate(() => window.__mc.current.session.question.sig);
  assert.notEqual(sig1, sig2);
  // محاكاة الانتقال للخلفية
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await phase(page), 'paused');
});

test('time attack ends when the clock runs out and saves the record', async () => {
  const page = await newPage(browser);
  await page.clock.install();
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.evaluate(() => window.__mc.go('play', { kind: 'time', args: { dur: 30, diff: 'easy' } }));
  await page.clock.runFor(3000);
  for (let i = 0; i < 4; i++) {
    await page.waitForFunction(() => window.__mc.current?.session?.phase === 'asking');
    const q = await answer(page, true);
    await page.clock.runFor(600);
    await waitNextOrEnd(page, q.index);
  }
  await page.clock.runFor(31000);
  await waitScreen(page, 'results');
  const d = await data(page);
  assert.equal(d.records['time:30:easy'].value, 4);
  assert.match(await page.locator('h1').innerText(), /انتهى الوقت/);
});

test('daily challenge: one official result, reward once, replays are practice', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.click('#dailyCard');
  await page.getByRole('button', { name: 'ابدأ تحدي اليوم' }).click();
  await waitScreen(page, 'play');
  assert.equal(await page.locator('.hud button[aria-label="إيقاف مؤقت"]').count(), 0, 'no pause in daily');
  await playRound(page, (i) => i !== 2);
  await waitScreen(page, 'results');
  let d = await data(page);
  const today = Object.keys(d.daily.results)[0];
  const official = d.daily.results[today];
  assert.equal(official.correct, 14);
  assert.equal(d.daily.streak, 1);
  const xp1 = d.xp;
  const m = d.missions.list.find((x) => x.id === 'daily1');
  assert.ok(m.done && m.claimed);
  // جولة تدريب
  await page.click('#replayBtn');
  await waitScreen(page, 'play');
  await playRound(page, () => true);
  await waitScreen(page, 'results');
  d = await data(page);
  assert.deepEqual(d.daily.results[today], official, 'official result unchanged');
  assert.equal(d.daily.streak, 1);
  assert.ok(d.xp - xp1 < 200, 'no second daily bonus');
  assert.match(await page.locator('main').innerText(), /جولة تدريب/);
});

test('survival ends after 3 lost tries', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.evaluate(() => window.__mc.go('play', { kind: 'survival', args: { diff: 'medium' } }));
  await playRound(page, (i) => i < 2);
  await waitScreen(page, 'results');
  const d = await data(page);
  assert.equal(d.records['survival:medium'].value, 2);
});
