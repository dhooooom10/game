/* الربح: المتجر وGoogle Play Billing والإعلانات بإضافات أصلية مزيّفة (محاكاة تطبيق Android) */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen } from './helpers.js';

let S, browser;
before(async () => { S = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

async function nativePage({ owned = [] } = {}) {
  const p = await newPage(browser);
  await p.addInitScript((owned0) => {
    window.__calls = [];
    const owned = new Set(owned0);
    const billing = {
      getProducts: async ({ ids }) => ({ products: ids.map((id) => ({ id, title: id, description: '', price: id === 'pro_bundle' ? 'SAR 14.99' : 'SAR 4.99' })) }),
      purchase: async ({ id }) => { window.__calls.push(['buy', id]); owned.add(id); return { status: 'ok', purchase: { token: 'tok-' + id + '-123456', products: [id], state: 'purchased', acknowledged: false } }; },
      queryPurchases: async () => ({ purchases: [...owned].map((id) => ({ token: 'tok-' + id + '-123456', products: [id], state: 'purchased', acknowledged: true })) }),
      acknowledge: async ({ token }) => { window.__calls.push(['ack', token]); },
      consume: async () => {},
    };
    const admob = {
      initialize: async (o) => { window.__calls.push(['init', o.maxAdContentRating]); },
      requestConsentInfo: async () => ({ status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' }),
      showConsentForm: async () => ({ status: 'OBTAINED', canRequestAds: true }),
      prepareRewardVideoAd: async () => ({}), prepareInterstitial: async () => ({}),
      showRewardVideoAd: async () => { window.__calls.push(['rewarded']); return { type: 'reward', amount: 1 }; },
      showInterstitial: async () => { window.__calls.push(['interstitial']); },
      showPrivacyOptionsForm: async () => {},
    };
    const plugins = { Billing: billing, AdMob: admob };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n in plugins, registerPlugin: (n) => plugins[n] };
  }, owned);
  return p;
}

test('web: shop invites to the Android app, no ads', async () => {
  const p = await newPage(browser);
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__mc.go('shop'));
  await waitScreen(p, 'shop');
  await p.waitForSelector('text=المتجر في تطبيق Android');
  assert.deepEqual(p.errors, []);
});

test('app: buy remove ads + skins (server verification off → device acknowledges), premium skin unlocks, restore', async () => {
  const p = await nativePage();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__mc.go('shop'));
  await p.waitForSelector('#buy-remove_ads');
  assert.match(await p.locator('#buy-pro_bundle').innerText(), /14\.99/);
  assert.equal(await p.locator('#buy-season_pass').count(), 0, 'season pass hidden without server billing');
  await p.click('#buy-remove_ads');
  await p.waitForFunction(() => window.__mc.data.ent?.noAds === true);
  await p.click('#buyOkClose');
  await p.waitForSelector('#buy-remove_ads[disabled]');
  await p.click('#buy-skins_pack');
  await p.waitForFunction(() => window.__mc.data.ent?.skins === true);
  await p.click('#buyOkClose');
  const calls = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'ack').length);
  assert.equal(calls, 2, 'each non-consumable acknowledged');
  // المظهر المميز صار متاحًا في الخزانة
  const unlocked = await p.evaluate(async () => { const m = await import('/src/core/progression.js'); return m.isUnlocked(window.__mc.data, { need: { ent: 'skins' } }); });
  assert.equal(unlocked, true);
  // جهاز جديد: الاسترجاع من Google Play
  const q = await nativePage({ owned: ['pro_bundle'] });
  await q.goto(S.url + '?e2e=1');
  await waitScreen(q, 'home');
  await q.waitForFunction(() => window.__mc.data.ent?.pro === true && window.__mc.data.ent?.noAds === true, null, { timeout: 8000 });
  assert.deepEqual(p.errors, []);
  assert.deepEqual(q.errors, []);
});

test('app: rewarded second chance in survival, double XP, interstitial respects caps and remove-ads', async () => {
  const p = await nativePage();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.go('rainPlay', { kind: 'custom', args: { mode: 'survival', diff: 'hard' } }); });
  // لا نجيب: تنفد القلوب فيظهر عرض الفرصة الثانية
  await p.waitForSelector('#reviveYes', { timeout: 90000 });
  await p.click('#reviveYes');
  await p.waitForFunction(() => window.__mc.current.rain().state.lives === 1 && !window.__mc.current.rain().state.over);
  // بعد الخسارة الثانية: لا عرض آخر، تذهب للنتائج
  await waitScreen(p, 'results', 90000);
  assert.equal(await p.locator('#challengeFriend').count(), 0, 'revived runs cannot become challenges');
  await p.click('#doubleXp');
  await p.waitForSelector('text=تمت المضاعفة');
  const rewarded = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'rewarded').length);
  assert.equal(rewarded, 2);
  // الإعلان البيني: لا يظهر للاعب جديد (أقل من ٤ جولات)
  await p.evaluate(() => window.__mc.go('home', {}, { root: true }));
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.__calls.filter((c) => c[0] === 'interstitial').length), 0);
  assert.deepEqual(p.errors, []);
});

test('app: real Play price formats (Arabic RLM riyal, long rupiah) show after skeletons, isolated and inside their cards', async () => {
  for (const [lang, prices] of [['ar', { xl: '‏٧٤٫٩٩ ر.س.‏', s: '‏٣٫٩٩ ر.س.‏' }], ['id', { xl: 'Rp 1.249.000,00', s: 'Rp 15.000,00' }]]) {
    const p = await newPage(browser, { width: 320, height: 760 });
    await p.addInitScript((pr) => {
      const billing = {
        getProducts: ({ ids }) => new Promise((r) => setTimeout(() => r({ products: ids.map((id) => ({ id, title: id, description: '', price: id === 'pearls_xl' ? pr.xl : pr.s })) }), 800)),
        queryPurchases: async () => ({ purchases: [] }), purchase: async () => ({ status: 'cancelled' }), acknowledge: async () => {}, consume: async () => {},
      };
      window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n === 'Billing', registerPlugin: () => billing };
    }, prices);
    await p.goto(S.url + '?e2e=1');
    await waitScreen(p, 'home');
    await p.evaluate((l) => { window.__mc.data.settings.lang = l; window.__mc.save(); }, lang);
    await p.reload();
    await waitScreen(p, 'home');
    await p.evaluate(() => window.__mc.go('shop'));
    await p.waitForSelector('.pk-p.skel');
    assert.equal(await p.locator('#packs').evaluate((e) => e.closest('[aria-busy]').getAttribute('aria-busy')), 'true');
    await p.waitForSelector('#buy-pearls_xl:not([disabled])');
    assert.equal(await p.locator('#buy-pearls_xl .pk-p bdi').innerText(), prices.xl.replace(/‏/g, '‏'));
    const spill = await p.evaluate(() => [...document.querySelectorAll('.pk-p, [data-buy].btn')].filter((e) => {
      const r = e.getBoundingClientRect(), c = e.closest('.pack, .card, .starter-card, .shop-item').getBoundingClientRect();
      return r.left < c.left - 1 || r.right > c.right + 1;
    }).length);
    assert.equal(spill, 0, `prices stay inside their cards (${lang})`);
    assert.deepEqual(p.errors, []);
    await p.close();
  }
});
