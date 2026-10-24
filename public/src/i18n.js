/* =========================================================================
   النصوص — العربية (الأساس) والإنجليزية كاملتان.
   اللغات الأخرى الموجودة في النسخة السابقة محفوظة للعناوين الأساسية،
   وأي نص غير مترجم يظهر بالإنجليزية بدل أن يظهر فارغًا.
   الأرقام تُكتب هنا بالأرقام الغربية وتُحوَّل تلقائيًا حسب تفضيل اللاعب.
   ========================================================================= */
import { toArabicDigits } from './core/numbers.js';

export const LANGS = {
  ar: { n: 'العربية', rtl: true }, en: { n: 'English', rtl: false }, es: { n: 'Español', rtl: false },
  pt: { n: 'Português', rtl: false }, fr: { n: 'Français', rtl: false }, de: { n: 'Deutsch', rtl: false },
  ru: { n: 'Русский', rtl: false }, tr: { n: 'Türkçe', rtl: false }, zh: { n: '中文', rtl: false },
  ja: { n: '日本語', rtl: false }, ko: { n: '한국어', rtl: false }, id: { n: 'Indonesia', rtl: false }, hi: { n: 'हिन्दी', rtl: false },
};

const ar = {
  'app.tagline': 'تحدَّ الأرقام واكسر رقمك القياسي',
  'mascot.name': 'قطرة',
  'nav.home': 'الرئيسية', 'nav.journey': 'الرحلة', 'nav.progress': 'تقدّمي', 'nav.locker': 'الخزانة', 'nav.settings': 'الإعدادات',
  'app.name': 'تحدي قطرة', 'common.close': 'إغلاق', 'common.cancel': 'إلغاء', 'common.confirm': 'تأكيد', 'common.back': 'رجوع', 'common.save': 'حفظ',
  'common.sec': '{n} ث', 'common.secLong': '{n} ثانية', 'common.start': 'ابدأ', 'common.ok': 'حسنًا', 'common.new': 'جديد',
  'common.locked': 'مقفل', 'common.min': '{n} د',

  'home.hello': 'أهلًا {name}!', 'home.helloAnon': 'أهلًا بك!', 'home.play': 'العب الآن',
  'home.playSub': 'المرحلة {n} · {world}', 'home.playFirst': 'ابدأ رحلتك من المرحلة 1', 'home.allDone': 'أنهيت الرحلة! حسّن نجومك',
  'home.modes': 'أنماط اللعب', 'home.missions': 'مهام اليوم', 'home.missionsDone': 'أنجزت مهام اليوم كلها 🎉',
  'home.level': 'المستوى {n}', 'home.xp': '{a}/{b} خبرة', 'home.stars': 'النجوم', 'home.bestTime': 'أفضل دقيقة',
  'home.streak': 'سلسلة الأيام', 'home.storageWarn': 'الحفظ الدائم غير متاح في هذا المتصفح — سيضيع التقدّم عند الإغلاق.',
  'home.mascotLine1': 'جاهز لتحدٍّ جديد؟', 'home.mascotLine2': 'كل إجابة صحيحة تقرّبك من نجمة!', 'home.mascotLine3': 'سلسلتك اليومية تنتظرك!',

  'daily.title': 'التحدي اليومي', 'daily.sub': '{n} سؤالًا ثابتة لهذا اليوم · محاولة رسمية واحدة',
  'daily.start': 'ابدأ تحدي اليوم', 'daily.done': 'أنجزته اليوم: {score} نقطة', 'daily.practice': 'العب للتدريب',
  'daily.streak': 'سلسلة {n} يوم', 'daily.comeBack': 'تحدٍّ جديد غدًا', 'daily.practiceRun': 'جولة تدريب — نتيجتك الرسمية لا تتغيّر',
  'daily.leaveNote': 'الوقت يُحتسب، ولا يوجد إيقاف. إذا غادرت أثناء التحدي يُتخطّى السؤال المعروض.',

  'mode.journey': 'رحلة المستويات', 'mode.journeySub': '100 مرحلة في 10 عوالم',
  'mode.time': 'تحدي الوقت',   'mode.survival': 'البقاء',   'mode.practice': 'التدريب الحر', 'mode.practiceSub': 'اختر العمليات والمستوى · بلا ضغط',
  'mode.friend': 'تحدي صديق', 'mode.friendSub': 'على الجهاز نفسه · أسئلة متكافئة',
  'mode.rain': 'مطر المعادلات', 'mode.rainSub': 'الكلاسيكي: فجّر القطرات قبل أن تسقط',
  'mode.daily': 'التحدي اليومي', 'mode.lesson': 'الدرس', 'mode.tutorial': 'الشرح',

  'world.w1': 'المطر الخفيف', 'world.w2': 'الغيمة', 'world.w3': 'الوابل', 'world.w4': 'العاصفة', 'world.w5': 'السيل',
  'world.w6': 'الرعد', 'world.w7': 'الإعصار', 'world.w8': 'الطوفان', 'world.w9': 'الزوبعة', 'world.w10': 'الأسطورة',
  'world.w1t': 'جمع وطرح', 'world.w2t': 'يظهر الضرب', 'world.w3t': 'تظهر القسمة', 'world.w4t': 'المقارنة', 'world.w5t': 'الأقواس والعدد المفقود',
  'world.w6t': 'أرقام أكبر', 'world.w7t': 'تنوّع أكثر', 'world.w8t': 'نتائج سالبة', 'world.w9t': 'تحدٍّ قاسٍ', 'world.w10t': 'الاختبار الأخير',

  'op.add': 'الجمع', 'op.sub': 'الطرح', 'op.mul': 'الضرب', 'op.div': 'القسمة', 'op.order': 'الأقواس',
  'op.frac': 'الكسور', 'op.percent': 'النسب المئوية', 'op.power': 'الأسس والجذور',

  'fmt.input': 'اكتب الناتج', 'fmt.choice': 'اختر الإجابة الصحيحة', 'fmt.missing': 'ما العدد المفقود؟', 'fmt.compare': 'أيّهما أكبر؟',
  'fmt.count': 'كم عددها؟', 'fmt.of': 'من', 'fmt.equal': 'متساويان',
  'fmtName.mixed': 'منوّعة', 'fmtName.input': 'إدخال', 'fmtName.choice': 'اختيار', 'fmtName.missing': 'المفقود', 'fmtName.compare': 'مقارنة',

  'game.pause': 'إيقاف مؤقت', 'game.paused': 'متوقف مؤقتًا', 'game.pausedNote': 'السؤال مخفي أثناء الإيقاف، وعند المتابعة يظهر سؤال جديد مكافئ له.',
  'game.pausedKeep': 'خذ استراحة — سؤالك بانتظارك.', 'game.pausedDaily': 'غادرت التحدي اليومي — تم تخطي السؤال الذي كان معروضًا. الوقت متوقف الآن.',
  'game.resume': 'متابعة', 'game.quit': 'خروج', 'game.quitTitle': 'الخروج من الجولة؟',
  'game.quitBody': 'لن تُحفظ نتيجة هذه الجولة ولا مكافآتها. إجاباتك تبقى محسوبة في إحصاءاتك.',
  'game.quitPractice': 'سيُنهى التدريب وتُعرض نتيجتك.', 'game.quitDaily': 'ستُعتمد نتيجتك الحالية كمحاولتك الرسمية لهذا اليوم.',
  'game.keepPlaying': 'أكمل اللعب', 'game.endNow': 'إنهاء', 'game.check': 'تحقّق', 'game.next': 'التالي',
  'game.correct': 'صحيح!', 'game.wrong': 'الإجابة الصحيحة: {a}', 'game.timeout': 'انتهى الوقت — الإجابة: {a}',
  'game.skipped': 'تم تخطي هذا السؤال لأنك غادرت', 'game.streak': 'سلسلة {n}', 'game.lives': 'المحاولات',
  'game.question': 'سؤال {i} من {n}', 'game.questionOpen': 'سؤال {i}', 'game.goal': '{c} من {n} صحيحة',
  'game.typeHere': 'اكتب الإجابة', 'game.ready': 'استعد…', 'game.go': 'انطلق!', 'game.del': 'حذف', 'game.neg': 'سالب',
  'game.left': 'الأيسر', 'game.right': 'الأيمن', 'game.why': 'لماذا؟', 'game.score': 'النقاط', 'game.timeLeft': 'الوقت المتبقي',
  'game.resumeTitle': 'جولة غير مكتملة', 'game.resumeBody': 'لديك جولة «{mode}» لم تكتمل. استئنافها؟',
  'game.resumeBtn': 'استئناف', 'game.discard': 'إنهاء دون نتيجة', 'game.points': '+{n}',
  'game.praise': 'ممتاز!|رائع!|أحسنت!|صح!|عبقري!|بطل!', 'game.streakMsg': 'سلسلة {n}! النقاط ×{m}',
  'game.hearts': '{n} محاولات متبقية',

  'res.levelPassed': 'اجتزت المرحلة {n}!', 'res.levelFailed': 'اقتربت! حاول مرة أخرى', 'res.bossPassed': 'هزمت الزعيم!',
  'res.timeUp': 'انتهى الوقت!', 'res.survivalEnd': 'صمدت حتى {n} إجابات صحيحة!', 'res.practiceEnd': 'انتهى التدريب',
  'res.dailyEnd': 'أنهيت تحدي اليوم!', 'res.lessonPassed': 'اجتزت الدرس!', 'res.lessonFailed': 'لم يكتمل الدرس بعد',
  'res.rainWin': 'نجوت من العاصفة!', 'res.rainLose': 'غمرك المطر هذه المرة',
  'res.newRecord': 'رقم قياسي جديد!', 'res.score': 'النقاط', 'res.accuracy': 'الدقة', 'res.avgTime': 'متوسط الزمن',
  'res.bestStreak': 'أطول سلسلة', 'res.correct': 'الصحيحة', 'res.xp': '+{n} خبرة', 'res.levelUp': 'وصلت إلى المستوى {n}!',
  'res.badge': 'شارة جديدة', 'res.mission': 'مهمة منجزة', 'res.unlock': 'مظهر جديد', 'res.retry': 'إعادة',
  'res.next': 'المرحلة التالية', 'res.nextLesson': 'الدرس التالي', 'res.home': 'الرئيسية', 'res.tipTitle': 'لتتحسّن',
  'res.prevBest': 'رقمك السابق: {n}', 'res.official': 'نتيجة رسمية لليوم', 'res.practiceRun': 'جولة تدريب — لا تغيّر النتيجة الرسمية',
  'res.winner': 'فاز {name}!', 'res.draw': 'تعادل!', 'res.rematch': 'مباراة أخرى', 'res.accBonus': 'مكافأة الدقة +{n}',
  'res.of': '{a} من {b}', 'res.timeLeft': 'الوقت المتبقي', 'res.back': 'رجوع', 'res.rewards': 'المكافآت',
  'res.passRule': 'تحتاج دقة 70% على الأقل للاجتياز', 'res.sprintRule': 'تحتاج {n} إجابات صحيحة قبل نفاد الوقت',
  'res.bossRule': 'حافظ على محاولة واحدة على الأقل حتى النهاية', 'res.lessonRule': 'تحتاج دقة 65% لفتح الدرس التالي',
  'tip.accuracy': 'خذ ثانية إضافية قبل الإجابة — الدقة هي ما يمنح النجوم.',
  'tip.wrongOp': 'أكثر أخطائك هذه الجولة في {op}. تدريب قصير عليها سيصنع فرقًا.',
  'tip.slowOp': 'أبطأ إجاباتك كانت في {op}. كرّرها في التدريب الحر لتصبح أسرع.',
  'tip.streak': 'حافظ على السلسلة: كل إجابة صحيحة متتالية ترفع نقاطك حتى ×1.5.',
  'tip.speed': 'في الأنماط الموقوتة تمنحك السرعة حتى 50 نقطة إضافية لكل إجابة.',
  'tip.great': 'أداء رائع! جرّب صعوبة أعلى لتحدٍّ أكبر.', 'tip.practiceBtn': 'تدرّب على {op}',

  'prog.title': 'تقدّمي', 'prog.empty': 'لا توجد بيانات بعد', 'prog.emptySub': 'العب جولتك الأولى، وستظهر هنا دقتك وسرعتك وتطوّرك يومًا بعد يوم.',
  'prog.rounds': 'الجولات', 'prog.questions': 'الأسئلة المجابة', 'prog.accuracy': 'الدقة', 'prog.avgTime': 'متوسط زمن الإجابة',
  'prog.bestStreak': 'أطول سلسلة', 'prog.bests': 'أفضل نتيجة لكل نمط', 'prog.perOp': 'مستواك في كل عملية',
  'prog.trend': 'آخر 14 يومًا', 'prog.trendQ': 'عدد الأسئلة', 'prog.trendAcc': 'الدقة', 'prog.rec': 'توصية لك',
  'prog.how': 'كيف تُحسب هذه الأرقام؟', 'prog.practiceBtn': 'تدرّب الآن', 'prog.noRecord': '—', 'prog.levelOf': 'مستوى {n}/10',
  'prog.fewData': 'عيّنة قليلة', 'prog.legacy': 'من النسخة السابقة: {g} جولة و{p} قطرة مفجّرة (غير مشمولة في الدقة).',
  'prog.noPlayDay': 'لا لعب', 'prog.today': 'اليوم', 'prog.recordTime': 'تحدي الوقت {d} ث ({diff})', 'prog.recordSurv': 'البقاء ({diff})',
  'prog.recordRain': 'مطر المعادلات ({diff})', 'prog.recordDaily': 'التحدي اليومي', 'prog.journeyStars': 'نجوم الرحلة',
  'prog.correctUnit': '{n} صحيحة', 'prog.scoreUnit': '{n} نقطة', 'prog.local': 'تُحسب من لعبك على هذا الجهاز فقط — لا توجد ترتيبات عالمية.',
  'prog.def': 'الدقة = الإجابات الصحيحة ÷ الأسئلة المجابة (يشمل الأسئلة التي انتهى وقتها، ولا يشمل الأسئلة المتخطّاة).|متوسط زمن الإجابة = من لحظة ظهور السؤال حتى الإجابة، دون فترات الإيقاف ودون الأسئلة التي انتهى وقتها ونمط المطر.|مستوى العملية (1–10) يرتفع أو ينخفض بخطوات صغيرة فقط بعد 6 إجابات جديدة على الأقل، بحسب الدقة والسرعة في آخر 8 إجابات.|الجولة تُحتسب عند اكتمالها أو إنهائها من التدريب؛ الجولات المتروكة لا تُحتسب جولة.|تحدي صديق لا يدخل في إحصاءاتك لأنه يلعبه شخصان.',
  'rec.needData': 'أجب عن {n} سؤالًا إضافيًا لنقترح عليك تدريبًا مبنيًا على أدائك.',
  'rec.accuracy': 'دقتك في {op} هي {acc}% — تدريب قصير عليها سيرفع نجومك.',
  'rec.speed': 'إجاباتك في {op} صحيحة لكنها تستغرق {s} ثوانٍ في المتوسط. جرّب تحدي الوقت لتسرّع.',
  'rec.levelUp': 'أداؤك ثابت وممتاز! ارفع مستوى {op} في التدريب الحر.',

  'lock.title': 'الخزانة', 'lock.badges': 'الشارات', 'lock.looks': 'المظهر', 'lock.theme': 'السمة', 'lock.skin': 'لون قطرة',
  'lock.acc': 'الإكسسوار', 'lock.needLevel': 'المستوى {n}', 'lock.needBadge': 'شارة «{b}»', 'lock.equipped': 'مُختار',
  'lock.note': 'المظاهر تجميلية فقط ولا تؤثر على صعوبة الأسئلة أو النقاط.', 'lock.earned': 'حصلت عليها {d}', 'lock.count': '{a} من {b}',

  'badge.first': 'البداية', 'badge.firstD': 'أنهِ جولتك الأولى',
  'badge.streak10': 'شعلة', 'badge.streak10D': 'سلسلة 10 إجابات صحيحة',
  'badge.streak25': 'مذنّب', 'badge.streak25D': 'سلسلة 25 إجابة صحيحة',
  'badge.correct100': 'مئة صحيحة', 'badge.correct100D': '100 إجابة صحيحة',
  'badge.correct1000': 'قمة الألف', 'badge.correct1000D': '1000 إجابة صحيحة',
  'badge.perfect': 'دقة تامة', 'badge.perfectD': 'جولة من 10 أسئلة أو أكثر بلا أي خطأ',
  'badge.speed20': 'البرق', "badge.speed20D": "٢٠ سؤالًا أو أكثر بدقة ٩٠٪ ومتوسط ٣ ث أو أقل (صعوبة متوسطة فأعلى، بلا فرصة ثانية)",
  'badge.survive25': 'الصامد', "badge.survive25D": "٢٥ صحيحة بقواعد البقاء (٣ محاولات أو أقل، صعوبة متوسطة فأعلى، بلا فرصة ثانية)",
  'badge.daily3': 'منتظم', 'badge.daily3D': 'التحدي اليومي 3 أيام متتالية',
  'badge.daily7': 'أسبوع كامل', 'badge.daily7D': 'التحدي اليومي 7 أيام متتالية',
  'badge.world1': 'المطر الأول', 'badge.world1D': 'أنهِ العالم الأول في الرحلة',
  'badge.world5': 'راكب السيل', 'badge.world5D': 'أنهِ 5 عوالم في الرحلة',
  'badge.world10': 'الأسطورة', 'badge.world10D': 'أنهِ الرحلة كاملة',
  'badge.allstars': 'سماء مكتملة', 'badge.allstarsD': '30 نجمة في عالم واحد',
  'badge.allround': 'متكامل', 'badge.allroundD': 'مستوى 5 أو أعلى في العمليات الأربع',
  'badge.friend': 'روح رياضية', 'badge.friendD': 'العب تحدي صديق',
  'badge.scholar': 'متعلّم', 'badge.scholarD': 'أكمل كل دروس مسار تعليمي',
  'badge.rain': 'سيد المطر', "badge.rainD": "اجتز مرحلة زعيم 👑 في الرحلة",

  'm.journey1': 'أكمل مرحلة في الرحلة', 'm.correct20': 'أجب {g} إجابة صحيحة', 'm.acc90': 'دقة 90% في جولة من 10 أسئلة+',
  'm.streak8': 'حقّق سلسلة 8 إجابات', "m.time1": "أكمل تحدّي الوقت", 'm.weak10': 'أجب 10 صحيحة في {op}',
  'm.daily1': 'أكمل التحدي اليومي', 'm.rounds3': 'العب 3 جولات',

  'theme.rain': 'ليل المطر', 'theme.dawn': 'الفجر (فاتح)', 'theme.oasis': 'الواحة', 'theme.sunset': 'الغروب', 'theme.aurora': 'الشفق', 'theme.gold': 'الذهبي',
  'skin.ember': 'جمر', 'skin.lime': 'ليموني', 'skin.glacier': 'جليدي', 'skin.neon': 'نيون', 'skin.season': 'ذهب الموسم', 'acc.halo': 'هالة', 'acc.star': 'نجمة الموسم',
  'skin.sky': 'سماوي', 'skin.mint': 'نعناعي', 'skin.rose': 'وردي', 'skin.violet': 'بنفسجي', 'skin.sun': 'شمسي', 'skin.night': 'ليلي',
  'acc.none': 'بلا', 'acc.cap': 'قبعة', 'acc.sparkle': 'لمعة', 'acc.phones': 'سماعات', 'acc.crown': 'تاج', 'acc.scarf': 'وشاح',

  'set.title': 'الإعدادات', 'set.language': 'اللغة', 'set.digits': 'شكل الأرقام', 'set.sfx': 'المؤثرات الصوتية', 'set.sfxVol': 'مستوى المؤثرات', 'set.music': 'الموسيقى',
  'set.haptics': 'الاهتزاز', 'set.hapticsNA': 'غير مدعوم على هذا الجهاز', 'set.motion': 'الحركة والمؤثرات',
  'set.motionSystem': 'حسب الجهاز', 'set.motionReduce': 'مخفّفة', 'set.motionFull': 'كاملة', 'set.contrast': 'تباين عالٍ',
  'set.bigText': 'خط أكبر', 'set.autoSubmit': 'قبول تلقائي', 'set.autoSubmitSub': 'تُقبل الإجابة الصحيحة فور كتابتها دون ضغط «تحقّق»',
  'set.tutorial': 'إعادة الشرح التفاعلي', 'set.profiles': 'الملفات الشخصية', 'set.data': 'البيانات والحفظ',
  'set.dataNote': 'يُحفظ تقدّمك تلقائيًا على هذا الجهاز وفي هذا المتصفح فقط — لا توجد مزامنة سحابية. مسح بيانات المتصفح يحذفه؛ استخدم «تصدير نسخة» للاحتفاظ به أو نقله.',
  'set.dataNoPersist': 'تنبيه: المتصفح يمنع الحفظ الدائم حاليًا (مثل التصفح الخاص)، فسيضيع التقدّم عند الإغلاق.',
  'set.export': 'تصدير نسخة', 'set.import': 'استيراد نسخة', 'set.importOk': 'تمت الاستعادة بنجاح', 'set.importBad': 'الملف غير صالح',
  'set.importConfirm': 'استيراد النسخة سيستبدل تقدّم الملف الحالي. متابعة؟',
  'set.reset': 'مسح تقدّم هذا الملف', 'set.resetConfirm': 'سيُحذف كل التقدّم والإحصاءات لهذا الملف نهائيًا. متأكد؟', 'set.resetDone': 'تم المسح',
  'set.about': 'حول اللعبة', 'set.credits': 'الخطوط: Baloo Bhaijaan 2 و Tajawal (رخصة SIL OFL 1.1). الأصوات والموسيقى مولّدة برمجيًا، والرسوم أصلية.',
  'set.name': 'اسمك في اللعبة', 'set.namePh': 'اكتب اسمك', 'set.accessibility': 'سهولة الاستخدام', 'set.sound': 'الصوت',
  'set.general': 'عام', 'set.version': 'الإصدار {v}',

  'prof.title': 'الملفات الشخصية', 'prof.current': 'الحالي', 'prof.switch': 'تبديل', 'prof.add': 'إضافة لاعب',
  'prof.name': 'الاسم', 'prof.pass': 'كلمة مرور (اختيارية)', 'prof.passHint': 'تمنع الآخرين من اللعب بملفك على هذا الجهاز فقط، وليست حماية أمنية قوية.',
  'prof.create': 'إنشاء', 'prof.delete': 'حذف', 'prof.deleteConfirm': 'حذف ملف «{name}» وكل تقدّمه نهائيًا؟',
  'prof.unlockTitle': 'ملف محمي', 'prof.unlock': 'دخول', 'prof.enterPass': 'أدخل كلمة المرور لملف «{name}»', 'prof.wrongPass': 'كلمة المرور غير صحيحة',
  'prof.remember': 'تذكّرني على هذا الجهاز 30 يومًا', 'prof.lock': 'قفل الملف', 'prof.player': 'لاعب', 'prof.migrated': 'نُقلت بيانات {n} لاعب من النسخة السابقة ✓',
  'prof.other': 'لاعب آخر', 'prof.protected': 'محمي', 'prof.tooShort': 'كلمة المرور قصيرة (4 خانات على الأقل)', 'prof.needName': 'اكتب اسمًا',

  'setup.difficulty': 'الصعوبة', 'diff.easy': 'سهل', 'diff.medium': 'متوسط', 'diff.hard': 'صعب', 'diff.expert': 'خبير',
  'setup.duration': 'المدة', 'setup.record': 'رقمك القياسي: {n}', 'setup.noRecord': 'لا يوجد رقم قياسي بعد — سجّل أول رقم!',
  'setup.timeRules': 'كل إجابة صحيحة تزيد نقاطك، والسرعة والسلسلة تضيفان مكافأة. الخطأ لا يخصم نقاطًا. الأسئلة تصعب تدريجيًا.',
  'setup.survRules': 'لديك 3 محاولات. الخطأ أو انتهاء وقت السؤال يكلّفك محاولة. وقت السؤال يبدأ من {s} ثانية ويقصر مع كل إجابة صحيحة.',
  'setup.pauseRule': 'عند الإيقاف أو الخروج من التطبيق يتوقف المؤقت ويُستبدل السؤال بسؤال مكافئ.',

  'pr.custom': 'تدريب مخصّص', 'pr.lessons': 'دروس المنهج', 'pr.topics': 'العمليات', 'pr.level': 'المستوى', 'pr.auto': 'تلقائي',
  'pr.autoSub': 'يتكيّف مع أدائك', 'pr.format': 'شكل السؤال', 'pr.timer': 'مؤقت لكل سؤال (20 ث)', 'pr.length': 'طول الجولة', 'pr.endless': 'مفتوح',
  'pr.noTopic': 'اختر عملية واحدة على الأقل', 'pr.policyTitle': 'ماذا يعني المستوى {n}؟',
  'pol.add': 'الجمع والطرح بأعداد بين {a} و{b}', 'pol.mul': 'الضرب: عوامل حتى {a} × {b}', 'pol.div': 'القسمة على أعداد من {a} إلى {b} بلا باقٍ',
  'pol.neg.none': 'بلا أعداد سالبة', 'pol.neg.sub': 'قد يكون ناتج الطرح سالبًا', 'pol.neg.add-sub': 'أعداد سالبة في الجمع والطرح',
  'pol.int': 'كل الإجابات أعداد صحيحة — لا كسور عشرية ولا تقريب.', 'pol.special': 'الكسور: «كسر من عدد» بناتج صحيح دائمًا. النسب: نسب شائعة بناتج صحيح.',

  'les.stars': '★ {a}/{b}', 'les.lockedPath': 'أكمل نصف «{name}» أولًا', 'les.count': '{n} دروس',
  'les.rule': 'النجوم بالدقة: ★ 65% · ★★ 80% · ★★★ 95% — بلا مؤقت، ومع شرح بعد كل خطأ.', 'les.locked': 'اجتز الدرس السابق أولًا',

  'jr.title': 'رحلة المستويات', 'jr.stars': '{a}/{b}', 'jr.worldN': 'العالم {n}',
  'jr.kind.classic': 'أجب عن {n} أسئلة بدقة 70% أو أكثر', 'jr.kind.sprint': '{g} إجابات صحيحة خلال {s} ثانية',
  'jr.kind.boss': 'مرحلة الزعيم: {n} سؤالًا و3 محاولات فقط',
  'jr.rule.classic': '★ 70% · ★★ 85% · ★★★ 95% دقة', 'jr.rule.sprint': 'النجوم حسب الوقت المتبقي: ★★★ 40% · ★★ 20%',
  'jr.rule.boss': 'النجوم = عدد المحاولات المتبقية', 'jr.play': 'ابدأ المرحلة', 'jr.unlockHint': 'اجتز المرحلة السابقة لفتحها',
  'jr.lockedWorld': 'اجتز مرحلة الزعيم في العالم السابق', 'jr.levelN': 'المرحلة {n}', 'jr.best': 'أفضل نتيجة: {n}',
  'jr.kindName.classic': 'دقة', 'jr.kindName.sprint': 'سرعة', 'jr.kindName.boss': 'زعيم',

  'fr.p1': 'اللاعب الأول', 'fr.p2': 'اللاعب الثاني', 'fr.p1Def': 'لاعب 1', 'fr.p2Def': 'لاعب 2', 'fr.count': 'عدد الأسئلة',
  'fr.layout': 'طريقة اللعب', 'fr.turns': 'بالتناوب', 'fr.turnsSub': 'كل لاعب يلعب دوره ثم يمرّر الجهاز', 'fr.split': 'وجهًا لوجه',
  'fr.splitSub': 'شاشة مقسومة، كلاكما في الوقت نفسه', 'fr.equal': 'لكل لاعب أسئلة مختلفة الأرقام لكنها متكافئة تمامًا في العملية والصعوبة والشكل — فلا فائدة من مشاهدة أسئلة الآخر.',
  'fr.turnOf': 'دور {name}', 'fr.handTo': 'سلّم الجهاز إلى {name}', 'fr.ready': 'أنا جاهز', 'fr.scoreToBeat': 'النتيجة التي يجب تجاوزها: {n}',
  'fr.splitHint': 'على لوحة المفاتيح: اللاعب السفلي 1–4 · اللاعب العلوي 7، 8، 9، 0', 'fr.done': 'انتهيت! انتظر صديقك', 'fr.vs': 'ضد',
  'fr.tiebreak': 'عند التساوي في النقاط يفوز الأكثر إجابات صحيحة ثم الأسرع.',

  'rain.pops': '{a}/{b}', 'rain.hint': 'اكتب ناتج أي قطرة — تنفجر عند كتابة الإجابة الصحيحة. إذا تشابهت البدايات اضغط ✓.',
  'rain.rules': 'فجّر {n} قطرة قبل أن تفقد محاولاتك الثلاث. كلما فجّرتها أعلى كانت نقاطها أكثر.',

  'tut.skip': 'تخطَّ الشرح', 'tut.1': 'أهلًا، أنا «قطرة»! سأريك اللعب في ثلاث خطوات سريعة.',
  'tut.2': 'اكتب الناتج بلوحة الأرقام ثم اضغط «تحقّق». جرّب الآن!', 'tut.3': 'أحيانًا تختار الإجابة من بين خيارات. اختر الصحيحة!',
  'tut.4': 'وأحيانًا تبحث عن العدد المفقود في المعادلة.', 'tut.oops': 'لا بأس! الإجابة الصحيحة {a}. جرّب التالي.',
  'tut.done': 'أحسنت! الإجابات المتتالية تصنع سلسلة ترفع نقاطك. هيا إلى المرحلة الأولى!', 'tut.go': 'هيا نلعب',

  'ex.make10': 'أكمل العشرة: {a} + {need} = 10، ثم 10 + {rest} = {c}',
  'ex.addSplit': 'اجمع العشرات ثم الآحاد: {tens} + {ones} = {c}',
  'ex.addCheck': '{e} — تحقّق: {back}', 'ex.subCheck': '{e} — تحقّق بالجمع: {back}',
  'ex.subNeg': '{e} — المطروح أكبر من المطروح منه بـ {d}، فالناتج سالب',
  'ex.mulSplit': 'جزّئ العدد: {s} = {v}', 'ex.mulGroups': '{e} — أي {a} مجموعات في كل منها {b}',
  'ex.divCheck': '{e} — لأن {back}', 'ex.missing': 'استخدم العملية العكسية: {e}',
  'ex.compare': 'الأيسر: {l} · الأيمن: {r} ← {rel}', 'rel.left': 'الأيسر أكبر', 'rel.right': 'الأيمن أكبر', 'rel.equal': 'متساويان',
  'ex.frac1': 'اقسم على المقام: {e}', 'ex.fracN': 'اقسم على المقام ثم اضرب في البسط: {e1} ثم {e2}',
  'ex.pct': 'اضرب ثم اقسم على 100: {e}', 'ex.pow': '{e}', 'ex.root': 'لأن {e}', 'ex.order': 'الأقواس أولًا: {i} ثم {o}', 'ex.count': 'عُدّها واحدًا واحدًا: {x}',

  'a11y.correctAnswer': 'إجابة صحيحة', 'a11y.wrongAnswer': 'إجابة خاطئة', 'a11y.menu': 'القائمة', 'a11y.stars': '{n} من 3 نجوم',
  'a11y.lives': '{n} محاولات متبقية', 'a11y.timer': 'متبقٍّ {n} ثانية', 'a11y.expr': 'المسألة',
  'rtut.1': 'هذه قطرة تحمل مسألة. اكتب ناتجها قبل أن تصل إلى الأرض!', 'rtut.2': 'رائع! القطرة تنفجر وحدها لحظة كتابة الرقم الصحيح.',
  'rtut.3': 'كلما فجّرتها أعلى زادت نقاطك، والإجابات المتتالية تضاعفها.', 'rtut.4': 'أحسنت! في المراحل لا تدع القطرات تسقط — لديك 3 قلوب.',
  'rain.pausedNote': 'القطرات مخفية أثناء الإيقاف.', 'rain.ruleClassic': 'فجّر {n} قطرة قبل أن تفقد قلوبك الثلاثة.', 'rain.ruleSprint': 'فجّر {n} قطرة قبل نفاد الوقت.',
      'rain.specials': "قطرات خاصة: ⭐ ضعف النقاط · ❄️ تبطئ المطر 5 ثوانٍ · ⚡ تفجّر كل القطرات الظاهرة · 🎁 مفاجأة نقاط وهدية.",
  'jrr.classic': 'فجّر {n} قطرة دون أن تفقد قلوبك الثلاثة', 'jrr.sprint': 'فجّر {n} قطرة خلال {s} ثانية', 'jrr.boss': 'الزعيم: {n} قطرة مع قطرات خاصة',
  'jrr.rule.hearts': 'النجوم = القلوب المتبقية (★★★ بلا أي قطرة ساقطة)', 'jrr.rule.sprint': 'النجوم حسب الوقت المتبقي: ★★★ 35% · ★★ 15%',














  "net.loading": "جارٍ الاتصال…",





























































  "shop.title": "المتجر",
  "shop.sub": "ادعم اللعبة واحصل على مظاهر مميزة",

  "shop.appOnly": "المتجر في تطبيق Android",
  "shop.appOnlyBody": "المشتريات متاحة عبر Google Play في تطبيق Android. اللعبة كاملة مجانية هنا أيضًا.",
  "shop.unavailable": "تعذّر الوصول إلى Google Play الآن. حاول لاحقًا.",
  "shop.best": "الأفضل قيمة",
  "shop.owned": "مملوك ✓",
  "shop.thanks": "شكرًا لدعمك! 💙",
  "shop.pending": "عملية الدفع قيد المعالجة — ستُفعّل تلقائيًا عند اكتمالها.",
  "shop.failed": "تعذّرت العملية. لم يُخصم شيء إن لم تكتمل.",
  "shop.restore": "استرجاع المشتريات",
  "shop.restored": "تم استرجاع مشترياتك",
  "shop.fair": "كل المشتريات زينة وراحة فقط: لا تمنح أي أفضلية في النقاط أو لوحات الصدارة.",
  "shop.needShop": "من المتجر",

  "shop.p.pro_bundle": "الباقة الكاملة",
  "shop.p.pro_bundleD": "بلا إعلانات بينية + كل مظاهر المتجر (٤ ألوان وهالة) — مرة واحدة للأبد.",
  "shop.p.remove_ads": "إزالة الإعلانات",
  "shop.p.remove_adsD": "لا إعلانات بين الجولات للأبد. تبقى إعلانات المكافأة اختيارية لمن يريد.",
  "shop.p.skins_pack": "مجموعة ألوان المطر",
  "shop.p.skins_packD": "جمر، ليموني، جليدي، نيون + هالة — تلوّن شخصيتك وقطراتك داخل اللعب.",

  "ads.reviveTitle": "فرصة ثانية؟",
  "ads.reviveBody": "شاهد إعلانًا قصيرًا وأكمل بقلب إضافي — تُزال القطرات القريبة من الأرض.",
  "ads.reviveYes": "شاهد وأكمل",
  "ads.reviveNo": "لا، أنهِ الجولة",
  "ads.doubleXp": "ضاعف الخبرة (+{n})",
  "ads.doubled": "تمت المضاعفة: +{n} خبرة",
  "ads.privacy": "خيارات خصوصية الإعلانات",




























  "mode.custom": "تحدّيك الخاص",
  "mode.customSub": "الوقت · البقاء · تخصيص",
  "cus.ops": "العمليات",
  "cus.oneOp": "اختر عملية واحدة على الأقل",
  "cus.level": "صعوبة الأرقام",
  "cus.speedLabel": "سرعة القطرات",
  "cus.speed.slow": "بطيئة",
  "cus.speed.normal": "عادية",
  "cus.speed.fast": "سريعة",
  "cus.speed.veryfast": "سريعة جدًا",
  "cus.speed.insane": "جنونية",
          "cus.accel": "تتسارع القطرات مع الوقت",
  "cus.accelSub": "كل ١٠ ثوانٍ تصبح أسرع — تحدٍّ حقيقي لنفسك",
  "cus.done": "فجّرت {n} قطرة!",
  "rain.faster": "⚡ أسرع!",
  "app.exitHint": "اضغط رجوع مرة أخرى للخروج",
  "ch.time": "تحدّي الوقت",
  "ch.survival": "البقاء",
  "ch.custom": "تخصيص",
  "ch.timeSub": "أكثر إجابات صحيحة قبل انتهاء الوقت",
  "ch.survivalSub": "٣ محاولات، بلا وقت — اصمد",
  "ch.customSub": "اختر كل شيء بنفسك",
  "ch.noLimit": "بلا حد",
  "ch.livesN": "{n} محاولات",
  "ch.unlimited": "غير محدودة",
  "ch.conflictFixed": "عدّلنا الخيار الآخر: جولة بلا وقت وبلا حد للمحاولات لا تنتهي",
  "ch.duration": "مدة الجولة",
  "ch.lives": "المحاولات",
  "ch.speedHint": "سرعة السقوط = كم تستغرق القطرة حتى تصل الأرض (من البداية)",
  "ch.durationHint": "المدة = طول الجولة كلها، لا وقت السؤال الواحد",
  "ch.livesHint": "كل قطرة تصل الأرض تُفقدك محاولة",
  "ch.rule.speed20": "{n} سؤالًا أو أكثر، دقة {acc}٪ فأكثر، ومتوسط إجابة {s} ث أو أقل",
  "ch.rule.survive25": "{n} إجابة صحيحة بقواعد البقاء (بلا وقت، ٣ محاولات أو أقل)",
  "ch.badgeOwned": "✓ حصلت عليها",
  "ch.eligible": "✓ هذه الإعدادات مؤهلة",
  "ch.notEligible.revived": "✗ الفرصة الثانية تُلغي الشرط",
  "ch.notEligible.level": "✗ تحتاج صعوبة «متوسط» فأعلى",
  "ch.notEligible.speed": "✗ تحتاج سرعة «عادية» فأعلى",
  "ch.notEligible.rules": "✗ تحتاج قواعد البقاء: بلا وقت و٣ محاولات أو أقل",
  "ch.rules.time": "{s} ثانية · بلا محاولات محدودة · المطر يشتد كلما أصبت",
  "ch.rules.survival": "بلا وقت · {n} محاولات · كل قطرة تسقط تُفقدك محاولة، والمطر يشتد تدريجيًا",
  "ch.rules.custom": "حسب إعداداتك: تنتهي الجولة بانتهاء المدة أو نفاد المحاولات — أيهما أولًا",
  "ch.recordRule": "الرقم = أكثر إجابات صحيحة، والتعادل بالنقاط (لكل إعداد رقمه)",
  "ch.rewardsTitle": "المكافآت وشروطها",
  "ch.missionRule": "تُحتسب المهمة عند إكمال الجولة بقاعدتها (انتهاء الوقت أو المحاولات) مع {n} إجابات صحيحة على الأقل. الخروج المبكر لا يُحتسب.",
  "ch.helpTitle": "ما الفرق بين السرعة والمدة والتسارع والتيربو؟",
  "ch.help": "سرعة السقوط: كم تستغرق القطرة لتصل الأرض من البداية.|المدة: طول الجولة كلها (لا يوجد مؤقت لكل سؤال).|التسارع: يقصّر زمن السقوط ٨٪ كل ١٠ ثوانٍ.|الوقت والبقاء: المطر يشتد مع كل عدد من الإجابات بدل التسارع الزمني — لا يجتمعان.|التيربو ⚡ خاص بالرحلة فقط: تسارع أقوى بأرقام آحاد، ولا يُطبَّق هنا.",
  "ch.start": "ابدأ {m}",
  "ch.revivedNote": "استخدمت فرصة ثانية: لا تُحتسب هذه الجولة في الرقم القياسي ولا في شارتَي البرق والصامد",
  "ch.notCompleted": "الجولة لم تُكمَل لحساب المهام: تحتاج {n} إجابات صحيحة على الأقل",
  "m.survive1": "أكمل تحدّي البقاء",
  "m.custom1": "أكمل تحدّيًا مخصّصًا",

  "m.friend1": "أكمل تحدّي صديق",
  "mr.journey1": "اجتز أي مرحلة في الرحلة",
  "mr.correct20": "مجموع إجاباتك الصحيحة اليوم في أي نمط",
  "mr.acc90": "جولة من ١٠ أسئلة فأكثر بدقة ٩٠٪",
  "mr.streak8": "٨ إجابات صحيحة متتالية في جولة واحدة",
  "mr.weak10": "تمرين عمليتك الأضعف",
  "mr.daily1": "المحاولة الرسمية لتحدي اليوم",
  "mr.rounds3": "أي جولة تنتهي وتُسجَّل نتيجتها",
  "mr.time1": "حتى ينتهي الوقت، مع {n} إجابات صحيحة على الأقل",
  "mr.survive1": "حتى تنفد المحاولات، مع {n} إجابات صحيحة على الأقل",
  "mr.custom1": "أي إعداد مخصّص، تنتهي بقاعدتها مع {n} إجابات صحيحة",

  "mr.friend1": "أرسل تحدّيًا لصديق، أو العب تحدّيًا وصلك، أو العب مع صديق على نفس الجوال",
  "lock.prog.speed20": "أفضل محاولة: {a}/{n} سؤالًا · دقة {acc}٪ · متوسط {s} ث",
  "lock.prog.survive25": "أفضل محاولة: {a}/{n} صحيحة",
  "lock.prog.none": "لا محاولة مؤهلة بعد — اضغط للبدء",
  "prog.recordCustom": "أفضل تحدٍّ مخصّص",
  "res.leftTitle": "المتبقي لك",
  "set.notify": "التذكيرات",
  "set.notifySub": "سلسلة الأيام وتحديات أصدقائك المنتظرة",
  "set.notifyDenied": "الإذن مرفوض — فعّل الإشعارات من إعدادات الجوال",




  "notif.streak": "سلسلتك {n} يومًا في خطر 🔥 العب تحدّي اليوم",
  "notif.daily": "تحدّي اليوم بانتظارك 💧",
  "notif.friends": "لديك {n} من تحديات أصدقائك لم تلعبها بعد ⚔️",









  "home.bestSpeed": "أعلى سرعة",



















  "wal.earned": "لآلئ مكتسبة",
  "wal.boosted": "خبرة مضاعفة +{n}",
  "wal.balance": "لآلئك",
  "wal.gotFree": "+{n} لؤلؤة 💎",
  "wal.free": "+{n} مجانًا ({left} متبقية اليوم)",
  "wal.notEnough": "لآلئك لا تكفي — اجمع المزيد أو اشترِ حزمة",
  "wal.cannot": "وصلت إلى الحد الأقصى",
  "wal.bought": "تم ✓",
  "wal.spendTitle": "استخدم لآلئك",
  "wal.shieldD": "يحمي سلسلة أيامك إن فاتك يوم ({n}/{m})",
  "wal.boost": "خبرة مضاعفة",
  "wal.boostD": "لمدة {n} جولات (المتبقي لديك: {left})",
  "wal.revive": "فرصة ثانية",
  "wal.reviveD": "عند نفاد القلوب، بلا إعلان",
  "wal.skins": "مظاهر مميزة (واحدًا واحدًا)",
  "wal.gotPack": "وصلتك {n} لؤلؤة 💎 — شكرًا لدعمك!",
  "wal.pearls": "لؤلؤة",
  "wal.buyPearls": "حزم اللآلئ",
  "wal.reviveBtn": "أكمل مقابل {n} لؤلؤة (لديك {b})",
  "shop.once": "عرض لمرة واحدة",
  "shop.popular": "الأكثر شراءً",
  "shop.bonus": "+{n}% هدية",
  "shop.permanent": "مشتريات دائمة",
  "shop.p.starter_pack": "حزمة البداية",
  "shop.p.starter_packD": "بلا إعلانات للأبد + {n} لؤلؤة 💎 — أفضل قيمة",
  "cus.range.easy": "أرقام آحاد: جمع وطرح من 1 إلى 9، وضرب وقسمة حتى 5×5",
  "cus.range.medium": "جمع وطرح حتى 15، وضرب وقسمة حتى 5×10",
  "cus.range.hard": "جمع وطرح حتى 30، وضرب وقسمة حتى 10×10",
  "cus.range.expert": "جمع وطرح حتى 99، وضرب وقسمة حتى 12×12",
  "turbo.title": "تيربو",
  "turbo.sub": "في الرحلة فقط: تسارع مرعب بأرقام آحاد",
  "shield.count": "{n} دروع",
  "shield.title": "درع السلسلة",
  "shield.sub": "يحمي سلسلة التحدي اليومي إن فاتك يوم. تكسبه من القطرة الغامضة 🎁 أو بإعلان.",
  "shield.saving": "درعك سيحمي سلسلتك اليوم ({n})",
  "shield.watch": "احصل على درع",
  "shield.got": "حصلت على درع 🛡️",
  "shield.one": "درع سلسلة",
  "rain.speedA11y": "السرعة الحالية",
  "rain.recordBroken": "رقم قياسي!",
  "rain.newRecordLive": "🏆 كسرت رقمك!",
  "rain.fasterX": "⚡ أسرع! {x}",
  "rain.fever": "🔥 حمّى! النقاط ×2",
  "rain.gift": "🎁 مفاجأة +{n}",
  "res.nearJourney": "كدت تنجح! باقي {n} قطرة فقط — جرّب مرة أخرى",
  "res.nearMiss": "كدت تكسر رقمك! كان يكفيك {n} قطرة — مرة أخرى؟",
  "res.speedTier.0": "سرعة عادية",
  "res.speedTier.1": "سرعة برونزية",
  "res.speedTier.2": "سرعة فضية",
  "res.speedTier.3": "سرعة ذهبية",
  "res.speedTier.4": "سرعة ماسية",
  "res.speedBest": "أعلى سرعة وصلتها على الإطلاق!",
  "res.speedPrev": "أعلى سرعة لك: {x}",

  "badge.fever": "حمّى",
  "badge.feverD": "ادخل وضع الحمّى بـ10 إجابات متتالية",
  "badge.gift": "مفاجأة",
  "badge.giftD": "افتح قطرة غامضة 🎁",
  "badge.speedx2": "سرعة مضاعفة",
  "badge.speedx2D": "اصمد حتى سرعة ×2",
  "badge.speedx3": "سرعة الضوء",
  "badge.speedx3D": "اصمد حتى سرعة ×3",
  "badge.turbo": "تيربو",
  "badge.turboD": "اجتز مرحلة في الرحلة والتيربو مفعّل",
  "share.title": "شارك",


  "share.daily": "شارك نتيجتك",
  "share.dailyTitle": "تحدي قطرة 💧 اليومي #{n}",
  "share.dailyLine": "{drops} قطرة · دقة {acc}٪ · {score} نقطة",
  "share.challenge": "تحدَّ صديقًا بنفس القطرات",
  "share.challengeHot": "تحدَّ صديقك: هل يتجاوز {n}؟",

  "share.copied": "نُسخ النص — الصقه في أي محادثة",
  "share.failed": "تعذّرت المشاركة",
  "share.getApp": "حمّل التطبيق من Google Play",
  "share.getAppSub": "لعب أسرع، إنجازات، وتقدّمك محفوظ",




  // الأصدقاء بلا خادم
  "nav.friends": "الأصدقاء",
  "fr2.title": "الأصدقاء",
  "fr2.sub": "تحدٍّ برمز · غرفة على نفس الجوال",
  "fr2.challenge": "تحدَّ صديقًا",
  "fr2.challengeSub": "العب ثم أرسل رمزك في واتساب — يلعب نفس قطراتك",
  "fr2.face": "وجهًا لوجه",
  "fr2.faceSub": "لاعبان في الوقت نفسه على شاشة مقسومة",
  "fr2.record": "حصيلتك مع أصدقائك",
  "fr2.empty": "تحدَّ صديقًا أو أدخل رمزًا لتبدأ حصيلتك.",
  "fr2.wld": "فوز {w} · خسارة {l} · تعادل {d}",
  "fr2.composeSub": "اختر التحدي ثم العب أولًا",
  "fr2.tabCustom": "تخصيص",
  "fr2.tabLevel": "مرحلة",
  "fr2.how": "تلعب أنت أولًا، ثم تحصل على رمز ترسله لصديقك ليلعب نفس القطرات بالضبط.",
  "fr2.playFirst": "العب ثم أرسل",
  "fr2.pickLevel": "اختر مرحلة فتحتها",
  "code.howTo": "افتح «تحدي قطرة» ← الأصدقاء ← أدخل الرمز",
  "code.share": "شارك الرمز",
  "code.copy": "نسخ",
  "code.enter": "أدخل رمزًا وصلك",
  "code.enterShort": "أدخل رمزًا",
  "code.enterSub": "الصق رسالة صديقك كاملة أو الرمز وحده — يبدأ الرمز بـ ⁦QC⁩ أو ⁦QR⁩.",
  "code.paste": "لصق",
  "code.pasteFail": "تعذّر اللصق — الصق الرمز يدويًا",
  "code.open": "افتح الرمز",
  "code.bad": "الرمز غير صحيح أو ناقص. تأكد أنك نسخته كاملًا.",
  "code.own": "هذا رمز تحدّيك أنت — أرسله لصديقك!",
  "code.fromX": "تحدٍّ من {name}",
  "code.beat": "تجاوز {n} نقطة",
  "code.play": "العب",
  "code.again": "مرة أخرى",
  "code.unknown": "رمز النتيجة هذا لتحدٍّ لم يُرسل من هذا الملف.",
  "code.res.win": "فزت على {name}!",
  "code.res.lose": "{name} فاز عليك!",
  "code.res.draw": "تعادل مع {name}",
  "code.vs.win": "فزت على {name}!",
  "code.vs.lose": "لم تتجاوز {name} هذه المرة",
  "code.vs.draw": "تعادلت مع {name}",
  "code.received": "تحديات وصلتك",
  "code.sent": "تحدياتك المرسلة",
  "code.yourScore": "نتيجتك {n}",
  "code.waiting": "بانتظار رمز نتيجة صديقك",
  "code.inviteText": "⚔️ تحدّيتك في «تحدي قطرة»! حققت {n} نقطة في {label}. تقدر تتجاوزني بنفس القطرات؟",
  "code.yourCode": "رمز تحدّيك",
  "code.afterShare": "عندما يلعب صديقك يرسل لك رمز نتيجته — أدخله في «الأصدقاء» لتعرف من فاز.",
  "code.sendBack": "أرسل نتيجتك إلى {name}",
  "code.resultText": "🏁 لعبت تحدّيك يا {name} وحققت {n} نقطة! أدخل هذا الرمز لتعرف من فاز:",
  "pgs.title": "Google Play Games",
  "pgs.sub": "لوحات الصدارة العالمية وبين أصدقائك، والإنجازات.",
  "pgs.lb": "لوحات الصدارة",
  "pgs.ach": "الإنجازات",
  "party.title": "غرفة على نفس الجوال",
  "party.sub": "من 2 إلى 6 لاعبين بالتناوب",
  "party.pN": "لاعب {n}",
  "party.remove": "حذف اللاعب",
  "party.add": "أضف لاعبًا",
  "party.players": "اللاعبون",
  "party.rules": "قواعد الجولة",
  "party.how": "كل لاعب يلعب دوره على نفس القطرات ويرى شبح من سبقه. الأعلى نقاطًا يفوز.",
  "party.prev": "{name} حقق {n}",
  "party.turnN": "الدور {a} من {b}",
  "party.endTitle": "إنهاء الغرفة؟",
  "party.endBody": "ستضيع نتائج هذه الجولة.",
  "party.end": "إنهاء الغرفة",
  "party.tiebreak": "عند التعادل في النقاط: الأكثر قطرات.",
  "party.again": "جولة جديدة",
  "party.quitBody": "سينتهي دورك بنتيجتك الحالية.",
  "home.friendsAll": "الكل",
  "home.challengeSub": "نفس القطرات برمز",
  "home.codeSub": "تحدٍّ أو نتيجة",
  "home.partySub": "2–6 لاعبين",
  "err.screen": "تعذّر فتح هذه الشاشة — عدنا بأمان. سجّلنا المشكلة في الإعدادات.",
  "set.errors": "سجل المشكلات",
  "set.errorsSub": "إن واجهت مشكلة، انسخ السجل وأرسله لنا لنصلحها. لا يُرسل شيء تلقائيًا.",
  "set.errorsNone": "لا توجد مشكلات مسجّلة 👍",
  "set.errorsCopy": "نسخ السجل",
  "set.errorsClear": "مسح",
  "resume.now": "الآن",
  "resume.min": "قبل {n} د",
  "resume.hour": "قبل {n} س",
  "resume.day": "قبل {n} يوم",
  "nav.shop": "المتجر",
  "home.dailyShort": "مرة كل يوم",
  "home.customShort": "الوقت · البقاء · تخصيص",
  "home.missionsReward": "كل مهمة تمنحك لآلئ وخبرة.",
  "set.more": "المزيد",
  "res.challengeShort": "تحدَّ صديقًا",
  "shop.tabBuy": "اشترِ",
  "shop.tabSpend": "استخدم لآلئك",
  "shop.buying": "جارٍ الشراء…",
  "shop.successTitle": "تم الشراء بنجاح!",
  "shop.great": "رائع!",
  "menu.levels": "المراحل",
  "menu.challenges": "التحديات",
  "menu.how": "كيف تلعب",
  "how.1t": "معادلات تسقط",
  "how.1d": "كل قطرة تحمل مسألة حساب سريعة.",
  "how.2t": "اكتب الناتج",
  "how.2d": "تنفجر القطرة فورًا عند الإجابة الصحيحة — لا حاجة لزر.",
  "how.3t": "لا تدعها تصل الماء",
  "how.3d": "كل قطرة تسقط تُفقدك قلبًا ❤️ — لديك ٣.",
  "how.4t": "اصنع سلسلة",
  "how.4d": "الإجابات المتتالية تضاعف النقاط 🔥 والقطرات الخاصة 🎁⭐❄️ تمنحك مفاجآت.",
  "how.try": "جرّب الشرح التفاعلي",
  "how.ok": "فهمت!",
  "shop.notReadyT": "الأسعار غير متاحة الآن",
  "shop.notReadyD": "الشراء يعمل عند تثبيت اللعبة من Google Play وبعد تفعيل المنتجات. تأكد من الاتصال ثم أعد المحاولة.",
  "net.retry2": "أعد المحاولة",
  "ch.quickTime": "{n} ثانية — ابدأ فورًا",
  "ch.customize": "تخصيص التحدي",
};

const en = {
  'app.tagline': 'Beat the numbers, break your record',
  'mascot.name': 'Qatra',
  'nav.home': 'Home', 'nav.journey': 'Journey', 'nav.progress': 'Progress', 'nav.locker': 'Locker', 'nav.settings': 'Settings',
  'app.name': 'Qatra Challenge', 'common.close': 'Close', 'common.cancel': 'Cancel', 'common.confirm': 'Confirm', 'common.back': 'Back', 'common.save': 'Save',
  'common.sec': '{n}s', 'common.secLong': '{n} seconds', 'common.start': 'Start', 'common.ok': 'OK', 'common.new': 'New',
  'common.locked': 'Locked', 'common.min': '{n} min',

  'home.hello': 'Hi {name}!', 'home.helloAnon': 'Welcome!', 'home.play': 'Play now',
  'home.playSub': 'Level {n} · {world}', 'home.playFirst': 'Start your journey at level 1', 'home.allDone': 'Journey complete! Polish your stars',
  'home.modes': 'Game modes', 'home.missions': "Today's missions", 'home.missionsDone': 'All missions done today 🎉',
  'home.level': 'Level {n}', 'home.xp': '{a}/{b} XP', 'home.stars': 'Stars', 'home.bestTime': 'Best minute',
  'home.streak': 'Day streak', 'home.storageWarn': 'Persistent storage is unavailable in this browser — progress will be lost when closed.',
  'home.mascotLine1': 'Ready for a new challenge?', 'home.mascotLine2': 'Every right answer brings a star closer!', 'home.mascotLine3': 'Your daily streak is waiting!',

  'daily.title': 'Daily challenge', 'daily.sub': '{n} fixed questions for today · one official attempt',
  'daily.start': "Start today's challenge", 'daily.done': 'Done today: {score} points', 'daily.practice': 'Play for practice',
  'daily.streak': '{n}-day streak', 'daily.comeBack': 'New challenge tomorrow', 'daily.practiceRun': 'Practice run — your official score stays',
  'daily.leaveNote': 'Time counts and there is no pause. If you leave mid-challenge, the shown question is skipped.',

  'mode.journey': 'Level journey', 'mode.journeySub': '100 levels across 10 worlds',
  'mode.time': 'Time attack',   'mode.survival': 'Survival',   'mode.practice': 'Free practice', 'mode.practiceSub': 'Pick operations and level · no pressure',
  'mode.friend': 'Friend challenge', 'mode.friendSub': 'Same device · equivalent questions',
  'mode.rain': 'Equation rain', 'mode.rainSub': 'Classic: pop the drops before they land',
  'mode.daily': 'Daily challenge', 'mode.lesson': 'Lesson', 'mode.tutorial': 'Tutorial',

  'world.w1': 'Light Rain', 'world.w2': 'The Cloud', 'world.w3': 'Downpour', 'world.w4': 'The Storm', 'world.w5': 'The Torrent',
  'world.w6': 'Thunder', 'world.w7': 'Tornado', 'world.w8': 'The Deluge', 'world.w9': 'Firestorm', 'world.w10': 'The Legend',
  'world.w1t': 'Add & subtract', 'world.w2t': 'Multiplication arrives', 'world.w3t': 'Division arrives', 'world.w4t': 'Comparisons', 'world.w5t': 'Brackets & missing numbers',
  'world.w6t': 'Bigger numbers', 'world.w7t': 'More variety', 'world.w8t': 'Negative results', 'world.w9t': 'Tough challenge', 'world.w10t': 'The final test',

  'op.add': 'Addition', 'op.sub': 'Subtraction', 'op.mul': 'Multiplication', 'op.div': 'Division', 'op.order': 'Brackets',
  'op.frac': 'Fractions', 'op.percent': 'Percentages', 'op.power': 'Powers & roots',

  'fmt.input': 'Type the answer', 'fmt.choice': 'Pick the right answer', 'fmt.missing': "What's the missing number?", 'fmt.compare': 'Which is bigger?',
  'fmt.count': 'How many?', 'fmt.of': 'of', 'fmt.equal': 'Equal',
  'fmtName.mixed': 'Mixed', 'fmtName.input': 'Type', 'fmtName.choice': 'Choice', 'fmtName.missing': 'Missing', 'fmtName.compare': 'Compare',

  'game.pause': 'Pause', 'game.paused': 'Paused', 'game.pausedNote': 'The question is hidden while paused; an equivalent new one appears when you resume.',
  'game.pausedKeep': 'Take a break — your question will wait.', 'game.pausedDaily': 'You left the daily challenge — the shown question was skipped. The clock is stopped now.',
  'game.resume': 'Resume', 'game.quit': 'Quit', 'game.quitTitle': 'Leave this round?',
  'game.quitBody': "This round's result and rewards won't be saved. Your answers still count in your stats.",
  'game.quitPractice': 'Practice will end and your result will be shown.', 'game.quitDaily': "Your current score becomes today's official attempt.",
  'game.keepPlaying': 'Keep playing', 'game.endNow': 'End', 'game.check': 'Check', 'game.next': 'Next',
  'game.correct': 'Correct!', 'game.wrong': 'Correct answer: {a}', 'game.timeout': "Time's up — answer: {a}",
  'game.skipped': 'Skipped because you left', 'game.streak': 'Streak {n}', 'game.lives': 'Tries',
  'game.question': 'Question {i} of {n}', 'game.questionOpen': 'Question {i}', 'game.goal': '{c} of {n} correct',
  'game.typeHere': 'Type your answer', 'game.ready': 'Get ready…', 'game.go': 'Go!', 'game.del': 'Delete', 'game.neg': 'Negative',
  'game.left': 'Left', 'game.right': 'Right', 'game.why': 'Why?', 'game.score': 'Score', 'game.timeLeft': 'Time left',
  'game.resumeTitle': 'Unfinished round', 'game.resumeBody': 'You have an unfinished “{mode}” round. Resume it?',
  'game.resumeBtn': 'Resume', 'game.discard': 'End without result', 'game.points': '+{n}',
  'game.praise': 'Excellent!|Great!|Well done!|Right!|Genius!|Champion!', 'game.streakMsg': 'Streak {n}! Points ×{m}',
  'game.hearts': '{n} tries left',

  'res.levelPassed': 'Level {n} complete!', 'res.levelFailed': 'So close! Try again', 'res.bossPassed': 'Boss defeated!',
  'res.timeUp': "Time's up!", 'res.survivalEnd': 'You survived {n} correct answers!', 'res.practiceEnd': 'Practice finished',
  'res.dailyEnd': "Today's challenge done!", 'res.lessonPassed': 'Lesson passed!', 'res.lessonFailed': 'Lesson not passed yet',
  'res.rainWin': 'You weathered the storm!', 'res.rainLose': 'The rain got you this time',
  'res.newRecord': 'New personal best!', 'res.score': 'Score', 'res.accuracy': 'Accuracy', 'res.avgTime': 'Avg. time',
  'res.bestStreak': 'Best streak', 'res.correct': 'Correct', 'res.xp': '+{n} XP', 'res.levelUp': 'You reached level {n}!',
  'res.badge': 'New badge', 'res.mission': 'Mission complete', 'res.unlock': 'New look', 'res.retry': 'Retry',
  'res.next': 'Next level', 'res.nextLesson': 'Next lesson', 'res.home': 'Home', 'res.tipTitle': 'To improve',
  'res.prevBest': 'Previous best: {n}', 'res.official': "Today's official result", 'res.practiceRun': "Practice run — official result unchanged",
  'res.winner': '{name} wins!', 'res.draw': "It's a draw!", 'res.rematch': 'Rematch', 'res.accBonus': 'Accuracy bonus +{n}',
  'res.of': '{a} of {b}', 'res.timeLeft': 'Time left', 'res.back': 'Back', 'res.rewards': 'Rewards',
  'res.passRule': 'You need at least 70% accuracy to pass', 'res.sprintRule': 'You need {n} correct answers before time runs out',
  'res.bossRule': 'Keep at least one try until the end', 'res.lessonRule': 'You need 65% accuracy to unlock the next lesson',
  'tip.accuracy': 'Take an extra second before answering — accuracy earns the stars.',
  'tip.wrongOp': 'Most mistakes this round were in {op}. A short practice will help.',
  'tip.slowOp': 'Your slowest answers were in {op}. Repeat them in free practice to speed up.',
  'tip.streak': 'Keep the streak: each consecutive right answer raises points up to ×1.5.',
  'tip.speed': 'In timed modes speed adds up to 50 bonus points per answer.',
  'tip.great': 'Great job! Try a higher difficulty for a bigger challenge.', 'tip.practiceBtn': 'Practice {op}',

  'prog.title': 'My progress', 'prog.empty': 'No data yet', 'prog.emptySub': 'Play your first round and your accuracy, speed and growth will show up here.',
  'prog.rounds': 'Rounds', 'prog.questions': 'Questions answered', 'prog.accuracy': 'Accuracy', 'prog.avgTime': 'Avg. answer time',
  'prog.bestStreak': 'Best streak', 'prog.bests': 'Best result per mode', 'prog.perOp': 'Your level per operation',
  'prog.trend': 'Last 14 days', 'prog.trendQ': 'Questions', 'prog.trendAcc': 'Accuracy', 'prog.rec': 'Recommended for you',
  'prog.how': 'How are these numbers calculated?', 'prog.practiceBtn': 'Practice now', 'prog.noRecord': '—', 'prog.levelOf': 'Level {n}/10',
  'prog.fewData': 'Small sample', 'prog.legacy': 'From the previous version: {g} rounds and {p} drops popped (not part of accuracy).',
  'prog.noPlayDay': 'No play', 'prog.today': 'Today', 'prog.recordTime': 'Time attack {d}s ({diff})', 'prog.recordSurv': 'Survival ({diff})',
  'prog.recordRain': 'Equation rain ({diff})', 'prog.recordDaily': 'Daily challenge', 'prog.journeyStars': 'Journey stars',
  'prog.correctUnit': '{n} correct', 'prog.scoreUnit': '{n} pts', 'prog.local': 'Based only on your play on this device — no global rankings.',
  'prog.def': 'Accuracy = correct answers ÷ answered questions (includes timed-out questions, excludes skipped ones).|Average answer time = from the moment a question appears until you answer, excluding pauses, timed-out questions and rain mode.|Operation level (1–10) moves up or down in small steps, only after at least 6 new answers, based on accuracy and speed over the last 8 answers.|A round counts when it is completed (or ended from practice); abandoned rounds are not counted as rounds.|Friend challenge is not included in your stats because two people play it.',
  'rec.needData': 'Answer {n} more questions and we will suggest practice based on your play.',
  'rec.accuracy': 'Your {op} accuracy is {acc}% — a short practice will raise your stars.',
  'rec.speed': 'Your {op} answers are right but take {s} seconds on average. Try time attack to speed up.',
  'rec.levelUp': 'Solid and steady! Raise your {op} level in free practice.',

  'lock.title': 'Locker', 'lock.badges': 'Badges', 'lock.looks': 'Looks', 'lock.theme': 'Theme', 'lock.skin': 'Qatra color',
  'lock.acc': 'Accessory', 'lock.needLevel': 'Level {n}', 'lock.needBadge': '“{b}” badge', 'lock.equipped': 'Equipped',
  'lock.note': "Looks are cosmetic only and never change question difficulty or points.", 'lock.earned': 'Earned {d}', 'lock.count': '{a} of {b}',

  'badge.first': 'First steps', 'badge.firstD': 'Finish your first round',
  'badge.streak10': 'Flame', 'badge.streak10D': 'A streak of 10 correct answers',
  'badge.streak25': 'Comet', 'badge.streak25D': 'A streak of 25 correct answers',
  'badge.correct100': 'Century', 'badge.correct100D': '100 correct answers',
  'badge.correct1000': 'Summit', 'badge.correct1000D': '1000 correct answers',
  'badge.perfect': 'Flawless', 'badge.perfectD': 'A round of 10+ questions with no mistakes',
  'badge.speed20': 'Lightning', "badge.speed20D": "20+ questions at 90% accuracy, avg ≤ 3s (Medium+ difficulty, no second chance)",
  'badge.survive25': 'Survivor', "badge.survive25D": "25 correct under survival rules (3 tries or fewer, Medium+, no second chance)",
  'badge.daily3': 'Regular', 'badge.daily3D': 'Daily challenge 3 days in a row',
  'badge.daily7': 'Full week', 'badge.daily7D': 'Daily challenge 7 days in a row',
  'badge.world1': 'First rain', 'badge.world1D': 'Finish the first journey world',
  'badge.world5': 'Torrent rider', 'badge.world5D': 'Finish 5 journey worlds',
  'badge.world10': 'Legend', 'badge.world10D': 'Finish the whole journey',
  'badge.allstars': 'Full sky', 'badge.allstarsD': '30 stars in a single world',
  'badge.allround': 'All-rounder', 'badge.allroundD': 'Level 5+ in all four operations',
  'badge.friend': 'Good sport', 'badge.friendD': 'Play a friend challenge',
  'badge.scholar': 'Scholar', 'badge.scholarD': 'Complete every lesson in a path',
  'badge.rain': 'Rain master', "badge.rainD": "Pass a boss 👑 level in the journey",

  'm.journey1': 'Complete a journey level', 'm.correct20': 'Answer {g} correctly', 'm.acc90': '90% accuracy in a 10+ question round',
  'm.streak8': 'Reach a streak of 8', "m.time1": "Complete a time challenge", 'm.weak10': 'Get 10 right in {op}',
  'm.daily1': 'Finish the daily challenge', 'm.rounds3': 'Play 3 rounds',

  'theme.rain': 'Rain night', 'theme.dawn': 'Dawn (light)', 'theme.oasis': 'Oasis', 'theme.sunset': 'Sunset', 'theme.aurora': 'Aurora', 'theme.gold': 'Golden',
  'skin.ember': 'Ember', 'skin.lime': 'Lime', 'skin.glacier': 'Glacier', 'skin.neon': 'Neon', 'skin.season': 'Season Gold', 'acc.halo': 'Halo', 'acc.star': 'Season Star',
  'skin.sky': 'Sky', 'skin.mint': 'Mint', 'skin.rose': 'Rose', 'skin.violet': 'Violet', 'skin.sun': 'Sunny', 'skin.night': 'Night',
  'acc.none': 'None', 'acc.cap': 'Cap', 'acc.sparkle': 'Sparkles', 'acc.phones': 'Headphones', 'acc.crown': 'Crown', 'acc.scarf': 'Scarf',

  'set.title': 'Settings', 'set.language': 'Language', 'set.digits': 'Numerals', 'set.sfx': 'Sound effects', 'set.sfxVol': 'Effects volume', 'set.music': 'Music',
  'set.haptics': 'Vibration', 'set.hapticsNA': 'Not supported on this device', 'set.motion': 'Motion & effects',
  'set.motionSystem': 'System', 'set.motionReduce': 'Reduced', 'set.motionFull': 'Full', 'set.contrast': 'High contrast',
  'set.bigText': 'Larger text', 'set.autoSubmit': 'Auto-accept', 'set.autoSubmitSub': 'A correct answer is accepted as soon as you type it',
  'set.tutorial': 'Replay the interactive tutorial', 'set.profiles': 'Profiles', 'set.data': 'Data & saving',
  'set.dataNote': 'Progress is saved automatically on this device and in this browser only — there is no cloud sync. Clearing browser data deletes it; use “Export backup” to keep or move it.',
  'set.dataNoPersist': 'Warning: this browser blocks persistent storage right now (e.g. private mode), so progress will be lost when closed.',
  'set.export': 'Export backup', 'set.import': 'Import backup', 'set.importOk': 'Backup restored', 'set.importBad': 'Invalid file',
  'set.importConfirm': "Importing will replace this profile's progress. Continue?",
  'set.reset': "Reset this profile's progress", 'set.resetConfirm': 'All progress and stats for this profile will be permanently deleted. Sure?', 'set.resetDone': 'Reset done',
  'set.about': 'About', 'set.credits': 'Fonts: Baloo Bhaijaan 2 and Tajawal (SIL OFL 1.1). Sounds and music are generated in code; artwork is original.',
  'set.name': 'Your name in the game', 'set.namePh': 'Type your name', 'set.accessibility': 'Accessibility', 'set.sound': 'Sound',
  'set.general': 'General', 'set.version': 'Version {v}',

  'prof.title': 'Profiles', 'prof.current': 'Current', 'prof.switch': 'Switch', 'prof.add': 'Add player',
  'prof.name': 'Name', 'prof.pass': 'Password (optional)', 'prof.passHint': 'Stops others from playing as you on this device only; it is not strong security.',
  'prof.create': 'Create', 'prof.delete': 'Delete', 'prof.deleteConfirm': 'Permanently delete “{name}” and all of its progress?',
  'prof.unlockTitle': 'Protected profile', 'prof.unlock': 'Enter', 'prof.enterPass': 'Enter the password for “{name}”', 'prof.wrongPass': 'Wrong password',
  'prof.remember': 'Remember me on this device for 30 days', 'prof.lock': 'Lock profile', 'prof.player': 'Player', 'prof.migrated': 'Moved {n} players from the previous version ✓',
  'prof.other': 'Another player', 'prof.protected': 'Protected', 'prof.tooShort': 'Password too short (min 4)', 'prof.needName': 'Type a name',

  'setup.difficulty': 'Difficulty', 'diff.easy': 'Easy', 'diff.medium': 'Medium', 'diff.hard': 'Hard', 'diff.expert': 'Expert',
  'setup.duration': 'Duration', 'setup.record': 'Your best: {n}', 'setup.noRecord': 'No record yet — set your first!',
  'setup.timeRules': 'Every correct answer scores; speed and streaks add bonuses. Mistakes never cost points. Questions get harder gradually.',
  'setup.survRules': 'You have 3 tries. A mistake or a timed-out question costs a try. Each question starts with {s} seconds and shrinks with every correct answer.',
  'setup.pauseRule': 'Pausing or leaving the app stops the clock and swaps the question for an equivalent one.',

  'pr.custom': 'Custom practice', 'pr.lessons': 'Curriculum lessons', 'pr.topics': 'Operations', 'pr.level': 'Level', 'pr.auto': 'Auto',
  'pr.autoSub': 'Adapts to your play', 'pr.format': 'Question type', 'pr.timer': 'Per-question timer (20s)', 'pr.length': 'Round length', 'pr.endless': 'Open',
  'pr.noTopic': 'Pick at least one operation', 'pr.policyTitle': 'What does level {n} mean?',
  'pol.add': 'Addition and subtraction with numbers {a}–{b}', 'pol.mul': 'Multiplication: factors up to {a} × {b}', 'pol.div': 'Division by {a}–{b}, never with a remainder',
  'pol.neg.none': 'No negative numbers', 'pol.neg.sub': 'Subtraction results may be negative', 'pol.neg.add-sub': 'Negative numbers in addition and subtraction',
  'pol.int': 'All answers are whole numbers — no decimals, no rounding.', 'pol.special': 'Fractions: “fraction of a number” with a whole answer. Percentages: common percents with whole answers.',

  'les.stars': '★ {a}/{b}', 'les.lockedPath': 'Finish half of “{name}” first', 'les.count': '{n} lessons',
  'les.rule': 'Stars by accuracy: ★ 65% · ★★ 80% · ★★★ 95% — untimed, with an explanation after each mistake.', 'les.locked': 'Pass the previous lesson first',

  'jr.title': 'Level journey', 'jr.stars': '{a}/{b}', 'jr.worldN': 'World {n}',
  'jr.kind.classic': 'Answer {n} questions with 70%+ accuracy', 'jr.kind.sprint': '{g} correct answers within {s} seconds',
  'jr.kind.boss': 'Boss level: {n} questions and only 3 tries',
  'jr.rule.classic': '★ 70% · ★★ 85% · ★★★ 95% accuracy', 'jr.rule.sprint': 'Stars by time left: ★★★ 40% · ★★ 20%',
  'jr.rule.boss': 'Stars = tries left', 'jr.play': 'Start level', 'jr.unlockHint': 'Pass the previous level to unlock',
  'jr.lockedWorld': 'Beat the boss of the previous world', 'jr.levelN': 'Level {n}', 'jr.best': 'Best: {n}',
  'jr.kindName.classic': 'Accuracy', 'jr.kindName.sprint': 'Speed', 'jr.kindName.boss': 'Boss',

  'fr.p1': 'Player one', 'fr.p2': 'Player two', 'fr.p1Def': 'Player 1', 'fr.p2Def': 'Player 2', 'fr.count': 'Questions',
  'fr.layout': 'How to play', 'fr.turns': 'Take turns', 'fr.turnsSub': 'Each player plays, then passes the device', 'fr.split': 'Face to face',
  'fr.splitSub': 'Split screen, both at once', 'fr.equal': "Each player gets different numbers but exactly equivalent operation, difficulty and question type — watching the other player's questions doesn't help.",
  'fr.turnOf': "{name}'s turn", 'fr.handTo': 'Pass the device to {name}', 'fr.ready': "I'm ready", 'fr.scoreToBeat': 'Score to beat: {n}',
  'fr.splitHint': 'Keyboard: bottom player 1–4 · top player 7, 8, 9, 0', 'fr.done': 'Done! Wait for your friend', 'fr.vs': 'vs',
  'fr.tiebreak': 'On equal points, more correct answers wins, then the faster player.',

  'rain.pops': '{a}/{b}', 'rain.hint': 'Type the answer of any drop — it pops when you type the right answer. If answers share a start, press ✓.',
  'rain.rules': 'Pop {n} drops before you lose your 3 tries. The higher you pop them, the more points.',

  'tut.skip': 'Skip tutorial', 'tut.1': "Hi, I'm Qatra! Let me show you how to play in three quick steps.",
  'tut.2': 'Type the answer with the keypad, then press “Check”. Try it!', 'tut.3': 'Sometimes you pick the answer from options. Pick the right one!',
  'tut.4': 'And sometimes you find the missing number.', 'tut.oops': 'No worries! The answer is {a}. Try the next one.',
  'tut.done': "Well done! Answers in a row build a streak that boosts your points. Let's go to level 1!", 'tut.go': "Let's play",

  'ex.make10': 'Make ten: {a} + {need} = 10, then 10 + {rest} = {c}',
  'ex.addSplit': 'Add tens then ones: {tens} + {ones} = {c}',
  'ex.addCheck': '{e} — check: {back}', 'ex.subCheck': '{e} — check by adding: {back}',
  'ex.subNeg': '{e} — the number taken away is bigger by {d}, so the result is negative',
  'ex.mulSplit': 'Split it: {s} = {v}', 'ex.mulGroups': '{e} — that is {a} groups of {b}',
  'ex.divCheck': '{e} — because {back}', 'ex.missing': 'Use the inverse operation: {e}',
  'ex.compare': 'Left: {l} · Right: {r} → {rel}', 'rel.left': 'left is bigger', 'rel.right': 'right is bigger', 'rel.equal': 'they are equal',
  'ex.frac1': 'Divide by the denominator: {e}', 'ex.fracN': 'Divide by the denominator, then multiply by the numerator: {e1} then {e2}',
  'ex.pct': 'Multiply, then divide by 100: {e}', 'ex.pow': '{e}', 'ex.root': 'Because {e}', 'ex.order': 'Brackets first: {i} then {o}', 'ex.count': 'Count them one by one: {x}',

  'a11y.correctAnswer': 'Correct answer', 'a11y.wrongAnswer': 'Wrong answer', 'a11y.menu': 'Menu', 'a11y.stars': '{n} of 3 stars',
  'a11y.lives': '{n} tries left', 'a11y.timer': '{n} seconds left', 'a11y.expr': 'Problem',
  'rtut.1': 'This drop carries a problem. Type its answer before it hits the ground!', 'rtut.2': 'Great! The drop pops the moment you type the right number.',
  'rtut.3': 'Pop drops higher for more points; answers in a row multiply them.', 'rtut.4': "Well done! In levels don't let drops land — you have 3 hearts.",
  'rain.pausedNote': 'Drops are hidden while paused.', 'rain.ruleClassic': 'Pop {n} drops before you lose your 3 hearts.', 'rain.ruleSprint': 'Pop {n} drops before time runs out.',
      'rain.specials': "Special drops: ⭐ double points · ❄️ slows the rain for 5s · ⚡ pops every drop on screen · 🎁 surprise points and a gift.",
  'jrr.classic': 'Pop {n} drops without losing your 3 hearts', 'jrr.sprint': 'Pop {n} drops within {s} seconds', 'jrr.boss': 'Boss: {n} drops with special drops',
  'jrr.rule.hearts': 'Stars = hearts left (★★★ with no drop landing)', 'jrr.rule.sprint': 'Stars by time left: ★★★ 35% · ★★ 15%',














  "net.loading": "Connecting…",





























































  "shop.title": "Shop",
  "shop.sub": "Support the game and get premium looks",

  "shop.appOnly": "The shop is in the Android app",
  "shop.appOnlyBody": "Purchases are available via Google Play in the Android app. The full game is free here too.",
  "shop.unavailable": "Couldn't reach Google Play right now. Try again later.",
  "shop.best": "Best value",
  "shop.owned": "Owned ✓",
  "shop.thanks": "Thank you for your support! 💙",
  "shop.pending": "Payment is processing — it will activate automatically when complete.",
  "shop.failed": "Couldn't complete. You aren't charged unless it completes.",
  "shop.restore": "Restore purchases",
  "shop.restored": "Your purchases were restored",
  "shop.fair": "All purchases are cosmetic or convenience only: no advantage in scores or leaderboards.",
  "shop.needShop": "From the shop",

  "shop.p.pro_bundle": "Complete Bundle",
  "shop.p.pro_bundleD": "No interstitial ads + every shop look (4 colours and a halo) — one time, forever.",
  "shop.p.remove_ads": "Remove Ads",
  "shop.p.remove_adsD": "No ads between rounds, forever. Reward ads stay optional.",
  "shop.p.skins_pack": "Rain Colours Pack",
  "shop.p.skins_packD": "Ember, Lime, Glacier, Neon + Halo — colours your character and your drops in-game.",

  "ads.reviveTitle": "Second chance?",
  "ads.reviveBody": "Watch a short ad and continue with an extra heart — drops near the ground are cleared.",
  "ads.reviveYes": "Watch & continue",
  "ads.reviveNo": "No, end the round",
  "ads.doubleXp": "Double XP (+{n})",
  "ads.doubled": "Doubled: +{n} XP",
  "ads.privacy": "Ad privacy options",




























  "mode.custom": "Your Challenge",
  "mode.customSub": "Time · Survival · Custom",
  "cus.ops": "Operations",
  "cus.oneOp": "Pick at least one operation",
  "cus.level": "Number difficulty",
  "cus.speedLabel": "Drop speed",
  "cus.speed.slow": "Slow",
  "cus.speed.normal": "Normal",
  "cus.speed.fast": "Fast",
  "cus.speed.veryfast": "Very fast",
  "cus.speed.insane": "Insane",
          "cus.accel": "Drops speed up over time",
  "cus.accelSub": "Faster every 10 seconds — a real test against yourself",
  "cus.done": "You popped {n} drops!",
  "rain.faster": "⚡ Faster!",
  "app.exitHint": "Press back again to exit",
  "ch.time": "Time challenge",
  "ch.survival": "Survival",
  "ch.custom": "Custom",
  "ch.timeSub": "Most correct answers before time runs out",
  "ch.survivalSub": "3 tries, no clock — hold on",
  "ch.customSub": "Set everything yourself",
  "ch.noLimit": "No limit",
  "ch.livesN": "{n} tries",
  "ch.unlimited": "Unlimited",
  "ch.conflictFixed": "We adjusted the other option: no time limit and unlimited tries would never end",
  "ch.duration": "Round length",
  "ch.lives": "Tries",
  "ch.speedHint": "Fall speed = how long a drop takes to reach the ground (from the start)",
  "ch.durationHint": "Length = the whole round, not each question",
  "ch.livesHint": "Every drop that lands costs a try",
  "ch.rule.speed20": "{n}+ questions, {acc}%+ accuracy, average answer ≤ {s}s",
  "ch.rule.survive25": "{n} correct under survival rules (no clock, 3 tries or fewer)",
  "ch.badgeOwned": "✓ Earned",
  "ch.eligible": "✓ These settings qualify",
  "ch.notEligible.revived": "✗ A second chance voids it",
  "ch.notEligible.level": "✗ Needs Medium difficulty or higher",
  "ch.notEligible.speed": "✗ Needs Normal speed or faster",
  "ch.notEligible.rules": "✗ Needs survival rules: no clock and 3 tries or fewer",
  "ch.rules.time": "{s} seconds · unlimited tries · the rain picks up as you score",
  "ch.rules.survival": "No clock · {n} tries · each drop that lands costs one, and the rain picks up",
  "ch.rules.custom": "By your settings: the round ends when time or tries run out — whichever comes first",
  "ch.recordRule": "Record = most correct, ties by points (one per setting)",
  "ch.rewardsTitle": "Rewards and conditions",
  "ch.missionRule": "A mission counts when the round ends by its rule (time or tries run out) with at least {n} correct. Quitting early doesn’t count.",
  "ch.helpTitle": "Speed, length, acceleration, turbo — what’s the difference?",
  "ch.help": "Fall speed: how long a drop takes to reach the ground at the start.|Length: the whole round (there is no per-question timer).|Acceleration: fall time gets 8% shorter every 10 s.|Time and Survival: the rain picks up with every few correct answers instead of time-based acceleration — never both.|Turbo ⚡ is for the journey only: stronger acceleration with single digits, never applied here.",
  "ch.start": "Start {m}",
  "ch.revivedNote": "You used a second chance: this round doesn’t count for records or the Lightning/Survivor badges",
  "ch.notCompleted": "Not complete for missions: needs at least {n} correct",
  "m.survive1": "Complete a survival challenge",
  "m.custom1": "Complete a custom challenge",

  "m.friend1": "Complete a friend challenge",
  "mr.journey1": "Pass any journey level",
  "mr.correct20": "Your correct answers today in any mode",
  "mr.acc90": "A round of 10+ questions with 90% accuracy",
  "mr.streak8": "8 correct in a row in one round",
  "mr.weak10": "Practice your weakest operation",
  "mr.daily1": "The official daily attempt",
  "mr.rounds3": "Any round that ends and is saved",
  "mr.time1": "Until time runs out, with at least {n} correct",
  "mr.survive1": "Until your tries run out, with at least {n} correct",
  "mr.custom1": "Any custom setup, ended by its rule with {n}+ correct",

  "mr.friend1": "Send a challenge, play one you received, or play a friend on this phone",
  "lock.prog.speed20": "Best try: {a}/{n} questions · {acc}% · avg {s}s",
  "lock.prog.survive25": "Best try: {a}/{n} correct",
  "lock.prog.none": "No qualifying try yet — tap to start",
  "prog.recordCustom": "Best custom challenge",
  "res.leftTitle": "Still to go",
  "set.notify": "Reminders",
  "set.notifySub": "Your daily streak and pending friend challenges",
  "set.notifyDenied": "Permission denied — enable notifications in phone settings",




  "notif.streak": "Your {n}-day streak is at risk 🔥 Play today’s challenge",
  "notif.daily": "Today’s challenge is waiting 💧",
  "notif.friends": "You have {n} friend challenges waiting ⚔️",









  "home.bestSpeed": "Top speed",



















  "wal.earned": "pearls earned",
  "wal.boosted": "Double XP +{n}",
  "wal.balance": "Your pearls",
  "wal.gotFree": "+{n} pearls 💎",
  "wal.free": "+{n} free ({left} left today)",
  "wal.notEnough": "Not enough pearls — earn more or get a pack",
  "wal.cannot": "You already have the maximum",
  "wal.bought": "Done ✓",
  "wal.spendTitle": "Spend your pearls",
  "wal.shieldD": "Protects your daily streak if you miss a day ({n}/{m})",
  "wal.boost": "Double XP",
  "wal.boostD": "For {n} rounds (you have {left} left)",
  "wal.revive": "Second chance",
  "wal.reviveD": "When you run out of hearts, no ad",
  "wal.skins": "Premium skins (one by one)",
  "wal.gotPack": "You got {n} pearls 💎 — thanks for your support!",
  "wal.pearls": "pearls",
  "wal.buyPearls": "Pearl packs",
  "wal.reviveBtn": "Continue for {n} pearls (you have {b})",
  "shop.once": "One-time offer",
  "shop.popular": "Most popular",
  "shop.bonus": "+{n}% bonus",
  "shop.permanent": "Permanent",
  "shop.p.starter_pack": "Starter pack",
  "shop.p.starter_packD": "No ads forever + {n} pearls 💎 — best value",
  "cus.range.easy": "Single digits: + − from 1 to 9 · × ÷ up to 5×5",
  "cus.range.medium": "+ − up to 15 · × ÷ up to 5×10",
  "cus.range.hard": "+ − up to 30 · × ÷ up to 10×10",
  "cus.range.expert": "+ − up to 99 · × ÷ up to 12×12",
  "turbo.title": "Turbo",
  "turbo.sub": "Journey only: insane acceleration with single digits",
  "shield.count": "{n} shields",
  "shield.title": "Streak shield",
  "shield.sub": "Protects your daily streak if you miss a day. Earn one from a mystery drop 🎁 or a video.",
  "shield.saving": "Your shield will save your streak today ({n})",
  "shield.watch": "Get a shield",
  "shield.got": "You got a shield 🛡️",
  "shield.one": "Streak shield",
  "rain.speedA11y": "Current speed",
  "rain.recordBroken": "Record!",
  "rain.newRecordLive": "🏆 Record broken!",
  "rain.fasterX": "⚡ Faster! {x}",
  "rain.fever": "🔥 Fever! Points ×2",
  "rain.gift": "🎁 Surprise +{n}",
  "res.nearJourney": "So close! Only {n} more drops — try again",
  "res.nearMiss": "So close to your record! {n} more drops would do it — again?",
  "res.speedTier.0": "Normal speed",
  "res.speedTier.1": "Bronze speed",
  "res.speedTier.2": "Silver speed",
  "res.speedTier.3": "Gold speed",
  "res.speedTier.4": "Diamond speed",
  "res.speedBest": "Your fastest speed ever!",
  "res.speedPrev": "Your best speed: {x}",

  "badge.fever": "Fever",
  "badge.feverD": "Enter fever mode with 10 correct in a row",
  "badge.gift": "Surprise",
  "badge.giftD": "Open a mystery drop 🎁",
  "badge.speedx2": "Double speed",
  "badge.speedx2D": "Survive to ×2 speed",
  "badge.speedx3": "Light speed",
  "badge.speedx3D": "Survive to ×3 speed",
  "badge.turbo": "Turbo",
  "badge.turboD": "Pass a journey level with turbo on",
  "share.title": "Share",


  "share.daily": "Share your result",
  "share.dailyTitle": "Qatra Challenge 💧 Daily #{n}",
  "share.dailyLine": "{drops} drops · {acc}% accuracy · {score} pts",
  "share.challenge": "Challenge a friend with the same drops",
  "share.challengeHot": "Challenge a friend: can they beat {n}?",

  "share.copied": "Copied — paste it in any chat",
  "share.failed": "Couldn't share",
  "share.getApp": "Get the app on Google Play",
  "share.getAppSub": "Smoother play, achievements, progress saved",




  // الأصدقاء بلا خادم
  "nav.friends": "Friends",
  "fr2.title": "Friends",
  "fr2.sub": "Code challenges · same-phone room",
  "fr2.challenge": "Challenge a friend",
  "fr2.challengeSub": "Play, then send your code — they get the exact same drops",
  "fr2.face": "Face to face",
  "fr2.faceSub": "Two players at once on a split screen",
  "fr2.record": "Your record with friends",
  "fr2.empty": "Challenge a friend or enter a code to start your record.",
  "fr2.wld": "W {w} · L {l} · D {d}",
  "fr2.composeSub": "Pick a challenge, then play it first",
  "fr2.tabCustom": "Custom",
  "fr2.tabLevel": "Level",
  "fr2.how": "You play first, then get a code to send so your friend plays the exact same drops.",
  "fr2.playFirst": "Play & send",
  "fr2.pickLevel": "Pick an unlocked level",
  "code.howTo": "Open Qatra Challenge → Friends → Enter code",
  "code.share": "Share code",
  "code.copy": "Copy",
  "code.enter": "Enter a code you received",
  "code.enterShort": "Enter a code",
  "code.enterSub": "Paste your friend's whole message or just the code (starts with QC or QR).",
  "code.paste": "Paste",
  "code.pasteFail": "Couldn't paste — paste the code manually",
  "code.open": "Open code",
  "code.bad": "This code is invalid or incomplete. Make sure you copied all of it.",
  "code.own": "That's your own challenge — send it to a friend!",
  "code.fromX": "Challenge from {name}",
  "code.beat": "Beat {n} points",
  "code.play": "Play",
  "code.again": "Again",
  "code.unknown": "This result code is for a challenge that wasn't sent from this profile.",
  "code.res.win": "You beat {name}!",
  "code.res.lose": "{name} beat you!",
  "code.res.draw": "Draw with {name}",
  "code.vs.win": "You beat {name}!",
  "code.vs.lose": "{name} wins this time",
  "code.vs.draw": "Draw with {name}",
  "code.received": "Challenges received",
  "code.sent": "Challenges you sent",
  "code.yourScore": "Your score {n}",
  "code.waiting": "Waiting for your friend's result code",
  "code.inviteText": "⚔️ I challenge you in Qatra Challenge! I scored {n} in {label}. Can you beat me on the exact same drops?",
  "code.yourCode": "Your challenge code",
  "code.afterShare": "When your friend plays, they send back a result code — enter it in Friends to see who won.",
  "code.sendBack": "Send your result to {name}",
  "code.resultText": "🏁 I played your challenge, {name}, and scored {n}! Enter this code to see who won:",
  "pgs.title": "Google Play Games",
  "pgs.sub": "Global and friends leaderboards, plus achievements.",
  "pgs.lb": "Leaderboards",
  "pgs.ach": "Achievements",
  "party.title": "Same-phone room",
  "party.sub": "2–6 players taking turns",
  "party.pN": "Player {n}",
  "party.remove": "Remove player",
  "party.add": "Add player",
  "party.players": "Players",
  "party.rules": "Round rules",
  "party.how": "Each player takes a turn on the same drops and sees the ghosts of those before. Highest score wins.",
  "party.prev": "{name} scored {n}",
  "party.turnN": "Turn {a} of {b}",
  "party.endTitle": "End the room?",
  "party.endBody": "This round's results will be lost.",
  "party.end": "End room",
  "party.tiebreak": "Tied on points? Most drops wins.",
  "party.again": "New round",
  "party.quitBody": "Your turn will end with your current score.",
  "home.friendsAll": "All",
  "home.challengeSub": "Same drops, one code",
  "home.codeSub": "Challenge or result",
  "home.partySub": "2–6 players",
  "err.screen": "Couldn't open that screen — we went back safely. The problem was logged in Settings.",
  "set.errors": "Problem log",
  "set.errorsSub": "If something went wrong, copy the log and send it to us so we can fix it. Nothing is sent automatically.",
  "set.errorsNone": "No problems logged 👍",
  "set.errorsCopy": "Copy log",
  "set.errorsClear": "Clear",
  "resume.now": "just now",
  "resume.min": "{n} min ago",
  "resume.hour": "{n} h ago",
  "resume.day": "{n} d ago",
  "nav.shop": "Shop",
  "home.dailyShort": "Once a day",
  "home.customShort": "Time · Survival · Custom",
  "home.missionsReward": "Every mission gives you pearls and XP.",
  "set.more": "More",
  "res.challengeShort": "Challenge",
  "shop.tabBuy": "Buy",
  "shop.tabSpend": "Use pearls",
  "shop.buying": "Buying…",
  "shop.successTitle": "Purchase complete!",
  "shop.great": "Great!",
  "menu.levels": "Levels",
  "menu.challenges": "Challenges",
  "menu.how": "How to play",
  "how.1t": "Falling equations",
  "how.1d": "Each drop carries a quick sum.",
  "how.2t": "Type the answer",
  "how.2d": "The drop pops the moment you're right — no button needed.",
  "how.3t": "Don't let them land",
  "how.3d": "Each drop that lands costs a heart ❤️ — you have 3.",
  "how.4t": "Build a streak",
  "how.4d": "Answers in a row multiply points 🔥, and special drops 🎁⭐❄️ bring surprises.",
  "how.try": "Try the quick tutorial",
  "how.ok": "Got it!",
  "shop.notReadyT": "Prices aren't available yet",
  "shop.notReadyD": "Purchases work when the game is installed from Google Play and the products are active. Check your connection and try again.",
  "net.retry2": "Try again",
  "ch.quickTime": "{n} seconds — start now",
  "ch.customize": "Customize",
};

/* لغات النسخة السابقة: العناوين الأساسية فقط (والباقي بالإنجليزية) */
const partial = {
  es: { 'app.tagline': 'Vence a los números', 'home.play': 'Jugar', 'nav.home': 'Inicio', 'nav.settings': 'Ajustes', 'set.language': 'Idioma', 'mode.journey': 'Viaje de niveles', 'mode.time': 'Contrarreloj', 'mode.survival': 'Supervivencia', 'mode.practice': 'Práctica libre', 'mode.friend': 'Reto con amigo', 'mode.rain': 'Lluvia de ecuaciones', 'mode.daily': 'Desafío diario', 'res.retry': 'Reintentar', 'res.home': 'Inicio', 'game.check': 'Comprobar', 'game.correct': '¡Correcto!', 'game.resume': 'Continuar', 'game.quit': 'Salir', 'common.back': 'Atrás' },
  pt: { 'app.tagline': 'Vença os números', 'home.play': 'Jogar', 'nav.home': 'Início', 'nav.settings': 'Configurações', 'set.language': 'Idioma', 'mode.journey': 'Jornada de níveis', 'mode.time': 'Contra o tempo', 'mode.survival': 'Sobrevivência', 'mode.practice': 'Treino livre', 'mode.friend': 'Desafio com amigo', 'mode.rain': 'Chuva de equações', 'mode.daily': 'Desafio diário', 'res.retry': 'Repetir', 'res.home': 'Início', 'game.check': 'Verificar', 'game.correct': 'Correto!', 'game.resume': 'Continuar', 'game.quit': 'Sair', 'common.back': 'Voltar' },
  fr: { 'app.tagline': 'Bats les nombres', 'home.play': 'Jouer', 'nav.home': 'Accueil', 'nav.settings': 'Paramètres', 'set.language': 'Langue', 'mode.journey': 'Parcours', 'mode.time': 'Contre-la-montre', 'mode.survival': 'Survie', 'mode.practice': 'Entraînement libre', 'mode.friend': 'Défi entre amis', 'mode.rain': "Pluie d'équations", 'mode.daily': 'Défi du jour', 'res.retry': 'Réessayer', 'res.home': 'Accueil', 'game.check': 'Vérifier', 'game.correct': 'Correct !', 'game.resume': 'Reprendre', 'game.quit': 'Quitter', 'common.back': 'Retour' },
  de: { 'app.tagline': 'Schlag die Zahlen', 'home.play': 'Spielen', 'nav.home': 'Start', 'nav.settings': 'Einstellungen', 'set.language': 'Sprache', 'mode.journey': 'Level-Reise', 'mode.time': 'Zeitrennen', 'mode.survival': 'Überleben', 'mode.practice': 'Freies Üben', 'mode.friend': 'Freundes-Duell', 'mode.rain': 'Gleichungsregen', 'mode.daily': 'Tagesaufgabe', 'res.retry': 'Nochmal', 'res.home': 'Start', 'game.check': 'Prüfen', 'game.correct': 'Richtig!', 'game.resume': 'Weiter', 'game.quit': 'Beenden', 'common.back': 'Zurück' },
  ru: { 'app.tagline': 'Победи числа', 'home.play': 'Играть', 'nav.home': 'Главная', 'nav.settings': 'Настройки', 'set.language': 'Язык', 'mode.journey': 'Путешествие', 'mode.time': 'На время', 'mode.survival': 'Выживание', 'mode.practice': 'Тренировка', 'mode.friend': 'Вызов другу', 'mode.rain': 'Дождь уравнений', 'mode.daily': 'Задание дня', 'res.retry': 'Заново', 'res.home': 'Главная', 'game.check': 'Проверить', 'game.correct': 'Верно!', 'game.resume': 'Продолжить', 'game.quit': 'Выход', 'common.back': 'Назад' },
  tr: { 'app.tagline': 'Sayıları yen', 'home.play': 'Oyna', 'nav.home': 'Ana sayfa', 'nav.settings': 'Ayarlar', 'set.language': 'Dil', 'mode.journey': 'Seviye yolculuğu', 'mode.time': 'Zamana karşı', 'mode.survival': 'Hayatta kalma', 'mode.practice': 'Serbest pratik', 'mode.friend': 'Arkadaş düellosu', 'mode.rain': 'Denklem yağmuru', 'mode.daily': 'Günün görevi', 'res.retry': 'Tekrar', 'res.home': 'Ana sayfa', 'game.check': 'Kontrol', 'game.correct': 'Doğru!', 'game.resume': 'Devam', 'game.quit': 'Çık', 'common.back': 'Geri' },
  zh: { 'app.tagline': '挑战数字，刷新纪录', 'home.play': '开始游戏', 'nav.home': '首页', 'nav.settings': '设置', 'set.language': '语言', 'mode.journey': '闯关之旅', 'mode.time': '限时挑战', 'mode.survival': '生存模式', 'mode.practice': '自由练习', 'mode.friend': '好友对战', 'mode.rain': '算式之雨', 'mode.daily': '每日挑战', 'res.retry': '重试', 'res.home': '首页', 'game.check': '确认', 'game.correct': '正确！', 'game.resume': '继续', 'game.quit': '退出', 'common.back': '返回' },
  ja: { 'app.tagline': '数字に挑戦しよう', 'home.play': 'プレイ', 'nav.home': 'ホーム', 'nav.settings': '設定', 'set.language': '言語', 'mode.journey': 'レベルの旅', 'mode.time': 'タイムアタック', 'mode.survival': 'サバイバル', 'mode.practice': '自由練習', 'mode.friend': '友だち対戦', 'mode.rain': '計算の雨', 'mode.daily': '今日のチャレンジ', 'res.retry': 'もう一度', 'res.home': 'ホーム', 'game.check': '確定', 'game.correct': '正解！', 'game.resume': '再開', 'game.quit': '終了', 'common.back': '戻る' },
  ko: { 'app.tagline': '숫자에 도전하세요', 'home.play': '플레이', 'nav.home': '홈', 'nav.settings': '설정', 'set.language': '언어', 'mode.journey': '레벨 여행', 'mode.time': '타임 어택', 'mode.survival': '서바이벌', 'mode.practice': '자유 연습', 'mode.friend': '친구 대결', 'mode.rain': '수식의 비', 'mode.daily': '오늘의 도전', 'res.retry': '다시', 'res.home': '홈', 'game.check': '확인', 'game.correct': '정답!', 'game.resume': '계속', 'game.quit': '나가기', 'common.back': '뒤로' },
  id: { 'app.tagline': 'Taklukkan angka', 'home.play': 'Main', 'nav.home': 'Beranda', 'nav.settings': 'Pengaturan', 'set.language': 'Bahasa', 'mode.journey': 'Perjalanan level', 'mode.time': 'Lawan waktu', 'mode.survival': 'Bertahan', 'mode.practice': 'Latihan bebas', 'mode.friend': 'Tantang teman', 'mode.rain': 'Hujan persamaan', 'mode.daily': 'Tantangan harian', 'res.retry': 'Ulangi', 'res.home': 'Beranda', 'game.check': 'Periksa', 'game.correct': 'Benar!', 'game.resume': 'Lanjut', 'game.quit': 'Keluar', 'common.back': 'Kembali' },
  hi: { 'app.tagline': 'संख्याओं को हराएँ', 'home.play': 'खेलें', 'nav.home': 'होम', 'nav.settings': 'सेटिंग्स', 'set.language': 'भाषा', 'mode.journey': 'स्तर यात्रा', 'mode.time': 'समय चुनौती', 'mode.survival': 'सर्वाइवल', 'mode.practice': 'मुक्त अभ्यास', 'mode.friend': 'दोस्त से मुकाबला', 'mode.rain': 'समीकरण वर्षा', 'mode.daily': 'दैनिक चुनौती', 'res.retry': 'फिर से', 'res.home': 'होम', 'game.check': 'जाँचें', 'game.correct': 'सही!', 'game.resume': 'जारी रखें', 'game.quit': 'बाहर', 'common.back': 'वापस' },
};

const DICT = { ar, en, ...partial };

/** لغات مترجمة بالكامل في ملفات منفصلة تُحمَّل عند الحاجة فقط (لا تبطئ الإقلاع) */
export const FULL_LANGS = ['es', 'pt', 'fr', 'tr', 'id', 'hi'];
/** اللغات المعروضة في الاختيار (المترجمة بالكامل فقط) */
export const PICKER_LANGS = ['ar', 'en', ...FULL_LANGS];
const loaded = new Set();
export const isLoaded = (lang) => !FULL_LANGS.includes(lang) || loaded.has(lang);
export async function loadLang(lang) {
  if (isLoaded(lang)) return;
  try {
    const m = await import(`./i18n/${lang}.js`);
    DICT[lang] = { ...(partial[lang] || {}), ...m.default };
    loaded.add(lang);
  } catch { /* بلا اتصال أول مرة: نكمل بالعناوين الأساسية والإنجليزية */ }
}

let cur = { lang: 'ar', digits: 'arabic' };
export function setLocale(lang, digits) {
  cur = { lang: LANGS[lang] ? lang : 'ar', digits: lang === 'ar' ? digits : 'western' };
}
export const locale = () => cur;
export const isRtl = () => !!LANGS[cur.lang]?.rtl;

export function hasKey(key) { return key in ar; }

/** القالب الخام (لعرض نصوص فيها معادلات كعناصر) */
export function tRaw(key) {
  return DICT[cur.lang]?.[key] ?? en[key] ?? ar[key] ?? key;
}

/** نص مترجم مع استبدال {المتغيرات}. الأرقام تُحوَّل حسب التفضيل. */
export function t(key, params) {
  let s = DICT[cur.lang]?.[key] ?? en[key] ?? ar[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  return digitsOut(s);
}
export function digitsOut(s) {
  if (cur.digits !== 'arabic') return s;
  return toArabicDigits(String(s).replace(/(\d)\.(\d)/g, '$1٫$2'));
}

export function detectLang() {
  try {
    // لغة الجهاز إن كانت مترجمة بالكامل، وإلا الإنجليزية
    const n = (navigator.language || 'ar').slice(0, 2).toLowerCase();
    return PICKER_LANGS.includes(n) ? n : 'en';
  } catch { return 'ar'; }
}

export const _dicts = { ar, en };
