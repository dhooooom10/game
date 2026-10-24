/* =========================================================================
   مشتريات Google Play — داخل تطبيق Android فقط (الإضافة الأصلية BillingPlugin.java).
   بلا خادم: Google Play نفسه يتحقق من الدفع، والجهاز يُقرّ بالمنتجات الدائمة
   ويستهلك حزم اللآلئ بعد منحها (وإلا تسترد Google المبلغ تلقائيًا بعد ٣ أيام).
   الاسترجاع: Google Play هو المرجع لملكية المنتجات الدائمة (يعمل بعد إعادة التثبيت).
   ========================================================================= */
import { nativePlugin } from './native.js';
import { PRODUCTS, PRODUCT_IDS, grantsFrom } from '../core/products.js';
import { grantPurchasePearls } from '../core/wallet.js';
import { isNativeApp } from '../config.js';

let plugin = null, catalog = null;

function getPlugin() {
  if (plugin) return plugin;
  const C = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!isNativeApp() || !C?.isPluginAvailable?.('Billing')) return null;
  plugin = nativePlugin('Billing');
  return plugin;
}
export const available = () => !!getPlugin();
export const resetCatalog = () => { catalog = null; };

/** يطبّق الصلاحيات على بيانات اللاعب (دمج: لا نسحب ما مُنح سابقًا إلا عبر الاسترجاع الصريح) */
export function applyEntitlements(app, ent, { replace = false } = {}) {
  const cur = app.data.ent || {};
  const next = replace ? { ...ent } : { noAds: cur.noAds || ent.noAds, skins: cur.skins || ent.skins, pro: cur.pro || ent.pro, starter: cur.starter || ent.starter };
  app.data.ent = next;
  app.save();
  return next;
}

/** المنتجات بأسعارها المحلية من Google Play */
export async function products() {
  const p = getPlugin();
  if (!p) return [];
  if (catalog) return catalog;
  const r = await p.getProducts({ ids: PRODUCT_IDS });
  const list = (r?.products || []).filter((x) => PRODUCTS[x.id]).map((x) => ({ ...x, ...PRODUCTS[x.id] }));
  // قائمة فارغة لا تُحفظ: نعيد المحاولة في المرة القادمة (اتصال، أو منتجات أُنشئت للتو في Play Console)
  if (list.length) catalog = list;
  return list;
}

/** شراء منتج. يعيد { ok, status, entitlements, pearls } */
export async function buy(app, productId) {
  const p = getPlugin();
  if (!p) return { ok: false, status: 'unavailable' };
  await products();
  const r = await p.purchase({ id: productId });
  if (r.status === 'owned') return { ok: true, status: 'owned', entitlements: await restore(app) };
  if (r.status !== 'ok') return { ok: false, status: r.status };
  const pur = r.purchase;
  if (pur.state !== 'purchased') return { ok: false, status: 'pending' };
  return finishPurchase(app, productId, pur);
}

/** يُنهي الشراء على الجهاز: استهلاك (حزم اللآلئ) أو إقرار (الدائمة)، ثم المنح مرة واحدة لكل رمز */
async function finishPurchase(app, productId, pur) {
  const prod = PRODUCTS[productId];
  try {
    if (prod.consumable) await getPlugin().consume({ token: pur.token });
    else if (!pur.acknowledged) await getPlugin().acknowledge({ token: pur.token });
  } catch { return { ok: false, status: 'error' }; } // يُعاد عند الاسترجاع التالي (Google تحتفظ بالشراء)
  const entitlements = prod.consumable ? (app.data.ent || {}) : applyEntitlements(app, grantsFrom([productId]));
  const pearls = grantPurchasePearls(app.data, productId, pur.token); app.save();
  return { ok: true, status: 'ok', entitlements, pearls };
}

/** استرجاع المشتريات (عند الإقلاع وبزر «استرجاع المشتريات») */
export async function restore(app) {
  const p = getPlugin();
  if (!p) return app.data.ent || {};
  const { purchases } = await p.queryPurchases();
  const owned = [];
  for (const pur of purchases) {
    if (pur.state !== 'purchased') continue;
    for (const id of pur.products) {
      if (!PRODUCTS[id]) continue;
      if (PRODUCTS[id].consumable) { await finishPurchase(app, id, pur).catch(() => {}); continue; } // حزمة لم تُستهلك بعد
      owned.push(id);
      if (!pur.acknowledged) await finishPurchase(app, id, pur).catch(() => {});
      else grantPurchasePearls(app.data, id, pur.token); // لآلئ عرض البداية/الحزمة الكاملة (مرة لكل رمز)
    }
  }
  // Google Play هو المرجع للمنتجات الدائمة (يلغي ما استُرد مبلغه)
  return applyEntitlements(app, grantsFrom(owned), { replace: true });
}
