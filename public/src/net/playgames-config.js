/* =========================================================================
   معرّفات Google Play Games — تملؤها من Play Console بعد إنشاء اللعبة هناك
   (Play Console ← Grow users ← Play Games Services ← Setup and management).
   أي معرّف فارغ يعني أن الميزة المقابلة معطّلة بهدوء (لا أخطاء).
   التفاصيل خطوة بخطوة: docs/WHAT_YOU_NEED.md
   ========================================================================= */
export const PGS = {
  // معرّف عميل OAuth من نوع «Web application» (ليس Android) — ينتهي بـ .apps.googleusercontent.com
  // يُستخدم لطلب serverAuthCode الذي يتحقق منه خادمك (GOOGLE_CLIENT_ID على الخادم = هذه القيمة نفسها)
  webClientId: '',

  // الإنجازات: معرّف كل شارة في اللعبة ← معرّف الإنجاز في Play Console (يبدأ عادة بـ CgkI...)
  achievements: {
    first: '', streak10: '', streak25: '', correct100: '', correct1000: '', perfect: '',
    speed20: '', survive25: '', daily3: '', daily7: '', world1: '', world5: '', world10: '',
    allstars: '', allround: '', friend: '', scholar: '', rain: '',
  },

  // لوحات الصدارة في Play Games (إضافة لِلوحات خادمك، لا بديل عنها)
  leaderboards: {
    stars: '',      // مجموع نجوم الرحلة
    xp: '',         // مجموع الخبرة
    survival: '',   // أفضل عدد قطرات في وضع البقاء (أي صعوبة)
    time60: '',     // أفضل عدد قطرات في تحدي الدقيقة (أي صعوبة)
  },
};
