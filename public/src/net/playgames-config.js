/* =========================================================================
   معرّفات Google Play Games — تملؤها من Play Console بعد إنشاء اللعبة هناك
   (Play Console ← Grow users ← Play Games Services ← Setup and management).
   أي معرّف فارغ يعني أن الميزة المقابلة معطّلة بهدوء (لا أخطاء).
   التفاصيل خطوة بخطوة: docs/WHAT_YOU_NEED.md
   ========================================================================= */
export const PGS = {
  // الإنجازات: معرّف كل شارة في اللعبة ← معرّف الإنجاز في Play Console (يبدأ عادة بـ CgkI...)
  achievements: {
    first: '', streak10: '', streak25: '', correct100: '', correct1000: '', perfect: '',
    speed20: '', survive25: '', daily3: '', daily7: '', world1: '', world5: '', world10: '',
    allstars: '', allround: '', friend: '', scholar: '', rain: '',
    fever: '', gift: '', speedx2: '', speedx3: '', turbo: '',
  },

  // لوحات الصدارة في Play Games (العالمية وبين الأصدقاء — بلا خادم خاص)
  leaderboards: {
    stars: '',      // مجموع نجوم الرحلة
    xp: '',         // مجموع الخبرة
    survival: '',   // أفضل عدد إجابات صحيحة في «البقاء» (أي صعوبة)
    time60: '',     // أفضل عدد إجابات صحيحة في «تحدّي الوقت» ٦٠ ثانية (أي صعوبة)
  },
};
