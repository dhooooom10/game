/* =========================================================================
   دروس المنهج (منقولة من «الطور التعليمي» في النسخة السابقة).
   معرّفات المسارات وترتيب الدروس محفوظة كما هي حتى يبقى تقدّم اللاعبين
   السابق صالحًا (المفتاح: «معرّف المسار|رقم الدرس»).
   كل درس = ١٠ أسئلة تقريبًا بلا مؤقت، والنجوم بالدقة:
   ★ دقة ٦٥٪ (يفتح الدرس التالي) · ★★ ٨٠٪ · ★★★ ٩٥٪
   ========================================================================= */

const L = (ar, en, sAr, sEn, topics, extra = {}) => ({ n: { ar, en }, s: { ar: sAr, en: sEn }, topics, ...extra });
const T = (topic, tier, cfg = {}, w = 1) => ({ topic, tier, cfg, w });

export const STAGES = [
  { id: 'pre', name: { ar: 'المرحلة التمهيدية', en: 'Early years' }, age: { ar: '٤–٦ سنوات', en: 'Ages 4–6' }, icon: '🧸', color: '#3DDC97',
    paths: [
      { id: 'count', icon: '🔢', color: '#3DDC97', name: { ar: 'العدّ والأعداد', en: 'Counting' }, desc: { ar: 'نبدأ بالعدّ قبل الرموز', en: 'Counting before symbols' },
        lessons: [
          L('عُدّ الأشياء', 'Count objects', 'كم شيئًا ترى؟', 'How many do you see?', [T('count', 1, { min: 1, max: 5 })], { q: 8, choiceOnly: true }),
          L('العدّ حتى ١٠', 'Count to 10', 'أعداد أكبر', 'Bigger numbers', [T('count', 2, { min: 3, max: 10 })], { q: 8, choiceOnly: true }),
          L('الجمع بالعدّ', 'Add by counting', 'اجمع المجموعتين', 'Join the groups', [T('countAdd', 1, { max: 4 })], { q: 8, choiceOnly: true }),
          L('الجمع حتى ٥', 'Add up to 5', 'أول أرقام مجرّدة', 'First symbols', [T('add', 1, { range: [1, 4] })], { q: 8 }),
          L('الطرح حتى ٥', 'Subtract within 5', 'الإنقاص البسيط', 'Taking away', [T('sub', 1, { range: [1, 5] })], { q: 8 }),
        ] },
    ] },
  { id: 'basic', name: { ar: 'المرحلة الأساسية', en: 'Primary' }, age: { ar: '٦–٩ سنوات', en: 'Ages 6–9' }, icon: '✏️', color: '#38D6F5',
    paths: [
      { id: 'add', icon: '➕', color: '#38D6F5', name: { ar: 'مسار الجمع', en: 'Addition path' }, desc: { ar: 'من الجمع البسيط إلى المئة', en: 'From small sums to 100' },
        lessons: [
          L('الجمع حتى ١٠', 'Add within 10', 'أرقام صغيرة', 'Small numbers', [T('add', 1, { range: [1, 9] })], { q: 8 }),
          L('الجمع حتى ٢٠', 'Add within 20', 'توسيع النطاق', 'Wider range', [T('add', 2, { range: [2, 18] })]),
          L('الجمع حتى ٥٠', 'Add within 50', 'أرقام متوسطة', 'Medium numbers', [T('add', 4, { range: [5, 45] })]),
          L('الجمع حتى ١٠٠', 'Add within 100', 'أرقام كبيرة', 'Big numbers', [T('add', 6, { range: [10, 90] })]),
          L('جمع ثلاثة أعداد', 'Add three numbers', 'خطوتان في مسألة', 'Two steps', [T('order', 2, { ops: ['add'], ops2: ['add'], range: [2, 20] })], { q: 8 }),
          L('مراجعة الجمع', 'Addition review', 'اختبار إتقان', 'Mastery check', [T('add', 5, { range: [2, 60] })], { q: 12, formats: ['input', 'choice', 'missing', 'compare'] }),
        ] },
      { id: 'sub', icon: '➖', color: '#4FB3E8', name: { ar: 'مسار الطرح', en: 'Subtraction path' }, desc: { ar: 'الطرح بلا نتائج سالبة', en: 'No negative results' },
        lessons: [
          L('الطرح حتى ١٠', 'Subtract within 10', 'خطوتك الأولى', 'First steps', [T('sub', 1, { range: [1, 10] })], { q: 8 }),
          L('الطرح حتى ٢٠', 'Subtract within 20', 'توسيع النطاق', 'Wider range', [T('sub', 2, { range: [2, 20] })]),
          L('الطرح حتى ٥٠', 'Subtract within 50', 'أرقام متوسطة', 'Medium numbers', [T('sub', 4, { range: [5, 50] })]),
          L('الطرح حتى ١٠٠', 'Subtract within 100', 'أرقام كبيرة', 'Big numbers', [T('sub', 6, { range: [10, 100] })]),
          L('مراجعة الطرح', 'Subtraction review', 'اختبار إتقان', 'Mastery check', [T('sub', 5, { range: [3, 70] })], { q: 12, formats: ['input', 'choice', 'missing', 'compare'] }),
        ] },
      { id: 'mul', icon: '✖️', color: '#9B8CFF', name: { ar: 'جداول الضرب', en: 'Times tables' }, desc: { ar: 'جدول مستقل لكل رقم', en: 'One table at a time' },
        lessons: [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => L(`جدول ${n}`, `Table of ${n}`, `${n} × ١ إلى ${n} × ١٢`, `${n} × 1 to ${n} × 12`, [T('mul', 3, { table: n })], { q: n <= 3 ? 8 : 10 }))
          .concat([L('مراجعة الجداول', 'Tables review', 'كل الجداول معًا', 'All tables', [T('mul', 3)], { q: 14, formats: ['input', 'choice', 'missing'] })]) },
      { id: 'div', icon: '➗', color: '#FF9F5A', name: { ar: 'مسار القسمة', en: 'Division path' }, desc: { ar: 'القسمة عكس الضرب — بلا باقٍ', en: 'Inverse of multiplication' },
        lessons: [
          ...[2, 3, 4, 5].map((n) => L(`القسمة على ${n}`, `Divide by ${n}`, n === 2 ? 'التنصيف' : `عكس جدول ${n}`, n === 2 ? 'Halving' : `Inverse of ${n}s`, [T('div', 3, { divBy: n })], { q: n <= 3 ? 8 : 10 })),
          L('قواسم مختلطة', 'Mixed divisors', 'كل القواسم', 'All divisors', [T('div', 3)]),
          L('مراجعة القسمة', 'Division review', 'اختبار إتقان', 'Mastery check', [T('div', 4)], { q: 12, formats: ['input', 'choice', 'missing'] }),
        ] },
    ] },
  { id: 'mid', name: { ar: 'المرحلة المتوسطة', en: 'Middle' }, age: { ar: '٩–١٢ سنة', en: 'Ages 9–12' }, icon: '📐', color: '#9B8CFF',
    paths: [
      { id: 'order', icon: '🔀', color: '#9B8CFF', name: { ar: 'ترتيب العمليات', en: 'Order of operations' }, desc: { ar: 'الأقواس أولًا', en: 'Brackets first' },
        lessons: [
          L('جمع وطرح معًا', 'Add & subtract', 'العمليتان في مسألة', 'Both in one set', [T('add', 4), T('sub', 4)]),
          L('ضرب وقسمة معًا', 'Multiply & divide', 'العمليتان في مسألة', 'Both in one set', [T('mul', 3), T('div', 3)]),
          L('العمليات الأربع', 'All four', 'كل شيء مختلط', 'Everything mixed', [T('add', 4), T('sub', 4), T('mul', 3), T('div', 3)]),
          L('الأقواس أولًا', 'Brackets first', '( ) قبل كل شيء', '( ) before all', [T('order', 3)]),
          L('مراجعة الترتيب', 'Order review', 'اختبار إتقان', 'Mastery check', [T('order', 4, {}, 2), T('mul', 4), T('div', 4)], { q: 12 }),
        ] },
      { id: 'neg', icon: '🌡️', color: '#FF7BB0', name: { ar: 'الأعداد السالبة', en: 'Negative numbers' }, desc: { ar: 'ما دون الصفر — كدرجات الحرارة', en: 'Below zero, like temperature' },
        lessons: [
          L('أول سالب', 'First negatives', '٣ − ٧ = ؟', '3 − 7 = ?', [T('sub', 8, { forceNeg: true, min: 1, max: 10 })], { q: 8 }),
          L('الطرح السالب', 'Negative results', 'نطاق أوسع', 'Wider range', [T('sub', 8, { forceNeg: true, min: 2, max: 25 })]),
          L('سالب مع جمع', 'With addition', 'الاتجاهان معًا', 'Both directions', [T('add', 9), T('sub', 8)]),
          L('مراجعة السوالب', 'Negatives review', 'اختبار إتقان', 'Mastery check', [T('add', 9), T('sub', 9)], { q: 12 }),
        ] },
      { id: 'frac', icon: '½', color: '#FFB0D8', name: { ar: 'الكسور والنِّسب', en: 'Fractions & percents' }, desc: { ar: 'أجزاء من الكل', en: 'Parts of a whole' },
        lessons: [
          L('نصف العدد', 'Half of a number', '½ من ٢٠ = ؟', '½ of 20 = ?', [T('frac', 2, { fracTier: 1, kMax: 12 })], { q: 8 }),
          L('الثلث والربع', 'Thirds & quarters', '⅓ و ¼', '⅓ and ¼', [T('frac', 4, { fracTier: 3, kMax: 10 })]),
          L('كسور متنوّعة', 'Mixed fractions', '⅔ و ¾ أيضًا', '⅔ and ¾ too', [T('frac', 6, { fracTier: 4, kMax: 10 })]),
          L('النسبة المئوية', 'Percentages', '٢٥٪ من ٨٠ = ؟', '25% of 80 = ?', [T('percent', 4)]),
          L('مراجعة الكسور', 'Fractions review', 'اختبار إتقان', 'Mastery check', [T('frac', 8, { fracTier: 5, kMax: 12 }), T('percent', 6)], { q: 12 }),
        ] },
    ] },
  { id: 'adv', name: { ar: 'المرحلة المتقدّمة', en: 'Advanced' }, age: { ar: '١٢ سنة فأكثر', en: 'Ages 12+' }, icon: '🎓', color: '#FFC94A',
    paths: [
      { id: 'power', icon: '√', color: '#FF9F5A', name: { ar: 'الأسس والجذور', en: 'Powers & roots' }, desc: { ar: 'القوة وعكسها', en: 'Powers and their inverse' },
        lessons: [
          L('المربّعات', 'Squares', '٧² = ٧ × ٧', '7² = 7 × 7', [T('power', 2, { max: 10 })], { q: 8 }),
          L('مربّعات أكبر', 'Bigger squares', 'حتى ١٢²', 'Up to 12²', [T('power', 2, { max: 12 })]),
          L('المكعّبات', 'Cubes', '٣³ = ٣ × ٣ × ٣', '3³ = 3 × 3 × 3', [T('power', 2, { cube: true, max: 6 })], { q: 8 }),
          L('الجذر التربيعي', 'Square roots', '√٦٤ = ؟', '√64 = ?', [T('power', 2, { root: true, max: 10 })]),
          L('جذور أكبر', 'Bigger roots', 'حتى √١٤٤', 'Up to √144', [T('power', 2, { root: true, max: 12 })]),
          L('مراجعة الأسس', 'Powers review', 'اختبار إتقان', 'Mastery check', [T('power', 6, { max: 12 })], { q: 12 }),
        ] },
      { id: 'master', icon: '🏅', color: '#FFC94A', name: { ar: 'اختبار الإتقان', en: 'Mastery test' }, desc: { ar: 'كل ما تعلّمته في مكان واحد', en: 'Everything together' },
        lessons: [
          L('العمليات الأربع', 'Four operations', 'سرعة وإتقان', 'Speed & accuracy', [T('add', 6), T('sub', 6), T('mul', 4), T('div', 4)], { q: 12 }),
          L('مركّبات وأقواس', 'Brackets', 'خطوتان لكل مسألة', 'Two steps each', [T('order', 4, {}, 3), T('mul', 4)], { q: 12 }),
          L('مع السوالب', 'With negatives', 'كل الاتجاهات', 'All directions', [T('add', 9), T('sub', 8), T('order', 5, { neg: true }), T('mul', 5)], { q: 14 }),
          L('الاختبار النهائي', 'Final test', 'شهادة الإتقان 🎓', 'Mastery certificate 🎓', [T('add', 7), T('sub', 8), T('mul', 5), T('div', 5), T('order', 5), T('frac', 6), T('percent', 5)], { q: 15, formats: ['input', 'choice', 'missing', 'compare'] }),
        ] },
    ] },
];

export const PATHS = STAGES.flatMap((st) => st.paths.map((p) => ({ ...p, stage: st })));
export const lessonKey = (pid, i) => `${pid}|${i}`;
export const findPath = (pid) => PATHS.find((p) => p.id === pid) || null;

/** نجوم الدرس من الدقة */
export function lessonStars(accuracy, answered, needed) {
  if (answered < needed) return 0;
  if (accuracy >= 0.95) return 3;
  if (accuracy >= 0.8) return 2;
  if (accuracy >= 0.65) return 1;
  return 0;
}

/** يُفتح المسار التالي عند إنجاز نصف دروس المسار السابق */
export function pathOpen(lessonsProgress, idx) {
  if (idx <= 0) return true;
  const prev = PATHS[idx - 1];
  const done = prev.lessons.filter((_, i) => (lessonsProgress.done[lessonKey(prev.id, i)] || 0) > 0).length;
  return done >= Math.ceil(prev.lessons.length / 2);
}

export const lessonUnlocked = (lessonsProgress, pid) => lessonsProgress.unlocked[pid] || 1;
