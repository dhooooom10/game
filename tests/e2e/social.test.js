/* الأصدقاء بلا خادم: بطاقة الأصدقاء في الرئيسية، تحدٍّ برمز بين جوالين، غرفة على نفس الجوال،
   متجر اللآلئ 💎 (حزم، عرض البداية، الإنفاق)، والفرصة الثانية باللآلئ */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen } from './helpers.js';

let S, browser;
before(async () => { S = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

async function nativePage() {
  const p = await newPage(browser);
  await p.addInitScript(() => {
    window.__calls = [];
    const owned = new Set(); let n = 0;
    const billing = {
      getProducts: async ({ ids }) => ({ products: ids.map((id) => ({ id, title: id, description: '', price: 'SAR ' + (id.startsWith('pearls') ? '9.99' : '4.99') })) }),
      purchase: async ({ id }) => { window.__calls.push(['buy', id]); owned.add(id); return { status: 'ok', purchase: { token: 'tok-' + id + '-' + (++n) + '-123456', products: [id], state: 'purchased', acknowledged: false } }; },
      queryPurchases: async () => ({ purchases: [] }),
      acknowledge: async ({ token }) => { window.__calls.push(['ack', token]); },
      consume: async ({ token }) => { window.__calls.push(['consume', token]); },
    };
    const plugins = { Billing: billing };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (x) => x in plugins, registerPlugin: (x) => plugins[x] };
  });
  return p;
}

const popUntil = async (P, n) => {
  for (let i = 0; i < 200; i++) {
    const st = await P.evaluate((n) => {
      const c = window.__mc.current; if (c?.name !== 'rainPlay') return { done: true };
      const R = c.rain(); const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
      if (d && R.state.popped < n) { for (const ch of String(d.q.answer)) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }
      return { done: false, popped: R.state.popped };
    }, n);
    if (st.done) return;
    await P.waitForTimeout(250);
  }
};
const QUICK = { mode: 'custom', ops: ['add'], level: 'easy', speed: 'fast', dur: 0, lives: 1, accel: false };

test('home is simple (Play + two cards + missions); friends tab offers code challenge and same-phone room', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  // الرئيسية بسيطة: «العب الآن» + بطاقتان + سطر المهام فقط
  await p.waitForSelector('#playNow');
  assert.equal(await p.locator('main .quick-card').count(), 2);
  assert.equal(await p.locator('#homeBell, #homeQuick, #homeTurbo, .turbo-row, .mode-grid, .online-hero').count(), 0, 'no clutter');
  // الأصدقاء في الشريط السفلي: تحدٍّ برمز أو غرفة على نفس الجوال
  await p.click('#nav button.nav-hero[data-nav="friends"]');
  await waitScreen(p, 'friends');
  assert.equal(await p.locator('.fr2-act').count(), 2);
  await p.click('[data-go="friendCompose"]');
  await waitScreen(p, 'friendCompose');
  await p.waitForSelector('#rangeHint');
  await p.evaluate(() => window.__mc.go('friends', {}, { root: true }));
  await p.click('[data-go="party"]');
  await waitScreen(p, 'party');
  assert.deepEqual(p.errors, []);
});

test('code challenge round trip between two phones: play → share code → friend plays same drops → result code → who won', async () => {
  const A = await newPage(browser), B = await newPage(browser);
  for (const [P, name] of [[A, 'Sara'], [B, 'Omar']]) {
    await P.addInitScript(() => { window.__shared = []; navigator.share = async (d) => { window.__shared.push(d); }; });
    await P.goto(S.url + '?e2e=1'); await waitScreen(P, 'home');
    await P.evaluate((name) => { const a = window.__mc; a.data.settings.tutorialDone = true; a.store.updateProfile(a.pid, { name }); a.data.missions.list = ['friend1', 'survive1'].map((id) => ({ id, goal: 1, progress: 0, done: false, claimed: false })); a.save(); }, name);
  }
  // A: تحدٍّ مخصص سريع (محاولة واحدة)
  await A.evaluate((q) => { window.__mc.data.prefs.friendChallenge = { ...q, tab: 'custom' }; window.__mc.go('friendCompose'); }, QUICK);
  await A.click('#startCompose');
  await waitScreen(A, 'rainPlay');
  const seedA = await A.evaluate(() => window.__mc.stack.at(-1).params.seed);
  await popUntil(A, 2);
  await waitScreen(A, 'results', 60000);
  const code = await A.getAttribute('#challengeCode [data-code]', 'data-code');
  assert.match(code, /^QC-/);
  await A.waitForFunction(() => window.__mc.data.missions.list.find((m) => m.id === 'friend1').done, null, { timeout: 5000 });
  await A.click('#challengeCode [data-share]');
  const msg = (await A.evaluate(() => window.__shared))[0].text;
  assert.ok(msg.includes(code) && /Sara|سارة/.test(await A.evaluate(() => window.__mc.playerName)));
  // B: يلصق الرسالة ويلعب نفس القطرات ويتجاوز النتيجة
  await B.evaluate(() => window.__mc.go('friends'));
  await B.fill('#codeIn', msg);
  await B.click('#openCode');
  await B.waitForSelector('#codeChallenge');
  assert.match(await B.textContent('#codeChallenge'), /Sara/);
  await B.click('#playCode');
  await waitScreen(B, 'rainPlay');
  assert.equal(await B.evaluate(() => window.__mc.stack.at(-1).params.seed), seedA, 'same seed → same drops');
  await popUntil(B, 6);
  await waitScreen(B, 'results', 60000);
  assert.equal(await B.locator('#reviveYes, #revivePearls').count(), 0, 'no second chance in friend challenges');
  await B.waitForSelector('#duelResult[data-outcome="win"]');
  const rcode = await B.getAttribute('#resultCode [data-code]', 'data-code');
  assert.match(rcode, /^QR-/);
  // مهمة الصديق تُحتسب، ولا تُحتسب «بقاء» رغم المحاولة الواحدة
  assert.equal(await B.evaluate(() => window.__mc.data.missions.list.find((m) => m.id === 'friend1').done), true);
  assert.equal(await B.evaluate(() => window.__mc.data.missions.list.find((m) => m.id === 'survive1').done), false);
  // A: يدخل رمز النتيجة ← خسر، والحصيلة تظهر
  await A.evaluate(() => window.__mc.go('friends', {}, { root: true }));
  await A.fill('#codeIn', rcode);
  await A.click('#openCode');
  await A.waitForSelector('#codeResult[data-outcome="lose"]');
  assert.match(await A.textContent('#codeResult'), /Omar/);
  await A.waitForSelector('.friend-row');
  // رمز معدّل يُرفض
  await A.fill('#codeIn', rcode.slice(0, -1) + (rcode.endsWith('a') ? 'b' : 'a'));
  await A.click('#openCode');
  await A.waitForSelector('#codeOut .bad');
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
});

test('same-phone room: 3 players take turns on the same drops with ghosts, standings at the end, counted once', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate((q) => { const d = window.__mc.data; d.settings.tutorialDone = true; d.prefs.party = { ...q, names: ['Lina', 'Ali'] }; window.__mc.go('party'); }, QUICK);
  await p.click('#addPlayer');
  await p.fill('.party-name:nth-child(3) input', 'Noor');
  await p.dispatchEvent('.party-name:nth-child(3) input', 'change');
  const matches = await p.evaluate(() => window.__mc.data.stats.friendMatches);
  await p.click('#startParty');
  const seeds = [];
  for (const [who, n] of [['Lina', 1], ['Ali', 3], ['Noor', 2]]) {
    await waitScreen(p, 'partyTurn');
    assert.match(await p.textContent('#partyWho'), new RegExp(who));
    await p.click('#partyReady');
    await waitScreen(p, 'rainPlay');
    seeds.push(await p.evaluate(() => window.__mc.stack.at(-1).params.seed));
    if (who !== 'Lina') assert.ok(await p.locator('.opp-box .opp').count() >= 1, 'ghosts of earlier players');
    await popUntil(p, n);
  }
  await waitScreen(p, 'partyTurn', 60000);
  await p.waitForSelector('#partyWinner');
  assert.equal(new Set(seeds).size, 1, 'everyone gets the same drops');
  assert.match(await p.textContent('#partyWinner'), /Ali/);
  assert.equal(await p.evaluate(() => window.__mc.data.stats.friendMatches), matches + 1);
  await p.evaluate(() => window.__mc.refresh?.());
  assert.equal(await p.evaluate(() => window.__mc.data.stats.friendMatches), matches + 1, 'counted once');
  assert.deepEqual(p.errors, []);
});

test('shop: pearl pack, starter pack once, spend on a shield and a single skin', async () => {
  const p = await nativePage();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__mc.go('shop'));
  await p.waitForSelector('#buy-pearls_l');
  await p.click('#buy-pearls_l');
  await p.waitForFunction(() => window.__mc.data.pearls === 1400);
  await p.waitForSelector('.buy-ok');   // نافذة نجاح واضحة
  assert.match(await p.textContent('.buy-ok'), /١٤٠٠|1400/);
  await p.click('#buyOkClose');
  assert.ok(await p.evaluate(() => window.__calls.some((c) => c[0] === 'consume')), 'pack consumed so it can be bought again');
  await p.click('#buy-starter_pack');
  await p.waitForFunction(() => window.__mc.data.pearls === 1900 && window.__mc.data.ent.noAds && window.__mc.data.ent.starter);
  await p.click('#buyOkClose');
  await p.waitForSelector('#buy-pearls_l');
  assert.equal(await p.locator('#buy-starter_pack').count(), 0, 'starter offer disappears after purchase');
  await p.click('#tabSpend');
  await p.click('#spend-shield');
  await p.waitForFunction(() => window.__mc.data.shields === 1);
  await p.click('#skin-ember');
  await p.waitForFunction(() => window.__mc.data.owned['skin:ember'] === true && window.__mc.data.cosmetics.skin === 'ember');
  assert.equal(await p.evaluate(() => window.__mc.data.pearls), 1900 - 60 - 250);
  assert.match(await p.textContent('#pearlBalance'), /1[,٬]?590|١٥٩٠|١٬٥٩٠/);
  assert.deepEqual(p.errors, []);
});

test('second chance with pearls when no ad is available', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { const d = window.__mc.data; d.settings.tutorialDone = true; d.pearls = 100; window.__mc.go('rainPlay', { kind: 'custom', args: { ops: ['add'], level: 'easy', speed: 'insane', end: 'lives', accel: false } }); });
  await p.waitForSelector('#revivePearls', { timeout: 60000 });
  assert.equal(await p.locator('#reviveYes').count(), 0);
  await p.click('#revivePearls');
  await p.waitForFunction(() => window.__mc.current.rain?.().state.lives === 1 && window.__mc.data.pearls === 70);
  assert.deepEqual(p.errors, []);
});
