import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProfileData, isUnlocked, COSMETICS } from '../../public/src/core/progression.js';
import { grantPurchasePearls, buyShield, buyBoost, buySkin, ownsSkin, applyBoost, grantAdPearls, freeAdLeft, spend, MAX_SHIELDS } from '../../public/src/core/wallet.js';
import { PRODUCTS, PEARL_PRICES, grantsFrom } from '../../public/src/core/products.js';

test('purchase pearls are granted once per token; starter grants no-ads + flag', () => {
  const d = newProfileData('en');
  assert.equal(grantPurchasePearls(d, 'pearls_l', 'tok1'), PRODUCTS.pearls_l.pearls);
  assert.equal(grantPurchasePearls(d, 'pearls_l', 'tok1'), 0, 'same token never twice');
  assert.equal(grantPurchasePearls(d, 'remove_ads', 'tok2'), 0, 'products without pearls');
  assert.equal(d.pearls, 1400);
  assert.deepEqual(grantsFrom(['starter_pack']), { noAds: true, skins: false, pro: false, starter: true });
});

test('spending: shield (max 3), boost doubles xp for 5 rounds, single skins unlock in the locker', () => {
  const d = newProfileData('en');
  assert.equal(buyShield(d), false, 'no pearls');
  d.pearls = 1000;
  for (let i = 0; i < MAX_SHIELDS; i++) assert.equal(buyShield(d), true);
  assert.equal(buyShield(d), false, 'max shields');
  assert.equal(d.pearls, 1000 - MAX_SHIELDS * PEARL_PRICES.shield);
  assert.equal(buyBoost(d), true);
  d.xp = 0;
  for (let i = 0; i < 5; i++) assert.equal(applyBoost(d, 40), 40);
  assert.equal(applyBoost(d, 40), 0, 'boost used up');
  assert.equal(d.xp, 200);
  const ember = COSMETICS.skin.find((x) => x.id === 'ember');
  assert.equal(isUnlocked(d, ember, 'skin'), false);
  assert.equal(buySkin(d, 'ember'), true);
  assert.equal(ownsSkin(d, 'ember'), true);
  assert.equal(isUnlocked(d, ember, 'skin'), true);
  assert.equal(buySkin(d, 'ember'), false, 'already owned');
  assert.equal(buySkin(d, 'season'), false, 'season skin is not for sale');
  assert.equal(spend(d, 999999), false);
});

test('free pearls by rewarded ad: 3 per day', () => {
  const d = newProfileData('en');
  for (let i = 0; i < 3; i++) assert.ok(grantAdPearls(d, '2026-01-01') > 0);
  assert.equal(grantAdPearls(d, '2026-01-01'), 0);
  assert.equal(freeAdLeft(d, '2026-01-02'), 3);
});
