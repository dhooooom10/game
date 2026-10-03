/* =========================================================================
   منتجات المتجر (مشتريات Google Play داخل التطبيق). المعرّفات يجب أن تطابق
   ما تنشئه في Play Console ← Monetize ← Products ← In-app products.
   كلها زينة أو راحة — لا شيء يمنح أفضلية في المنافسة أو لوحات الصدارة.
   ========================================================================= */
export const PRODUCTS = {
  remove_ads: { icon: '🚫', grants: ['noAds'], consumable: false },
  skins_pack: { icon: '🎨', grants: ['skins'], consumable: false },
  pro_bundle: { icon: '👑', grants: ['noAds', 'skins', 'pro'], consumable: false, best: true },
  // تذكرة الموسم: تُشترى مرة لكل موسم (منتج قابل للاستهلاك يستهلكه الخادم بعد تسجيل الموسم)
  season_pass: { icon: '✦', grants: ['season'], consumable: true, needsServer: true },
};
export const PRODUCT_IDS = Object.keys(PRODUCTS);

/** يجمع الصلاحيات من قائمة منتجات مملوكة */
export function grantsFrom(productIds) {
  const g = { noAds: false, skins: false, pro: false };
  for (const id of productIds) for (const k of PRODUCTS[id]?.grants || []) if (k in g) g[k] = true;
  return g;
}
