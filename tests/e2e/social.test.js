/* إعادة الصياغة: الأونلاين في الواجهة، تحدّي الأصدقاء (قائمة، تحدٍّ مخصص يُرسل تلقائيًا، صندوق التحديات)،
   متجر اللآلئ 💎 (حزم، عرض البداية، الإنفاق)، والفرصة الثانية باللآلئ */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, newPage, waitScreen } from './helpers.js';
import { startServer } from '../../server/index.js';

let S, browser;
before(async () => { S = await startServer({ registerLimit: 1000 }); browser = await launch(); });
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

test('home: online card sits right under Play, highlighted online tab, time/survival removed', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '/?e2e=1');
  await waitScreen(p, 'home');
  await p.waitForSelector('.online-hero #homeQuick');
  const order = await p.evaluate(() => { const secs = [...document.querySelectorAll('main > section')]; return [secs.findIndex((x) => x.classList.contains('hero')), secs.findIndex((x) => x.classList.contains('online-hero'))]; });
  assert.equal(order[1], order[0] + 1, 'online directly after the hero');
  await p.waitForSelector('#nav button.nav-hero[data-nav="online"]');
  assert.equal(await p.locator('#modeTime').count(), 0);
  assert.equal(await p.locator('#modeSurvival').count(), 0);
  await p.click('#homeFriends');
  await waitScreen(p, 'friendsHub');
  assert.deepEqual(p.errors, []);
});

test('friends: add by code, send a custom challenge (same fields as your challenge), friend sees it in the inbox', async () => {
  const A = await newPage(browser), B = await newPage(browser);
  for (const P of [A, B]) { await P.goto(S.url + '/?e2e=1'); await waitScreen(P, 'home'); await P.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.go('friendsHub'); }); await P.waitForSelector('#myCode'); }
  const codeA = (await A.textContent('#myCode')).trim();
  await B.fill('.fh-add input', codeA);
  await B.click('#addFriend');
  await B.waitForSelector('[data-challenge]');
  await B.click('[data-challenge]');
  await waitScreen(B, 'friendChallenge');
  await B.waitForSelector('#rangeHint');
  await B.click('text=جنونية');
  await B.click('text=3 قلوب').catch(() => B.click('text=٣ قلوب'));
  await B.click('#startFriendChallenge');
  await waitScreen(B, 'rainPlay');
  assert.equal(await B.evaluate(() => window.__mc.current.rain().cfg.lives), 3);
  // نصيب ٣ قطرات ثم نترك الباقي يسقط حتى تنتهي القلوب
  for (let i = 0; i < 60; i++) {
    const n = await B.evaluate(() => {
      const R = window.__mc.current.rain(); const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
      if (d && R.state.popped < 3) { for (const ch of String(d.q.answer)) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }
      return R.state.popped;
    });
    if (n >= 3) break;
    await B.waitForTimeout(250);
  }
  await waitScreen(B, 'results', 60000);
  assert.equal(await B.locator('#reviveYes, #revivePearls').count(), 0, 'no second chance in friend challenges');
  await B.waitForSelector('#sendStatus.ok', { timeout: 10000 });
  // الصديق A يرى التحدي في صندوقه
  await A.evaluate(() => window.__mc.go('friendsHub', {}, { replace: true }));
  await A.waitForSelector('[data-ch]', { timeout: 10000 });
  await A.waitForSelector('.race-row');
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
});

test('shop: pearl pack, starter pack once, spend on a shield and a single skin', async () => {
  const p = await nativePage();
  await p.goto(S.url + '/?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__mc.go('shop'));
  await p.waitForSelector('#buy-pearls_l');
  await p.click('#buy-pearls_l');
  await p.waitForFunction(() => window.__mc.data.pearls === 1400);
  assert.ok(await p.evaluate(() => window.__calls.some((c) => c[0] === 'consume')), 'pack consumed so it can be bought again');
  await p.click('#buy-starter_pack');
  await p.waitForFunction(() => window.__mc.data.pearls === 1900 && window.__mc.data.ent.noAds && window.__mc.data.ent.starter);
  await p.waitForSelector('#buy-pearls_l');
  assert.equal(await p.locator('#buy-starter_pack').count(), 0, 'starter offer disappears after purchase');
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
  await p.goto(S.url + '/?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { const d = window.__mc.data; d.settings.tutorialDone = true; d.pearls = 100; window.__mc.go('rainPlay', { kind: 'custom', args: { ops: ['add'], level: 'easy', speed: 'insane', end: 'lives', accel: false } }); });
  await p.waitForSelector('#revivePearls', { timeout: 60000 });
  assert.equal(await p.locator('#reviveYes').count(), 0);
  await p.click('#revivePearls');
  await p.waitForFunction(() => window.__mc.current.rain?.().state.lives === 1 && window.__mc.data.pearls === 70);
  assert.deepEqual(p.errors, []);
});
