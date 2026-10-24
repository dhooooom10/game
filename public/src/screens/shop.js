/* =========================================================================
   المتجر: محفظة اللآلئ 💎 + ما يُشترى بها + مشتريات Google Play.
   كلها زينة أو راحة — لا شيء يمنح أفضلية في المنافسة أو لوحات الصدارة.
   الأسعار تأتي من Google Play بعملة اللاعب. في المتصفح: دعوة لتطبيق Android.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, clear, num } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx } from '../ui/audio.js';
import { toast, confetti } from '../ui/fx.js';
import { t } from '../i18n.js';
import { topbar } from './setup.js';
import { PRODUCTS, PEARL_PACKS, PEARL_PRICES, PEARL_SKINS, BOOST_ROUNDS, FREE_PEARLS_AD } from '../core/products.js';
import { pearls, buyShield, buyBoost, buySkin, ownsSkin, freeAdLeft, grantAdPearls, MAX_SHIELDS } from '../core/wallet.js';
import * as billing from '../net/billing.js';
import * as ads from '../net/ads.js';
import { PLAY_URL } from '../config.js';

const owns = (ent, id) => {
  if (PRODUCTS[id].consumable) return false;
  return (PRODUCTS[id].grants || []).every((g) => ent[g]);
};
const pearlTxt = (n) => '⁦' + num(n) + ' 💎⁩';

registerScreen('shop', (app) => {
  const data = app.data;
  const balance = h('b', { id: 'pearlBalance' }, num(pearls(data)));
  const el = h('main', topbar(t('shop.title'), t('shop.sub')));
  const wallet = h('section.card.wallet', h('div.w-main', h('span.w-ic', '💎'), h('div.grow', h('div.faint', t('wal.balance')), balance)));
  const box = h('div');
  // تبويبان فقط: «اشترِ» (Google Play) و«استخدم لآلئك»
  let tab = 'buy';
  const tabBtn = (id, v, label) => h('button', { id, type: 'button', role: 'tab', 'aria-selected': String(tab === v), on: { click: () => { sfx.tap(); tab = v; paintTabs(); paint(); } } }, label);
  const tabs = h('div.shop-tabs', { role: 'tablist' }, tabBtn('tabBuy', 'buy', '🛍️ ' + t('shop.tabBuy')), tabBtn('tabSpend', 'spend', '💎 ' + t('shop.tabSpend')));
  const paintTabs = () => { for (const b of tabs.children) b.setAttribute('aria-selected', String(b.id === (tab === 'buy' ? 'tabBuy' : 'tabSpend'))); };
  el.append(wallet, tabs, box);
  let busy = false;   // شراء واحد في كل مرة (لا ضغط مزدوج = لا شراء مزدوج)
  const refreshBalance = () => { balance.textContent = num(pearls(data)); replayPop(balance); };
  const replayPop = (n) => { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); };

  // لآلئ مجانية بإعلان اختياري (٣ يوميًا)
  const freeBtn = h('button.btn.sm.gold', { id: 'freePearls', type: 'button', on: { click: async () => {
    freeBtn.disabled = true;
    if (await ads.showRewarded()) { grantAdPearls(data); app.save(); sfx.reward(); refreshBalance(); toast(t('wal.gotFree', { n: num(FREE_PEARLS_AD) })); }
    paintFree();
  } } });
  const paintFree = () => {
    const left = freeAdLeft(data);
    freeBtn.hidden = !(left > 0 && ads.rewardedReady());
    freeBtn.disabled = false;
    clear(freeBtn).append('🎬 ', t('wal.free', { n: num(FREE_PEARLS_AD), left: num(left) }));
  };
  wallet.append(freeBtn); paintFree();

  /* ---------- ما يُشترى باللآلئ ---------- */
  function spendSection() {
    const item = (id, ic, title, desc, price, can, doBuy, done = false) => {
      const b = h('button.btn.sm' + (done ? '' : '.primary'), { id: 'spend-' + id, type: 'button', disabled: done, on: { click: () => {
        if (pearls(data) < price) { sfx.wrong(); toast(t('wal.notEnough')); tab = 'buy'; paintTabs(); return paint(); }
        if (!can()) { sfx.wrong(); return toast(t('wal.cannot')); }
        if (doBuy()) { app.save(); sfx.reward(); refreshBalance(); toast(t('wal.bought')); paint(); }
      } } }, done ? t('shop.owned') : pearlTxt(price));
      return h('div.spend-item', h('span.si-ic', ic), h('div.grow', h('div.t', title), h('div.d', desc)), b);
    };
    const sec = h('section.section', h('h2.section-title', '💎 ', t('wal.spendTitle')));
    sec.append(
      item('shield', '🛡️', t('shield.title'), t('wal.shieldD', { n: num(data.shields || 0), m: num(MAX_SHIELDS) }), PEARL_PRICES.shield, () => (data.shields || 0) < MAX_SHIELDS, () => buyShield(data)),
      item('boost', '🚀', t('wal.boost'), t('wal.boostD', { n: num(BOOST_ROUNDS), left: num(data.boost?.xp2 || 0) }), PEARL_PRICES.boost, () => true, () => buyBoost(data)),
      // الفرصة الثانية تُشترى أثناء اللعب (عند نفاد القلوب)
      h('div.spend-item', h('span.si-ic', '💧'), h('div.grow', h('div.t', t('wal.revive')), h('div.d', t('wal.reviveD'))), h('span.chip', pearlTxt(PEARL_PRICES.revive))));
    const skins = h('div.skin-buy');
    for (const sk of PEARL_SKINS) {
      const owned = ownsSkin(data, sk);
      skins.append(h('button.sk-card' + (owned ? '.owned' : ''), { id: 'skin-' + sk, type: 'button', on: { click: () => {
        if (owned) { data.cosmetics.skin = sk; app.save(); sfx.tap(); return toast(t('lock.equipped')); }
        if (pearls(data) < PEARL_PRICES.skin) { sfx.wrong(); return toast(t('wal.notEnough')); }
        if (buySkin(data, sk)) { data.cosmetics.skin = sk; app.save(); sfx.fanfare(); confetti({ count: 40 }); refreshBalance(); paint(); }
      } } }, h('span', { html: mascotSVG({ skin: sk, size: 50, label: t('skin.' + sk) }) }), h('span.sk-n', t('skin.' + sk)), h('span.sk-p', owned ? '✓' : pearlTxt(PEARL_PRICES.skin))));
    }
    sec.append(h('div.label', { style: { marginTop: '10px' } }, t('wal.skins')), skins);
    return sec;
  }

  /* ---------- مشتريات Google Play ---------- */
  async function buyFlow(id, btn) {
    if (busy) return;
    busy = true; sfx.tap();
    for (const b of box.querySelectorAll('[data-buy]')) b.disabled = true;
    const label = btn.innerHTML;
    btn.classList.add('buying'); btn.replaceChildren(h('span.spinner'), ' ', t('shop.buying'));
    let r = null;
    try { r = await billing.buy(app, id); } catch { r = { ok: false, status: 'error' }; }
    busy = false;
    if (r.ok) { refreshBalance(); celebrate(id, r); }
    else {
      btn.innerHTML = label; btn.classList.remove('buying');
      if (r.status === 'pending') toast(t('shop.pending'));
      else if (r.status !== 'cancelled') toast(t('shop.failed'));
    }
    paint();
  }
  /** نافذة نجاح واضحة: ماذا حصلت ورصيدك الجديد */
  function celebrate(id, r) {
    sfx.fanfare(); confetti({ count: 90 });
    const pr = PRODUCTS[id];
    app.modal((m, close) => {
      m.classList.add('buy-ok');
      m.append(h('div.bo-ic', pr.icon || '🎉'), h('h2', t('shop.successTitle')),
        r.pearls ? h('div.bo-pearls', '\u2066+' + num(r.pearls) + ' 💎\u2069') : null,
        h('p.note', r.pearls && pr.consumable ? t('wal.gotPack', { n: num(r.pearls) }) : t('shop.p.' + id)),
        h('p.faint', t('wal.balance'), ': ', h('b', num(pearls(data)), ' 💎')),
        h('button.btn.gold.block.lg', { 'data-autofocus': true, id: 'buyOkClose', on: { click: () => close() } }, t('shop.great')));
    });
  }

  const paint = async () => {
    clear(box);
    if (tab === 'spend') { box.append(spendSection()); return; }
    if (!billing.available()) {
      box.append(h('section.card.section', h('h2', t('shop.appOnly')), h('p.note', t('shop.appOnlyBody')),
        h('a.btn.primary.block', { href: PLAY_URL, target: '_blank', rel: 'noopener' }, '▶ ', t('share.getApp'))));
      return;
    }
    const loading = h('div.loading', h('span.spinner'), t('net.loading'));
    box.append(loading);
    let list;
    try { list = await billing.products(); }
    catch { loading.replaceWith(h('p.note', t('shop.unavailable'))); return; }
    loading.remove();
    const ent = data.ent || {};
    const P = (id) => list.find((x) => x.id === id);

    // عرض البداية (مرة واحدة)
    const st = P('starter_pack');
    if (st && !ent.starter) {
      const b = h('button.btn.gold.lg', { id: 'buy-starter_pack', type: 'button', 'data-buy': '1', on: { click: () => buyFlow('starter_pack', b) } }, st.price);
      box.append(h('section.starter-card.section', h('span.shop-tag', t('shop.once')),
        h('div.st-ic', '🎁'), h('div.grow', h('div.t', t('shop.p.starter_pack')), h('div.d', t('shop.p.starter_packD', { n: num(PRODUCTS.starter_pack.pearls) }))), b));
    }

    // حزم اللآلئ
    const grid = h('div.packs', { id: 'packs' });
    for (const id of PEARL_PACKS) {
      const p = P(id); if (!p) continue;
      const pr = PRODUCTS[id];
      const b = h('button.pack' + (pr.popular ? '.popular' : ''), { id: 'buy-' + id, type: 'button', 'data-buy': '1', on: { click: () => buyFlow(id, b) } },
        pr.popular ? h('span.pk-tag', t('shop.popular')) : pr.bonus ? h('span.pk-tag.bonus', t('shop.bonus', { n: num(pr.bonus) })) : null,
        h('span.pk-ic', id === 'pearls_xl' ? '💰' : id === 'pearls_l' ? '💎💎' : '💎'),
        h('span.pk-n', num(pr.pearls)), h('span.pk-u', t('wal.pearls')), h('span.pk-p', p.price));
      grid.append(b);
    }
    if (grid.children.length) box.append(h('section.section', h('h2.section-title', '🛍️ ', t('wal.buyPearls')), grid));

    // الدائمة وتذكرة الموسم
    const sec = h('section.section', h('h2.section-title', '⭐ ', t('shop.permanent')));
    for (const id of ['pro_bundle', 'remove_ads', 'skins_pack']) {
      const p = P(id); if (!p) continue;
      const owned = owns(ent, id);
      const btn = h('button.btn' + (p.best ? '.gold' : '.primary'), { id: 'buy-' + id, type: 'button', 'data-buy': '1', disabled: owned, on: { click: () => buyFlow(id, btn) } }, owned ? t('shop.owned') : p.price);
      sec.append(h('section.card.shop-item' + (p.best ? '.best' : ''),
        p.best ? h('span.shop-tag', t('shop.best')) : null,
        h('div.shop-ic', PRODUCTS[id].icon),
        h('div.grow', h('div.t', t('shop.p.' + id)), h('div.d', t('shop.p.' + id + 'D'), PRODUCTS[id].pearls ? ' · ' : '', PRODUCTS[id].pearls ? h('b', '\u2066+' + num(PRODUCTS[id].pearls) + ' 💎\u2069') : null)),
        btn));
    }
    box.append(sec);
    box.append(h('button.btn.block.ghost', { id: 'restoreBtn', type: 'button', on: { click: async () => {
      sfx.tap();
      try { await billing.restore(app); toast(t('shop.restored')); refreshBalance(); paint(); } catch { toast(t('shop.failed')); }
    } } }, icon('refresh'), t('shop.restore')));
    box.append(h('p.note', t('shop.fair')));
  };
  paint();
  return { el, nav: 'shop' };
});
