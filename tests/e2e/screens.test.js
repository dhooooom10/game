import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen, playRound, noHorizontalOverflow, rainPlay } from './helpers.js';

let srv, browser, URL_;
before(async () => { srv = await startServer(); browser = await launch(); URL_ = srv.url + '?e2e=1'; });
after(async () => { await browser.close(); await srv.close(); });

const go = (page, name, params = {}) => page.evaluate(([n, p]) => window.__mc.go(n, p), [name, params]);

test('every screen renders without errors and without horizontal overflow at 320px', async () => {
  const page = await newPage(browser, { width: 320, height: 640 });
  await page.goto(URL_);
  await waitScreen(page, 'home');
  const screens = [['home'], ['journey'], ['world', { w: 0 }], ['world', { w: 9 }], ['progress'], ['locker'], ['locker', { tab: 'looks' }],
    ['settings'], ['profiles'], ['setupTime'], ['setupSurvival'], ['practice'], ['practice', { tab: 'lessons' }], ['lessonPath', { pid: 'mul' }],
    ['friendSetup']];
  for (const [name, params] of screens) {
    await go(page, name, params || {});
    await waitScreen(page, name);
    assert.ok(await noHorizontalOverflow(page), `overflow on ${name}`);
    // كل زر ظاهر له اسم مقروء
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('#app button, #nav button')].filter((b) => b.offsetParent && !(b.innerText.trim() || b.getAttribute('aria-label'))).length);
    assert.equal(unnamed, 0, `unnamed buttons on ${name}`);
  }
  for (const kind of [['journey', { level: 57 }], ['time', { dur: 60, diff: 'hard' }], ['survival', { diff: 'expert' }]]) {
    await go(page, 'rainPlay', { kind: kind[0], args: kind[1] });
    await page.waitForTimeout(3500);
    assert.ok(await noHorizontalOverflow(page), `overflow in rain ${kind[0]}`);
    await page.evaluate(() => window.__mc.current.destroy());
  }
  for (const kind of [['practice', { opts: { topics: ['frac', 'percent', 'power', 'order'], level: 6, format: 'mixed', timer: true, length: 10 } }], ['lesson', { pid: 'count', li: 0 }]]) {
    await go(page, 'play', { kind: kind[0], args: kind[1] });
    await page.waitForFunction(() => window.__mc.current?.session?.phase === 'asking', null, { timeout: 6000 });
    assert.ok(await noHorizontalOverflow(page), `overflow in play ${kind[0]}`);
    await page.evaluate(() => window.__mc.current.destroy());
  }
  assert.deepEqual(page.errors, []);
});

test('bottom navigation tabs and settings work; language switch to English flips direction', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  for (const [nav, name] of [['journey', 'journey'], ['progress', 'progress'], ['locker', 'locker'], ['home', 'home']]) {
    await page.click(`#nav [data-nav="${nav}"]`);
    await waitScreen(page, name);
  }
  await page.click('[data-go="settings"]');
  await waitScreen(page, 'settings');
  await page.selectOption('select', 'en');
  await page.waitForFunction(() => document.documentElement.dir === 'ltr');
  assert.match(await page.locator('h1').innerText(), /Settings/);
  await page.selectOption('select', 'ar');
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  assert.deepEqual(page.errors, []);
});

test('progress page: clear empty state, then real metrics after playing', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.click('#nav [data-nav="progress"]');
  await waitScreen(page, 'progress');
  assert.match(await page.locator('main').innerText(), /لا توجد بيانات بعد/);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await go(page, 'play', { kind: 'practice', args: { opts: { topics: ['add', 'mul'], level: 3, format: 'mixed', timer: false, length: 10 } } });
  await playRound(page, (i) => i % 4 !== 0);
  await waitScreen(page, 'results');
  await page.click('#nav [data-nav="progress"]').catch(() => go(page, 'progress'));
  await go(page, 'progress');
  await waitScreen(page, 'progress');
  const txt = await page.locator('main').innerText();
  assert.match(txt, /الأسئلة المجابة/);
  assert.match(txt, /١٠/);
  assert.match(txt, /٧٠٪/);
  assert.equal(await page.locator('svg.chart').count(), 1);
  assert.doesNotMatch(txt, /خالد|سارة|ترتيب عالمي/);
});

test('friend challenge (turns): equivalent questions, both play, winner shown', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.prefs.friend.count = 6; window.__mc.data.prefs.friend.layout = 'turns'; window.__mc.save(); });
  await go(page, 'friendSetup');
  await page.fill('input[aria-label="اللاعب الأول"]', 'سلمى');
  await page.locator('input[aria-label="اللاعب الأول"]').blur();
  await page.click('#startFriend');
  await waitScreen(page, 'friendHandoff');
  await page.getByRole('button', { name: 'أنا جاهز' }).click();
  await waitScreen(page, 'play');
  const t1 = await page.evaluate(() => window.__mc.current.session.question);
  await playRound(page, () => true);
  await waitScreen(page, 'friendHandoff');
  assert.match(await page.locator('main').innerText(), /النتيجة التي يجب تجاوزها/);
  await page.getByRole('button', { name: 'أنا جاهز' }).click();
  await waitScreen(page, 'play');
  const t2 = await page.evaluate(() => window.__mc.current.session.question);
  assert.equal(t1.topic, t2.topic); assert.equal(t1.tier, t2.tier); assert.equal(t1.format, t2.format);
  await playRound(page, (i) => i > 0);
  await waitScreen(page, 'friendResult');
  assert.match(await page.locator('h1').innerText(), /فاز سلمى/);
  const d = await page.evaluate(() => window.__mc.data);
  assert.equal(d.stats.friendMatches, 1);
  assert.equal(d.stats.questions, 0, 'friend answers are not attributed to the profile');
  assert.ok(d.badges.friend);
});

test('friend challenge (split screen) plays both panes simultaneously', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.prefs.friend.count = 6; window.__mc.data.prefs.friend.layout = 'split'; window.__mc.save(); });
  await go(page, 'friendSetup');
  await page.click('#startFriend');
  await waitScreen(page, 'friendSplit');
  for (let i = 0; i < 6; i++) {
    for (const p of [0, 1]) {
      await page.evaluate(([pp]) => {
        const panes = document.querySelectorAll('.split-pane');
        const pane = panes[pp === 0 ? 1 : 0];
        const b = pane.querySelector('.choice:not([disabled]), .cmp-btn:not([disabled])');
        b && b.click();
      }, [p]);
    }
    await page.waitForTimeout(1000);
  }
  await waitScreen(page, 'friendResult', 10000);
  assert.deepEqual(page.errors, []);
});

test('profiles: data is separated per player; password-protected profile needs unlock', async () => {
  const page = await newPage(browser);
  await page.goto(URL_);
  const idA = await page.evaluate(() => window.__mc.pid);
  await page.evaluate(() => { window.__mc.data.xp = 500; window.__mc.save(); });
  await go(page, 'profiles');
  await page.fill('input[aria-label="الاسم"]', 'ريم');
  await page.fill('input[aria-label="كلمة مرور (اختيارية)"]', 'abcd');
  await page.getByRole('button', { name: 'إنشاء' }).click();
  await waitScreen(page, 'home');
  const idB = await page.evaluate(() => window.__mc.pid);
  assert.notEqual(idA, idB);
  assert.equal(await page.evaluate(() => window.__mc.data.xp), 0);
  await page.evaluate(() => { window.__mc.data.xp = 42; window.__mc.save(); });
  // العودة إلى A
  await go(page, 'profiles');
  await page.getByRole('button', { name: 'تبديل' }).click();
  await waitScreen(page, 'home');
  assert.equal(await page.evaluate(() => window.__mc.data.xp), 500);
  // B محمي: يطلب كلمة المرور (تذكّر ٣٠ يومًا كان مفعّلًا عند الإنشاء — نقفله أولًا)
  await page.evaluate((id) => window.__mc.store.lock(id), idB);
  await go(page, 'profiles');
  await page.getByRole('button', { name: 'تبديل' }).click();
  await page.fill('.modal input[type=password]', 'wrong');
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.waitForSelector('text=كلمة المرور غير صحيحة');
  await page.fill('.modal input[type=password]', 'abcd');
  await page.getByRole('button', { name: 'دخول' }).click();
  await waitScreen(page, 'home');
  assert.equal(await page.evaluate(() => window.__mc.data.xp), 42);
});

test('legacy v1 save in localStorage migrates on first load', async () => {
  const storage = {
    mc_users: JSON.stringify([{ uid: 'u1', name: 'خالد', role: 'admin', salt: null, hash: null }]),
    mc_session: JSON.stringify({ uid: 'u1', exp: Date.now() + 1e9 }),
    'mc_set:u1': JSON.stringify({ lang: 'ar', digits: 'western', sound: true, tutDone: true }),
    'mc_prog:u1': JSON.stringify({ unlocked: 23, stars: { 1: 3, 2: 3, 3: 2 }, edu: { 'add|0': 2 }, eduUnlocked: { add: 2 } }),
    'mc_stats:u1': JSON.stringify({ games: 30, popped: 400, bestStreak: 12, points: 9000 }),
  };
  const page = await newPage(browser, { storage });
  await page.goto(URL_);
  await waitScreen(page, 'home');
  const d = await page.evaluate(() => window.__mc.data);
  assert.equal(d.journey.unlocked, 23);
  assert.equal(d.journey.stars[3], 2);
  assert.equal(d.lessons.done['add|0'], 2);
  assert.equal(d.settings.digits, 'western');
  assert.match(await page.locator('main').innerText(), /خالد/);
  assert.match(await page.locator('main').innerText(), /نُقلت بيانات 1 لاعب/);
  assert.match(await page.locator('.play-sub').innerText(), /23/);
});

test('keyboard-only play works (Tab focus + keys)', async () => {
  const page = await newPage(browser, { width: 1280, height: 800 });
  await page.goto(URL_);
  await page.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.save(); });
  await page.focus('#playNow');
  await page.keyboard.press('Enter');
  await waitScreen(page, 'rainPlay');
  await rainPlay(page, { until: async () => (await page.evaluate(() => window.__mc.current.rain().state.popped)) >= 3 });
  assert.ok(await page.evaluate(() => window.__mc.current.rain().state.popped) >= 3);
  assert.ok(await noHorizontalOverflow(page));
});
