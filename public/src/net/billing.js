/* =========================================================================
   مشتريات Google Play — داخل تطبيق Android فقط (الإضافة الأصلية BillingPlugin.java).
   التدفق: شراء ← الخادم يتحقق من Google ويُقرّ/يستهلك ← نطبّق الصلاحيات محليًا.
   إن لم يُضبط التحقق على الخادم (501): نُقرّ من الجهاز ونمنح المنتجات الدائمة محليًا،
   وتبقى تذكرة الموسم معطّلة (تحتاج الخادم).
   الاسترجاع: Google Play هو المرجع لملكية المنتجات الدائمة (يعمل بعد إعادة التثبيت).
   ========================================================================= */
import { PRODUCTS, PRODUCT_IDS, grantsFrom } from '../core/products.js';
import { isNativeApp } from '../config.js';
import { api, ensureIdentity, me } from './online.js';
import { track } from './analytics.js';

let plugin = null, catalog = null, serverBilling = null;

function getPlugin() {
  if (plugin) return plugin;
  const C = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!isNativeApp() || !C?.isPluginAvailable?.('Billing')) return null;
  plugin = C.registerPlugin('Billing');
  return plugin;
}
export const available = () => !!getPlugin();

/** يطبّق الصلاحيات على بيانات اللاعب (دمج: لا نسحب ما مُنح سابقًا إلا عبر الاسترجاع الصريح) */
export function applyEntitlements(app, ent, { replace = false } = {}) {
  const cur = app.data.ent || {};
  const next = replace ? { ...ent } : { noAds: cur.noAds || ent.noAds, skins: cur.skins || ent.skins, pro: cur.pro || ent.pro, season: ent.season !== undefined ? ent.season : cur.season || null };
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
  catalog = r.products.map((x) => ({ ...x, ...PRODUCTS[x.id] }));
  return catalog;
}

async function serverVerify(app, productId, token) {
  await ensureIdentity(app);
  const r = await api('POST', '/api/purchases/verify', { productId, token });
  serverBilling = true;
  return r.entitlements;
}

/** شراء منتج. يعيد { ok, status, entitlements } */
export async function buy(app, productId) {
  const p = getPlugin();
  if (!p) return { ok: false, status: 'unavailable' };
  await products();
  track('shop_open');
  let accountId = null;
  try { await ensureIdentity(app); accountId = me()?.id || null; } catch { /* بلا اتصال: نكمل */ }
  const r = await p.purchase({ id: productId, accountId });
  if (r.status === 'owned') return { ok: true, status: 'owned', entitlements: await restore(app) };
  if (r.status !== 'ok') return { ok: false, status: r.status };
  const pur = r.purchase;
  if (pur.state !== 'purchased') return { ok: false, status: 'pending' };
  return finishPurchase(app, productId, pur);
}

async function finishPurchase(app, productId, pur) {
  try {
    if (!(await checkServer())) throw Object.assign(new Error('billing_disabled'), { code: 'billing_disabled' });
    const ent = await serverVerify(app, productId, pur.token);
    track('purchase');
    return { ok: true, status: 'ok', entitlements: applyEntitlements(app, ent) };
  } catch (e) {
    if (e.code === 'billing_disabled' && !PRODUCTS[productId].consumable) {
      // الخادم لا يتحقق بعد: نُقرّ من الجهاز (وإلا تسترد Google المبلغ بعد ٣ أيام)
      if (!pur.acknowledged) await getPlugin().acknowledge({ token: pur.token }).catch(() => {});
      track('purchase');
      return { ok: true, status: 'ok', entitlements: applyEntitlements(app, grantsFrom([productId])) };
    }
    // سيُعاد التحقق عند الاسترجاع التالي (Google تحتفظ بالشراء)
    return { ok: false, status: e.code || 'error' };
  }
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
      if (PRODUCTS[id].consumable) { await finishPurchase(app, id, pur).catch(() => {}); continue; } // تذكرة لم تُستهلك بعد
      owned.push(id);
      if (!pur.acknowledged) await finishPurchase(app, id, pur).catch(() => {});
    }
  }
  // Google Play هو المرجع للمنتجات الدائمة (يلغي ما استُرد مبلغه)؛ التذكرة من الخادم
  let ent = { ...grantsFrom(owned), season: app.data.ent?.season || null };
  // تذكرة الموسم من الخادم (إن وُجدت هوية أونلاين)
  if (app.data.online?.token) {
    try { const r = await api('GET', '/api/me/entitlements'); serverBilling = r.billing; ent = { ...ent, season: r.entitlements.season }; } catch { /* بلا اتصال */ }
  }
  return applyEntitlements(app, ent, { replace: true });
}

/** تذكرة الموسم تحتاج تحقق الخادم: نعرضها فقط إن أكّد الخادم أنه مفعّل */
export async function checkServer() {
  if (serverBilling != null) return serverBilling;
  try { const c = await api('GET', '/api/config', null, { timeout: 5000 }); serverBilling = !!c.billing; } catch { /* بلا اتصال */ }
  return !!serverBilling;
}
export const seasonPassAvailable = () => serverBilling === true;
