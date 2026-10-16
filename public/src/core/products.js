/* =========================================================================
   منتجات المتجر (مشتريات Google Play داخل التطبيق). المعرّفات يجب أن تطابق
   ما تنشئه في Play Console ← Monetize ← Products ← In-app products.
   كلها زينة أو راحة — لا شيء يمنح أفضلية في المنافسة أو لوحات الصدارة.
   pearls: عدد اللآلئ 💎 التي يمنحها المنتج (تُمنح مرة واحدة لكل عملية شراء).
   ========================================================================= */
export const PRODUCTS = {
  // عرض البداية: مرة واحدة فقط لكل حساب — بلا إعلانات + ٥٠٠ لؤلؤة (أفضل قيمة)
  starter_pack: { icon: '🎁', grants: ['noAds', 'starter'], pearls: 500, consumable: false, starter: true },
  // حزم اللآلئ (قابلة للتكرار)
  pearls_s: { icon: '💎', pearls: 120, consumable: true },
  pearls_m: { icon: '💎', pearls: 650, consumable: true, bonus: 8 },
  pearls_l: { icon: '💎', pearls: 1400, consumable: true, bonus: 17, popular: true },
  pearls_xl: { icon: '💎', pearls: 3000, consumable: true, bonus: 25 },
  // الدائمة
  remove_ads: { icon: '🚫', grants: ['noAds'], consumable: false },
  skins_pack: { icon: '🎨', grants: ['skins'], consumable: false },
  pro_bundle: { icon: '👑', grants: ['noAds', 'skins', 'pro'], pearls: 300, consumable: false, best: true },
  // تذكرة الموسم: تُشترى مرة لكل موسم (منتج قابل للاستهلاك يستهلكه الخادم بعد تسجيل الموسم)
  season_pass: { icon: '✦', grants: ['season'], consumable: true, needsServer: true },
};
export const PRODUCT_IDS = Object.keys(PRODUCTS);
export const PEARL_PACKS = ['pearls_s', 'pearls_m', 'pearls_l', 'pearls_xl'];

/** يجمع الصلاحيات من قائمة منتجات مملوكة */
export function grantsFrom(productIds) {
  const g = { noAds: false, skins: false, pro: false, starter: false };
  for (const id of productIds) for (const k of PRODUCTS[id]?.grants || []) if (k in g) g[k] = true;
  return g;
}

/* ---------------- ما يُشترى باللآلئ ---------------- */
export const PEARL_PRICES = { shield: 60, revive: 30, boost: 100, skin: 250 };
export const PEARL_SKINS = ['ember', 'lime', 'glacier', 'neon'];
export const BOOST_ROUNDS = 5;              // مضاعفة الخبرة لخمس جولات
export const FREE_PEARLS_AD = 15, FREE_PEARLS_AD_PER_DAY = 3;
