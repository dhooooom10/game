/* =========================================================================
   نظام النقاط — بسيط ومفهوم:
   • الإجابة الصحيحة: ١٠٠ نقطة + ١٠ لكل مستوى صعوبة فوق الأول.
   • السلسلة: كل إجابة صحيحة متتالية بعد الأولى تضيف ١٠٪ حتى ×١٫٥ (من الخامسة فأكثر).
   • السرعة (فقط في الأنماط الموقوتة): حتى +٥٠ إذا أجبت ضمن الزمن المتوقّع،
     تتناقص خطيًا حتى صفر عند ضعف الزمن المتوقّع.
   • الخطأ: صفر نقاط ويعيد السلسلة إلى الصفر. لا نقاط سالبة أبدًا.
   • مكافأة الدقة في نهاية الجولة (الرحلة والتحدي اليومي): حتى +٢٠٠ عند دقة ١٠٠٪،
     تبدأ من دقة ٧٠٪.
   ========================================================================= */

export const BASE = 100;
export const PER_TIER = 10;
export const STREAK_STEP = 0.1;
export const STREAK_MAX = 1.5;
export const SPEED_MAX = 50;

export function streakMultiplier(streak) {
  if (streak <= 1) return 1;
  return Math.min(STREAK_MAX, 1 + (streak - 1) * STREAK_STEP);
}

export function speedBonus(ms, parMs) {
  if (ms == null || !parMs) return 0;
  const f = (2 * parMs - ms) / parMs; // ≥1 ضمن الزمن، 0 عند الضعف
  return Math.round(SPEED_MAX * Math.max(0, Math.min(1, f)));
}

/**
 * نقاط إجابة واحدة.
 * { correct, tier, streak (بعد احتساب هذه الإجابة), ms, parMs, useSpeed }
 */
export function answerPoints({ correct, tier = 1, streak = 1, ms = null, parMs = 0, useSpeed = false }) {
  if (!correct) return { total: 0, base: 0, streakBonus: 0, speed: 0 };
  const base = BASE + PER_TIER * (Math.max(1, tier) - 1);
  const withStreak = Math.round(base * streakMultiplier(streak));
  const speed = useSpeed ? speedBonus(ms, parMs) : 0;
  return { total: withStreak + speed, base, streakBonus: withStreak - base, speed };
}

export function accuracyBonus(correct, answered) {
  if (answered < 5) return 0;
  const acc = correct / answered;
  return Math.round(200 * Math.max(0, (acc - 0.7) / 0.3));
}
