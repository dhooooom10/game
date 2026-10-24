/* «تحدّيك الخاص» الموحّد في متصفح حقيقي: الوصول والإكمال للأنماط الثلاثة، المهام والشارات،
   منع التعارض، الاستئناف بعد إعادة التحميل بلا مكافأة مكررة، بيانات لاعب قديم، التيربو والسرعة،
   وتذكيرات الجهاز. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen } from './helpers.js';

let S, browser;
before(async () => { S = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

async function fresh({ clock = false } = {}) {
  const p = await newPage(browser);
  if (clock) await p.clock.install();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  return p;
}
const setMissions = (p, ids) => p.evaluate((ids) => { const d = window.__mc.data; d.missions.list = ids.map((id) => ({ id, goal: 1, progress: 0, done: false, claimed: false })); window.__mc.save(); }, ids);
const answerLowest = (p) => p.evaluate(() => {
  const c = window.__mc.current; if (c?.name !== 'rainPlay') return false;
  const d = c.rain().state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
  if (d) { for (const ch of String(d.q.answer)) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }
  return true;
});
const data = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__mc.data)));

test('time challenge: reachable from home in two taps, completes at time-out, counts the time mission only', async () => {
  const p = await fresh({ clock: true });
  await setMissions(p, ['time1', 'survive1', 'custom1']);
  await p.click('#modeCustom');
  await waitScreen(p, 'setupCustom');
  for (const id of ['#ch-time', '#ch-survival', '#ch-custom']) await p.waitForSelector(id);
  await p.click('#ch-time');
  await p.click('.seg button[data-v="30"]');
  await p.click('.seg button[data-v="easy"]');
  assert.match(await p.textContent('.ch-rules'), /ثانية/);
  await p.click('#startChallenge');
  await waitScreen(p, 'rainPlay');
  const cfg = await p.evaluate(() => window.__mc.current.rain().cfg);
  assert.equal(cfg.timeLimit, 30); assert.equal(cfg.lives, null); assert.ok(!cfg.turbo);
  await p.clock.runFor(2500);
  for (let i = 0; i < 40; i++) { if (!(await answerLowest(p))) break; await p.clock.runFor(700); }
  await p.clock.runFor(32000);
  await waitScreen(p, 'results');
  const d = await data(p);
  const pop = d.records['time:30:easy'].value;
  assert.ok(pop >= 5, 'record saved under the time key: ' + pop);
  assert.equal(d.missions.list.find((m) => m.id === 'time1').done, true);
  assert.equal(d.missions.list.find((m) => m.id === 'survive1').done, false);
  assert.equal(d.missions.list.find((m) => m.id === 'custom1').done, false);
  assert.match(await p.locator('main').innerText(), /انتهى الوقت/);
  await p.waitForSelector('#progressLeft', { timeout: 3000 }); // التقدّم المتبقي (البقاء والتخصيص لم يكتملا)
  assert.deepEqual(p.errors, []);
});

test('survival from the mission row: preselected, ends when tries run out; under 5 correct does not count', async () => {
  const p = await fresh({ clock: true });
  await setMissions(p, ['survive1']);
  await p.evaluate(() => window.__mc.go('home', {}, { root: true }));
  await p.click('[data-mission="survive1"]');
  await waitScreen(p, 'setupCustom');
  await p.waitForSelector('#ch-survival.on');
  await p.click('#startChallenge');
  await waitScreen(p, 'rainPlay');
  assert.equal(await p.evaluate(() => window.__mc.current.rain().cfg.lives), 3);
  // لا إجابات: تسقط ٣ قطرات ← تنتهي الجولة بلا إكمال للمهمة
  for (let i = 0; i < 80 && (await p.evaluate(() => window.__mc.current.name)) === 'rainPlay'; i++) await p.clock.runFor(1500);
  await waitScreen(p, 'results');
  let d = await data(p);
  assert.equal(d.missions.list[0].done, false, 'not completed: fewer than 5 correct');
  assert.match(await p.locator('main').innerText(), /5|٥/);
  // مرة ثانية: ٦ إجابات ثم تنفد المحاولات ← تُحتسب
  await p.click('#replayBtn');
  await waitScreen(p, 'rainPlay');
  await p.clock.runFor(2000);
  for (let i = 0; i < 60; i++) {
    const n = await p.evaluate(() => window.__mc.current.rain?.().state.popped);
    if (n == null || n >= 6) break;
    await answerLowest(p); await p.clock.runFor(600);
  }
  for (let i = 0; i < 120 && (await p.evaluate(() => window.__mc.current.name)) === 'rainPlay'; i++) await p.clock.runFor(1500);
  await waitScreen(p, 'results');
  d = await data(p);
  assert.equal(d.missions.list[0].done, true);
  assert.ok(d.records['survival:medium'].value >= 6);
  assert.deepEqual(p.errors, []);
});

test('custom: conflicting settings are prevented; turbo never applies to your challenge; journey turbo still works', async () => {
  const p = await fresh();
  await p.evaluate(() => { window.__mc.data.prefs.turbo = { on: true }; window.__mc.go('setupCustom', { mode: 'custom' }); });
  await p.waitForSelector('.custom-fields');
  // اختر «غير محدودة» ثم «بلا حد» للمدة ← تُعدَّل المحاولات تلقائيًا
  await p.click('.custom-fields button[role=radio][data-v="0"]:has-text("غير محدودة")');
  assert.equal(await p.evaluate(() => window.__mc.data.prefs.challenge.custom.lives), 0);
  assert.equal(await p.locator('.custom-fields button[role=radio][data-v="0"]:has-text("بلا حد")').isDisabled(), true, 'no-limit duration disabled while tries are unlimited');
  await p.click('.custom-fields button[role=radio][data-v="3"]:has-text("محاولات")');
  await p.click('.custom-fields button[role=radio][data-v="0"]:has-text("بلا حد")');
  const c = await p.evaluate(() => window.__mc.data.prefs.challenge.custom);
  assert.equal(c.dur, 0); assert.equal(c.lives, 3);
  assert.equal(await p.locator('.custom-fields button[role=radio][data-v="0"]:has-text("غير محدودة")').isDisabled(), true);
  await p.click('#startChallenge');
  await waitScreen(p, 'rainPlay');
  const cfg = await p.evaluate(() => window.__mc.current.rain().cfg);
  assert.ok(!cfg.turbo, 'turbo is journey-only'); assert.equal(cfg.timeLimit, null); assert.equal(cfg.lives, 3);
  await p.evaluate(() => window.__mc.go('rainPlay', { kind: 'journey', args: { level: 3, turbo: true } }, { replace: true }));
  await waitScreen(p, 'rainPlay');
  const j = await p.evaluate(() => window.__mc.current.rain().cfg);
  assert.equal(j.turbo, true); assert.ok(j.accel >= 0.14);
  assert.deepEqual(p.errors, []);
});

test('reload mid-round: resume finishes once; reloading after the results gives no second reward', async () => {
  const p = await fresh();
  await p.evaluate(() => window.__mc.go('rainPlay', { kind: 'custom', args: { mode: 'time', dur: 30, diff: 'easy' } }));
  await waitScreen(p, 'rainPlay');
  await p.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) { await answerLowest(p); await p.waitForTimeout(400); }
  await p.waitForTimeout(1300); // حفظ الجولة المعلّقة (كل ثانية)
  await p.reload();
  await waitScreen(p, 'home');
  await p.getByRole('button', { name: 'استئناف' }).click();
  await waitScreen(p, 'rainPlay');
  await p.keyboard.press('Enter'); // استئناف من الإيقاف
  await p.evaluate(() => { const R = window.__mc.current.rain(); while (R.state.tick < R.limitTicks - 2) R.step(); });
  await waitScreen(p, 'results', 10000);
  const d1 = await data(p);
  assert.equal(d1.stats.rounds, 1);
  await p.reload();
  await waitScreen(p, 'home');
  await p.waitForTimeout(500);
  assert.equal(await p.locator('.modal, #resumeCard').count(), 0, 'no resume offer after finishing');
  const d2 = await data(p);
  assert.equal(d2.stats.rounds, 1); assert.equal(d2.xp, d1.xp); assert.equal(d2.pearls, d1.pearls);
  assert.deepEqual(p.errors, []);
});

test('an old (v2) player loads with progress kept and lands on the new screens without broken links', async () => {
  const p = await fresh();
  await p.evaluate(async () => {
    const { KEYS } = await import('/src/core/storage.js');
    const old = {
      v: 2, xp: 5000, badges: { first: '2026-01-01', survive25: '2026-02-02' }, journey: { unlocked: 21, stars: { 1: 3, 2: 3 }, best: {} },
      records: { 'time:60:medium': { value: 22, score: 1100 }, 'survival:medium:turbo': { value: 7, score: 200 }, 'custom:addsub:easy:fast:t60:1': { value: 31, score: 1800 } },
      prefs: { time: { dur: 120, diff: 'hard' }, custom: { ops: ['add', 'sub'], level: 'easy', speed: 'fast', end: 't60', accel: true } },
      settings: { lang: 'ar', tutorialDone: true }, stats: { rounds: 40, questions: 400, correct: 350, timedMs: 800000, timedCount: 300, bestStreak: 19, perOp: {}, perFormat: {}, days: {}, modes: { time: 20, survival: 20 }, friendMatches: 0, rainPops: 300 },
    };
    window.__mc.save = () => {}; // لا نكتب فوقها عند مغادرة الصفحة
    window.__mc.store.backend.set(KEYS.data(window.__mc.pid), JSON.stringify(old));
  });
  await p.reload();
  await waitScreen(p, 'home');
  const d = await data(p);
  assert.equal(d.xp, 5000); assert.equal(d.journey.unlocked, 21); assert.ok(d.badges.survive25);
  assert.equal(d.records['time:60:medium'].value, 22);
  assert.ok(d.records['legacy:survival:medium:turbo']);
  assert.equal(d.prefs.challenge.time.dur, 120);
  await p.click('#nav [data-nav="progress"]');
  await waitScreen(p, 'progress');
  assert.match(await p.locator('main').innerText(), /٢٢|22/);
  await p.click('#nav [data-nav="locker"]');
  await waitScreen(p, 'locker');
  await p.click('[data-badge="speed20"]');
  await waitScreen(p, 'setupCustom');
  await p.waitForSelector('#ch-time.on');
  assert.equal(await p.evaluate(() => window.__mc.data.prefs.challenge.time.dur), 120, 'badge preset: 120 s, medium');
  assert.deepEqual(p.errors, []);
});

test('device reminders: scheduled on leaving the app (streak at 8 pm + pending friend challenges), none when turned off', async () => {
  const p = await newPage(browser);
  await p.addInitScript(() => {
    window.__sched = [];
    const ln = {
      checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }),
      cancel: async () => {}, schedule: async ({ notifications }) => { window.__sched.push(notifications); },
    };
    const plugins = { LocalNotifications: ln };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n in plugins, registerPlugin: (n) => plugins[n] };
  });
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  const hide = () => p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.evaluate(() => { window.__mc.data.social = { uid: 'me0001', list: [{ id: 'a', dir: 'recv', mine: null }, { id: 'b', dir: 'recv', mine: null }, { id: 'c', dir: 'recv', mine: 5 }] }; window.__mc.data.daily.streak = 4; window.__mc.data.daily.last = new Date().toISOString().slice(0, 10); });
  await hide();
  await p.waitForFunction(() => window.__sched.length > 0);
  const list = await p.evaluate(() => window.__sched[0]);
  const streak = list.find((n) => n.id === 1001);
  assert.ok(streak); assert.equal(new Date(streak.schedule.at).getHours(), 20);
  assert.ok(list.find((n) => n.id === 1002 && /2|٢/.test(n.body)), 'pending friend challenges reminder');
  // الإعداد مطفأ ← لا جدولة
  await p.evaluate(() => { window.__sched = []; window.__mc.data.settings.notify = false; Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await hide();
  await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__sched.length), 0);
});
