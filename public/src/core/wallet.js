/* =========================================================================
   محفظة اللآلئ 💎 — عملة التطبيق الناعمة. تُكسب باللعب (مهام، ٣ نجوم، إعلان
   اختياري) أو بالشراء، وتُنفق على الراحة والزينة فقط: درع سلسلة، فرصة ثانية،
   مضاعفة الخبرة، مظاهر مفردة. لا تشتري نقاطًا ولا ترتيبًا.
   ========================================================================= */
import { PRODUCTS, PEARL_PRICES, PEARL_SKINS, BOOST_ROUNDS, FREE_PEARLS_AD, FREE_PEARLS_AD_PER_DAY } from './products.js';
import { todayStr } from './progression.js';

export const MAX_SHIELDS = 3;
export const pearls = (d) => d.pearls || 0;
export function addPearls(d, n) { d.pearls = Math.max(0, (d.pearls || 0) + Math.round(n)); return d.pearls; }
export function spend(d, n) { if ((d.pearls || 0) < n) return false; d.pearls -= n; return true; }

/** يمنح لآلئ منتج مشترى مرة واحدة لكل رمز شراء (حتى لو تكرر التحقق أو الاسترجاع) */
export function grantPurchasePearls(d, productId, token) {
  const n = PRODUCTS[productId]?.pearls || 0;
  if (!n || !token) return 0;
  d.pearlTokens = Array.isArray(d.pearlTokens) ? d.pearlTokens : [];
  if (d.pearlTokens.includes(token)) return 0;
  d.pearlTokens.push(token);
  if (d.pearlTokens.length > 300) d.pearlTokens.splice(0, d.pearlTokens.length - 300);
  addPearls(d, n);
  return n;
}

export function buyShield(d) {
  if ((d.shields || 0) >= MAX_SHIELDS || !spend(d, PEARL_PRICES.shield)) return false;
  d.shields = (d.shields || 0) + 1; return true;
}
export function buyBoost(d) {
  if (!spend(d, PEARL_PRICES.boost)) return false;
  d.boost = { ...(d.boost || {}), xp2: (d.boost?.xp2 || 0) + BOOST_ROUNDS }; return true;
}
export const ownsSkin = (d, id) => !!d.ent?.skins || !!d.owned?.['skin:' + id];
export function buySkin(d, id) {
  if (!PEARL_SKINS.includes(id) || ownsSkin(d, id) || !spend(d, PEARL_PRICES.skin)) return false;
  d.owned = { ...(d.owned || {}), ['skin:' + id]: true }; return true;
}
/** مضاعفة الخبرة: تُستهلك جولة من الرصيد وتعيد الخبرة الإضافية */
export function applyBoost(d, xp) {
  if (!(d.boost?.xp2 > 0) || !(xp > 0)) return 0;
  d.boost.xp2--; d.xp += xp; return xp;
}
/** لآلئ مجانية بإعلان بمكافأة (٣ مرات يوميًا) */
export function freeAdLeft(d, date = todayStr()) { return d.adPearls?.date === date ? Math.max(0, FREE_PEARLS_AD_PER_DAY - d.adPearls.n) : FREE_PEARLS_AD_PER_DAY; }
export function grantAdPearls(d, date = todayStr()) {
  if (!freeAdLeft(d, date)) return 0;
  d.adPearls = d.adPearls?.date === date ? { date, n: d.adPearls.n + 1 } : { date, n: 1 };
  addPearls(d, FREE_PEARLS_AD); return FREE_PEARLS_AD;
}
