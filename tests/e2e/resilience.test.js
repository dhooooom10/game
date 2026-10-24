/* المتانة: بيانات محفوظة تالفة أو جولة معلّقة غير مفهومة لا توقف اللعبة أبدًا،
   وشاشة تعذّر بناؤها تعود بأمان وتُسجَّل في «سجل المشكلات». */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen } from './helpers.js';

let S, browser;
before(async () => { S = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

const BAD_ACTIVE = [
  { engine: 'rain', kind: 'levelDuel', args: null, seed: 3, log: [], tick: 10 },
  { engine: 'rain', kind: 'custom', args: null, seed: 3, log: [], tick: 10 },
  { engine: 'rain', kind: 'journey', seed: 3, log: [], tick: 10 },
  { engine: 'rain', kind: 'daily', args: {}, seed: 3, log: [], tick: 10 },
  { kind: 'practice', args: {}, seed: 1, snap: { foo: 1 } },
];

test('a damaged saved round never blocks the game: it is dropped and home opens', async () => {
  for (const bad of BAD_ACTIVE) {
    const p = await newPage(browser);
    await p.goto(S.url + '?e2e=1'); await waitScreen(p, 'home');
    await p.evaluate((bad) => { const a = window.__mc; a.data.settings.tutorialDone = true; a.save(); localStorage.setItem('mc2:active:' + a.pid, JSON.stringify(bad)); }, bad);
    await p.reload(); await waitScreen(p, 'home');
    await p.waitForSelector('#playNow');
    assert.equal(await p.locator('.modal, #resumeCard').count(), 0, 'no resume offer for a damaged round');
    assert.equal(await p.evaluate(() => localStorage.getItem('mc2:active:' + window.__mc.pid)), null, 'damaged round removed');
    assert.deepEqual(p.errors, [], JSON.stringify(bad));
    await p.context().close();
  }
});

test('damaged player data (journey, challenges list) is repaired on load', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1'); await waitScreen(p, 'home');
  await p.evaluate(() => {
    const a = window.__mc; a.data.settings.tutorialDone = true; a.save();
    const k = 'mc2:p:' + a.pid; const d = JSON.parse(localStorage.getItem(k));
    d.journey = { unlocked: 'x', stars: null, best: null }; d.social = { uid: 'a', list: [null, { dir: 'recv' }, { id: 'z', dir: 'sent', args: { level: 1 }, replies: null }] }; d.records = null;
    localStorage.setItem(k, JSON.stringify(d)); a.save = () => {};
  });
  await p.reload(); await waitScreen(p, 'home');
  await p.waitForSelector('#playNow');
  await p.evaluate(() => window.__mc.go('friends'));
  await waitScreen(p, 'friends');
  assert.deepEqual(p.errors, []);
});

test('a screen that fails to build goes back safely, and the problem appears in Settings', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1'); await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.go('journey'); });
  await waitScreen(p, 'journey');
  await p.evaluate(() => window.__mc.go('rainPlay', { kind: 'no-such-kind', args: {} }));
  await waitScreen(p, 'journey');
  await p.waitForSelector('text=تعذّر فتح هذه الشاشة');
  await p.evaluate(() => window.__mc.go('settings'));
  await p.click('#settingsMore summary');
  await p.waitForSelector('#errLog #copyErrors');
  assert.match(await p.textContent('#errLog'), /سجل المشكلات/);
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('mc2:errors')));
  assert.equal(log.length, 1); assert.match(log[0].w, /screen:rainPlay/);
  assert.ok(p.errors.every((e) => /rain kind/.test(e)), 'only the expected (logged) error');
});

test('unfinished round: a calm card on home (no blocking dialog) — resume it or dismiss it', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1'); await waitScreen(p, 'home');
  await p.evaluate(() => { const a = window.__mc; a.data.settings.tutorialDone = true; a.save(); a.go('rainPlay', { kind: 'journey', args: { level: 2 } }); });
  await p.waitForFunction(() => window.__mc.current?.rain?.()?.state?.tick > 90, null, { timeout: 10000 });
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await p.reload(); await waitScreen(p, 'home');
  await p.waitForSelector('#resumeCard');
  assert.equal(await p.locator('.modal').count(), 0, 'no blocking dialog');
  assert.match(await p.textContent('#resumeCard'), /المرحلة/);
  // البطاقة فوق «العب الآن» واللاعب يستطيع اللعب مباشرة
  await p.waitForSelector('#playNow');
  await p.click('#resumeBtn');
  await waitScreen(p, 'rainPlay');
  assert.ok(await p.evaluate(() => window.__mc.current.rain().state.tick > 0), 'restored, not restarted');
  // نرجع للرئيسية ونجرّب التجاهل
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await p.reload(); await waitScreen(p, 'home');
  await p.click('#resumeDismiss');
  assert.equal(await p.locator('#resumeCard').count(), 0);
  assert.equal(await p.evaluate(() => localStorage.getItem('mc2:active:' + window.__mc.pid)), null);
  await p.reload(); await waitScreen(p, 'home'); await p.waitForSelector('#playNow');
  assert.equal(await p.locator('#resumeCard').count(), 0, 'gone for good');
  assert.deepEqual(p.errors, []);
});
