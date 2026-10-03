/* اختبارات الأونلاين: خادم حقيقي + عدة متصفحات تلعب ضد بعضها. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, newPage, waitScreen } from './helpers.js';
import { startServer } from '../../server/index.js';

const ADMIN = 'e2e-admin-token-123456';
let S, browser;
before(async () => {
  S = await startServer({ adminToken: ADMIN, registerLimit: 1000, realtimeOpts: { forceSeconds: 8, queueWaitMs: 2500, startDelayMs: 1500, graceMs: 4000 } });
  browser = await launch();
});
after(async () => { await browser.close(); await S.close(); });

const URL_ = () => S.url + '/?e2e=1';
async function player(name, opts = {}) {
  const p = await newPage(browser, opts);
  await p.goto(URL_());
  await waitScreen(p, 'home');
  await p.evaluate((n) => { window.__mc.data.settings.tutorialDone = true; window.__mc.store.updateProfile(window.__mc.pid, { name: n }); window.__mc.save(); }, name);
  return p;
}
/** يلعب المطر الحالي: يكتب ناتج أدنى قطرة بعد «تفكير» */
async function autoplay(p, { until = () => false, every = 350, skill = 1, maxMs = 60000 } = {}) {
  const t0 = Date.now();
  let n = 0;
  while (Date.now() - t0 < maxMs) {
    const st = await p.evaluate(() => { const c = window.__mc.current; if (!c || c.name !== 'rainPlay') return { name: c?.name }; const R = c.rain(); const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0]; return { name: 'rainPlay', ans: d ? d.q.answer : null }; });
    if (st.name !== 'rainPlay') return st.name;
    if (await until()) return 'until';
    if (st.ans != null && (n++ % 10) < skill * 10) { for (const ch of String(st.ans)) await p.keyboard.press(ch === '-' ? 'Minus' : ch); await p.keyboard.press('Enter'); }
    await p.waitForTimeout(every);
  }
  return 'timeout';
}
const api = async (method, path, body, token) => (await fetch(S.url + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();

test('quick match: two browsers are paired, see each other live, results + rating + XP', async () => {
  const A = await player('ريم'), B = await player('Omar');
  for (const P of [A, B]) { await P.click('#nav [data-nav="online"]'); await P.waitForSelector('#qmBtn'); }
  const code = await A.evaluate(() => window.__mc.data.online.code);
  assert.match(code, /^[0-9A-F]{6}$/);
  await A.click('#qmBtn'); await B.click('#qmBtn');
  await waitScreen(A, 'rainPlay', 8000); await waitScreen(B, 'rainPlay', 8000);
  // A يرى شريط Omar
  await A.waitForSelector('.opp-box .opp', { timeout: 5000 });
  assert.match(await A.locator('.opp-box').innerText(), /Omar/);
  // لاعب أمهر من الآخر
  await Promise.all([autoplay(A, { every: 300 }), autoplay(B, { every: 900, skill: 0.5 })]);
  await waitScreen(A, 'onlineResult'); await waitScreen(B, 'onlineResult');
  await A.waitForSelector('text=فزت', { timeout: 15000 });
  const txt = await A.locator('main').innerText();
  assert.match(txt, /التصنيف/);
  assert.match(txt, /ريم/); assert.match(txt, /Omar/);
  const d = await A.evaluate(() => window.__mc.data);
  assert.ok(d.xp > 0, 'online XP applied locally');
  assert.equal(d.stats.modes.online, 1);
  const season = await api('GET', '/api/leaderboard/season');
  assert.equal(season.list[0].name, 'ريم');
  assert.deepEqual([...A.errors, ...B.errors], []);
});

test('rooms: create, join by code, emotes, host starts, live standings for everyone', async () => {
  const A = await player('Host'), B = await player('Guest');
  await A.click('#nav [data-nav="online"]'); await A.click('#roomBtn'); await A.click('#createRoom');
  await A.waitForSelector('#roomPin');
  const pin = (await A.locator('#roomPin').innerText()).trim();
  assert.match(pin, /^\d{6}$/);
  assert.equal(await A.locator('#startRoom').isDisabled(), true, 'needs two players');
  await B.click('#nav [data-nav="online"]'); await B.click('#roomBtn');
  await B.fill('input[aria-label="رمز الغرفة"]', pin); await B.click('#joinRoom');
  await B.waitForSelector('text=بانتظار المضيف');
  await A.waitForFunction(() => document.querySelectorAll('main .row').length >= 2);
  await B.click('.emote-bar button >> nth=1');
  await A.waitForSelector('.emote-pop', { timeout: 4000 });
  await A.click('#startRoom');
  await waitScreen(A, 'rainPlay', 8000); await waitScreen(B, 'rainPlay', 8000);
  await Promise.all([autoplay(A), autoplay(B, { skill: 0.3 })]);
  await waitScreen(B, 'onlineResult');
  await B.waitForSelector('text=الترتيب', { timeout: 15000 });
  assert.match(await B.locator('main').innerText(), /Host/);
  await B.getByRole('button', { name: 'العودة للغرفة' }).click();
  await waitScreen(B, 'room');
  assert.deepEqual([...A.errors, ...B.errors], []);
});

test('admin panel → tournament appears for players → play → verified score on the board → friends & challenge link', async () => {
  // لوحة الإدارة
  const adm = await newPage(browser, { width: 1100, height: 900 });
  await adm.goto(S.url + '/admin');
  await adm.fill('input[type=password]', 'wrong-token-1234567');
  await adm.click('text=دخول');
  await adm.waitForSelector('text=رمز الإدارة غير صحيح');
  await adm.fill('input[type=password]', ADMIN);
  await adm.click('text=دخول');
  await adm.click('text=🏆 البطولات');
  await adm.click('#newTournament');
  await adm.click('.occ-pick button:has-text("العيد")');
  await adm.click('text=الآن · 3 أيام');
  await adm.selectOption('select[aria-label="النمط"]', 'survival');
  await adm.selectOption('select[aria-label="الصعوبة"]', 'easy');
  await adm.click('#saveTournament');
  await adm.waitForSelector('.adm-row:has-text("بطولة العيد")');
  assert.match(await adm.locator('.adm-row').first().innerText(), /جارية/);
  // اللاعب يرى البطولة في الرئيسية
  const A = await player('Eid Player');
  await A.reload(); await waitScreen(A, 'home');
  await A.waitForSelector('.event-card', { timeout: 5000 });
  assert.match(await A.locator('.event-card').first().innerText(), /بطولة العيد/);
  await A.locator('.event-card').first().click();
  await waitScreen(A, 'tournament');
  await A.click('#playTournament');
  await waitScreen(A, 'rainPlay', 8000);
  // بقاء: نجيب قليلًا ثم نترك القطرات تسقط
  await autoplay(A, { every: 400, until: async () => (await A.evaluate(() => window.__mc.current.rain().state.popped)) >= 4 });
  await waitScreen(A, 'onlineResult', 60000);
  await A.waitForSelector('text=سُجّلت نتيجتك', { timeout: 15000 });
  assert.match(await A.locator('main').innerText(), /ترتيبك: (1|١)/);
  const ts = await api('GET', '/api/tournaments');
  const lb = await api('GET', `/api/tournaments/${ts.tournaments[0].id}`);
  assert.equal(lb.leaderboard.list[0].name, 'Eid Player');
  assert.ok(lb.leaderboard.list[0].score > 0);
  // صديق + تحدٍّ بالرابط من نفس الجولة
  const B = await player('Buddy');
  await B.click('#nav [data-nav="online"]'); await B.click('#friendsBtn');
  const codeA = await A.evaluate(() => window.__mc.data.online.code);
  await B.fill('input[aria-label="رمز صديقك"]', codeA);
  await B.click('#addFriend');
  await B.waitForSelector('text=Eid Player');
  await A.evaluate(() => { navigator.share = undefined; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await A.click('#challengeBtn');
  await A.waitForFunction(() => window.__copied);
  const link = await A.evaluate(() => window.__copied.match(/\?c=([\w-]+)/)[1]);
  await B.goto(S.url + '/?e2e=1&c=' + link);
  await waitScreen(B, 'challenge');
  assert.match(await B.locator('main').innerText(), /تحدٍّ من Eid Player/);
  assert.deepEqual([...A.errors, ...B.errors, ...adm.errors.filter((e) => !/401/.test(e))], []); // 401 = تجربة الرمز الخاطئ المقصودة
});

test('offline: online hub shows a clear message while solo play still works', async () => {
  const P = await newPage(browser);
  await P.goto(URL_());
  await waitScreen(P, 'home');
  await P.context().setOffline(true);
  await P.click('#nav [data-nav="online"]');
  await P.waitForSelector('text=تعذّر الاتصال');
  await P.click('#nav [data-nav="home"]');
  await P.evaluate(() => { window.__mc.data.settings.tutorialDone = true; });
  await P.click('#playNow');
  await waitScreen(P, 'rainPlay');
  await P.context().setOffline(false);
});
