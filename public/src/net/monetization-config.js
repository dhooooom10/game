/* =========================================================================
   إعدادات الربح — تملؤها من AdMob و Play Console. التفاصيل: docs/WHAT_YOU_NEED.md
   ========================================================================= */
export const MONEY = {
  // 'general' = جمهور عام ١٣+ (إعلانات مخصّصة بعد الموافقة، تصنيف PG).
  // 'families' = إن اخترت الأطفال ضمن الجمهور المستهدف في Play Console: إعلانات غير مخصّصة وتصنيف G فقط.
  audience: 'general',

  // true = وحدات Google التجريبية (للتطوير فقط، بلا أرباح). اجعلها false بعد وضع معرّفاتك.
  testAds: true,
  // معرّفات وحدات AdMob الحقيقية (ca-app-pub-XXXX/YYYY). الفارغ = تعطيل ذلك النوع.
  adUnits: { rewarded: '', interstitial: '' },

  // سياسة الإعلانات البينية (بين الجولات فقط، لا أثناء اللعب، ولا في قسم التعلّم)
  interstitial: { minRoundsBeforeFirst: 4, everyRounds: 3, minSeconds: 150 },
};

// وحدات Google التجريبية الرسمية — تعرض إعلانات «Test Ad» فقط
export const TEST_UNITS = { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' };
