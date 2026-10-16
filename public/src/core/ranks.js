/* =========================================================================
   الرتب التنافسية (مشتركة بين الجهاز والخادم): تُحسب من تصنيف Elo الموسمي
   في المباريات السريعة الحقيقية (لا تشمل الأشباح). تبدأ كل المواسم من ١٠٠٠.
   • تحديد المستوى: أول ٥ مباريات في الموسم بلا رتبة معلنة.
   • مكافأة نهاية الموسم: لآلئ حسب رتبتك النهائية (تُطالب بها مرة واحدة).
   الحدود وقيم المكافآت قابلة للضبط من هنا فقط.
   ========================================================================= */
export const PLACEMENT_GAMES = 5;
export const RANKS = [
  { id: 'bronze', min: 0, icon: '🥉', color: '#C98A4B', pearls: 20 },
  { id: 'silver', min: 1100, icon: '🥈', color: '#C9D3DD', pearls: 50 },
  { id: 'gold', min: 1250, icon: '🥇', color: '#FFC94A', pearls: 100 },
  { id: 'diamond', min: 1450, icon: '💎', color: '#7CF0FF', pearls: 200 },
  { id: 'legend', min: 1700, icon: '👑', color: '#FF7BB0', pearls: 400 },
];

/** الرتبة من التصنيف وعدد المباريات: { id, icon, color, placed, next, progress (0–1), toNext } */
export function rankOf(rating = 1000, games = 0) {
  const placed = games >= PLACEMENT_GAMES;
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (rating >= RANKS[k].min) i = k;
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  const lo = cur.min || 900;
  const progress = next ? Math.max(0, Math.min(1, (rating - lo) / (next.min - lo))) : 1;
  return { ...cur, placed, placementLeft: Math.max(0, PLACEMENT_GAMES - games), next: next?.id || null, toNext: next ? Math.max(0, next.min - rating) : 0, progress };
}
export const rankById = (id) => RANKS.find((r) => r.id === id) || RANKS[0];
