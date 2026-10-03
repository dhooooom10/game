/* =========================================================================
   المتجر: مشتريات اختيارية (زينة وراحة فقط — لا أفضلية في المنافسة).
   الأسعار تأتي من Google Play بعملة اللاعب. في المتصفح: دعوة لتطبيق Android.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, clear } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx } from '../ui/audio.js';
import { toast, confetti } from '../ui/fx.js';
import { t } from '../i18n.js';
import { topbar } from './setup.js';
import { PRODUCTS } from '../core/products.js';
import * as billing from '../net/billing.js';
import { track } from '../net/analytics.js';
import { PLAY_URL } from '../config.js';

const owns = (ent, id) => {
  if (id === 'season_pass') return !!ent.season;
  return (PRODUCTS[id].grants || []).every((g) => ent[g]);
};

registerScreen('shop', (app) => {
  const el = h('main', topbar(t('shop.title'), t('shop.sub')));
  const box = h('div'); el.append(box);
  track('shop_open');

  // معاينة المظاهر المميزة
  const preview = h('section.card.shop-preview', h('div.faint', t('shop.previewTitle')),
    h('div.shop-skins', ...['ember', 'lime', 'glacier', 'neon', 'season'].map((sk) => h('span', { html: mascotSVG({ skin: sk, acc: sk === 'season' ? 'star' : sk === 'neon' ? 'halo' : 'none', size: 46, label: t('skin.' + sk) }) }))));

  const paint = async () => {
    clear(box).append(preview);
    if (!billing.available()) {
      box.append(h('section.card', h('h2', t('shop.appOnly')), h('p.note', t('shop.appOnlyBody')),
        h('a.btn.primary.block', { href: PLAY_URL, target: '_blank', rel: 'noopener' }, '▶ ', t('share.getApp'))));
      return;
    }
    box.append(h('div.loading', h('span.spinner'), t('net.loading')));
    let list;
    try { [list] = await Promise.all([billing.products(), billing.checkServer()]); }
    catch { clear(box).append(preview, h('p.note', t('shop.unavailable'))); return; }
    const ent = app.data.ent || {};
    clear(box).append(preview);
    const order = ['pro_bundle', 'remove_ads', 'skins_pack', 'season_pass'];
    for (const id of order) {
      const p = list.find((x) => x.id === id);
      if (!p) continue;
      if (id === 'season_pass' && !billing.seasonPassAvailable()) continue;
      const owned = owns(ent, id);
      const btn = h('button.btn' + (p.best ? '.gold' : '.primary'), { id: 'buy-' + id, disabled: owned, on: { click: async () => {
        sfx.tap(); btn.disabled = true;
        try {
          const r = await billing.buy(app, id);
          if (r.ok) { sfx.fanfare(); confetti({ count: 80 }); toast(t('shop.thanks')); }
          else if (r.status === 'pending') toast(t('shop.pending'));
          else if (r.status !== 'cancelled') toast(t('shop.failed'));
        } catch { toast(t('shop.failed')); }
        paint();
      } } }, owned ? t('shop.owned') : p.price);
      box.append(h('section.card.shop-item' + (p.best ? '.best' : ''),
        p.best ? h('span.shop-tag', t('shop.best')) : null,
        h('div.shop-ic', PRODUCTS[id].icon),
        h('div.grow', h('div.t', t('shop.p.' + id)), h('div.d', t('shop.p.' + id + 'D'))),
        btn));
    }
    box.append(h('button.btn.block.ghost', { id: 'restoreBtn', on: { click: async () => {
      sfx.tap();
      try { await billing.restore(app); toast(t('shop.restored')); paint(); } catch { toast(t('shop.failed')); }
    } } }, icon('refresh'), t('shop.restore')));
    box.append(h('p.note', t('shop.fair')));
  };
  paint();
  return { el };
});
