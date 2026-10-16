/* =========================================================================
   «تحدّيك الخاص» — المصدر الوحيد لقواعد أنماطه الثلاثة:
   • time      تحدّي الوقت: أكبر عدد من الإجابات الصحيحة خلال مدة محددة (بلا قلوب).
   • survival  البقاء: ٣ محاولات (قلوب)، والجولة تنتهي عند نفادها. لا وقت.
   • custom    تخصيص: العمليات + صعوبة الأرقام + سرعة السقوط + المدة + المحاولات + التسارع.
   كل الأنماط تعمل على محرّك المطر نفسه (rain.js) بقواعد نقاط واحدة.
   ملاحظة عن السرعة (لا تتراكب):
   • سرعة السقوط (custom.speed) = زمن عبور القطرة للسماء من البداية.
   • التسارع (custom.accel) = تقصير ذلك الزمن ٨٪ كل ١٠ ثوانٍ.
   • الوقت والبقاء: «المطر يشتد» مع كل عدد من الإجابات (ramp) ولا تسارع زمني.
   • التيربو ⚡ للرحلة فقط ولا يُطبَّق هنا أبدًا.
   ========================================================================= */
import { rainConfig, stormConfig, survivalConfig, CUSTOM_OPS, CUSTOM_LEVELS, CUSTOM_SPEEDS } from './rain.js';

export const CH_MODES = ['time', 'survival', 'custom'];
export const CH_DIFFS = ['easy', 'medium', 'hard'];            // صعوبة الوقت والبقاء
export const TIME_DURATIONS = [30, 60, 120];                    // ثوانٍ (تطابق مفاتيح الأرقام القياسية القديمة)
export const SURVIVAL_LIVES = 3;
export const CUSTOM_DURS = [0, 60, 90, 120];                    // ٠ = بلا حد زمني
export const CUSTOM_LIVES = [0, 1, 3, 5];                       // ٠ = محاولات غير محدودة
export const CUSTOM_ACCEL = 0.08;
export { CUSTOM_OPS, CUSTOM_LEVELS, CUSTOM_SPEEDS };

/** معنى «إكمال الجولة»: انتهت بقاعدتها (انتهى الوقت أو نفدت المحاولات)، وبحد أدنى من الإجابات الصحيحة */
export const COMPLETE_MIN_CORRECT = 5;
export const NATURAL_ENDS = new Set(['time', 'lives', 'target']);
export const isCompleted = (sum, minCorrect = COMPLETE_MIN_CORRECT) => !!sum && NATURAL_ENDS.has(sum.endReason) && (sum.popped ?? sum.correct ?? 0) >= minCorrect;

const LEVEL_RANK = { easy: 0, medium: 1, hard: 2, expert: 3 };
const SPEED_RANK = { slow: 0, normal: 1, fast: 2, veryfast: 3, insane: 4 };
export const levelRank = (l) => LEVEL_RANK[l] ?? 1;
export const speedRank = (s) => SPEED_RANK[s] ?? 2;

/**
 * يعيد إعدادات صالحة دائمًا (ويحوّل الصيغ القديمة):
 * • custom القديم { end: 't60'|'t120'|'lives' } ← { dur, lives }
 * • منع التعارض: بلا مدة + محاولات غير محدودة = جولة لا تنتهي ← ٣ محاولات.
 */
export function normalizeChallenge(a = {}) {
  const mode = CH_MODES.includes(a.mode) ? a.mode : 'custom';
  if (mode === 'time') {
    return { mode, dur: TIME_DURATIONS.includes(+a.dur) ? +a.dur : 60, diff: CH_DIFFS.includes(a.diff) ? a.diff : 'medium' };
  }
  if (mode === 'survival') return { mode, diff: CH_DIFFS.includes(a.diff) ? a.diff : 'medium' };
  let { dur, lives } = a;
  if (dur == null && lives == null && a.end) { dur = a.end === 't120' ? 120 : a.end === 't60' ? 60 : 0; lives = a.end === 'lives' ? 3 : 0; }
  dur = CUSTOM_DURS.includes(+dur) ? +dur : 60;
  lives = CUSTOM_LIVES.includes(+lives) ? +lives : 0;
  if (!dur && !lives) lives = 3;
  const ops = (Array.isArray(a.ops) ? a.ops : []).filter((o) => CUSTOM_OPS.includes(o));
  return {
    mode, ops: ops.length ? [...new Set(ops)] : ['add', 'sub'],
    level: CUSTOM_LEVELS.includes(a.level) ? a.level : 'easy',
    speed: CUSTOM_SPEEDS[a.speed] ? a.speed : 'fast',
    dur, lives, accel: a.accel !== false,
  };
}

const LEVEL_TIER = { easy: [2, 1], medium: [3, 2], hard: [4, 3], expert: [6, 4] }; // [جمع/طرح, ضرب/قسمة]
/** إعدادات المحرّك لأي خيار من «تحدّيك الخاص» */
export function challengeConfig(aIn) {
  const a = normalizeChallenge(aIn);
  if (a.mode === 'time') return stormConfig(a.diff, a.dur, true);
  if (a.mode === 'survival') return survivalConfig(a.diff);
  const [as, md] = LEVEL_TIER[a.level];
  const tiers = Object.fromEntries(a.ops.map((o) => [o, o === 'add' || o === 'sub' ? as : md]));
  return rainConfig({ tiers, ...CUSTOM_SPEEDS[a.speed], specials: true, lives: a.lives || null, timeLimit: a.dur || null, accel: a.accel ? CUSTOM_ACCEL : null });
}

/**
 * مفتاح الرقم القياسي: منفصل لكل نمط وكل إعداد يؤثر في الصعوبة.
 * قاعدة المقارنة (معلنة للاعب): الأكثر إجابات صحيحة، وعند التعادل الأعلى نقاطًا.
 */
export function challengeRecordKey(aIn) {
  const a = normalizeChallenge(aIn);
  if (a.mode === 'time') return `time:${a.dur}:${a.diff}`;
  if (a.mode === 'survival') return `survival:${a.diff}`;
  return `custom2:${[...a.ops].sort().join('')}:${a.level}:${a.speed}:${a.dur}:${a.lives}:${a.accel ? 1 : 0}`;
}
/** يحوّل مفتاح «تحدّيك الخاص» القديم (custom:ops:level:speed:end:accel) إلى الصيغة الجديدة */
export function migrateRecordKey(key) {
  const m = /^custom:([a-z]+):(\w+):(\w+):(t60|t120|lives):([01])$/.exec(key);
  if (m) {
    const ops = m[1].match(/add|sub|mul|div/g) || [];
    return challengeRecordKey({ mode: 'custom', ops, level: m[2], speed: m[3], end: m[4], accel: m[5] === '1' });
  }
  // أرقام التيربو في الوقت والبقاء: قواعد لم تعد موجودة ← تُحفظ كأرشيف لا يُقارن بها
  if (/^(time|survival):.*:turbo$/.test(key)) return 'legacy:' + key;
  return key;
}

/* =========================================================================
   شارتا «البرق» و«الصامد» — الحدود قابلة للضبط من هنا فقط
   ========================================================================= */
export const BADGE_RULES = {
  // البرق: سرعة ودقة معًا على عدد كافٍ من الأسئلة، بصعوبة متوسطة فأعلى، وبلا فرصة ثانية
  speed20: { minAnswered: 20, minAccuracy: 0.9, maxAvgMs: 3000, minLevel: 'medium', minSpeed: 'normal' },
  // الصامد: ٢٥ صحيحة بقواعد البقاء (بلا حد زمني، ٣ محاولات أو أقل)، بصعوبة متوسطة فأعلى، وبلا فرصة ثانية
  survive25: { minCorrect: 25, maxLives: 3, minLevel: 'medium', minSpeed: 'normal' },
};

/** صعوبة الجولة كرتبة واحدة للمقارنة (الوقت/البقاء: diff، التخصيص: level) */
const roundLevel = (a) => (a.mode === 'custom' ? a.level : a.diff);

/** هل الجولة مؤهلة لمحاولة شارة (قبل النظر في الأداء)؟ يعيد سبب الرفض أو null */
export function badgeEligibility(id, aIn, { revived = false } = {}) {
  const r = BADGE_RULES[id]; const a = normalizeChallenge(aIn);
  if (revived) return 'revived';
  if (levelRank(roundLevel(a)) < levelRank(r.minLevel)) return 'level';
  if (a.mode === 'custom' && speedRank(a.speed) < speedRank(r.minSpeed)) return 'speed';
  if (id === 'survive25') {
    const survivalRules = a.mode === 'survival' || (a.mode === 'custom' && !a.dur && a.lives >= 1 && a.lives <= r.maxLives);
    if (!survivalRules) return 'rules';
  }
  return null;
}

/** تقييم الشارتين لجولة منتهية: { speed20: {eligible, met, progress}, survive25: {...} } */
export function evaluateBadges(aIn, sum, { revived = false } = {}) {
  const out = {};
  const answered = sum.answered ?? 0, acc = answered ? (sum.popped ?? sum.correct ?? 0) / answered : 0;
  const L = BADGE_RULES.speed20;
  const e1 = badgeEligibility('speed20', aIn, { revived });
  out.speed20 = { eligible: !e1, reason: e1, met: !e1 && answered >= L.minAnswered && acc >= L.minAccuracy && sum.avgMs != null && sum.avgMs <= L.maxAvgMs,
    progress: { answered, acc, avgMs: sum.avgMs } };
  const S = BADGE_RULES.survive25;
  const e2 = badgeEligibility('survive25', aIn, { revived });
  const correct = sum.popped ?? sum.correct ?? 0;
  out.survive25 = { eligible: !e2, reason: e2, met: !e2 && sum.endReason === 'lives' && correct >= S.minCorrect, progress: { correct } };
  return out;
}

/** أفضل تقدّم نحو الشارة (يُحفظ لعرضه للاعب) */
export function mergeBadgeProgress(prev = {}, ev) {
  const next = { ...prev };
  if (ev.speed20?.eligible) {
    const p = ev.speed20.progress, b = next.speed20;
    // الأفضل = أكثر أسئلة بدقة مؤهلة، ثم الأسرع
    const score = (x) => (x && x.acc >= BADGE_RULES.speed20.minAccuracy ? x.answered : 0) * 1e6 - (x?.avgMs ?? 1e6);
    if (!b || score(p) > score(b)) next.speed20 = { answered: p.answered, acc: +p.acc.toFixed(3), avgMs: p.avgMs };
  }
  if (ev.survive25?.eligible && ev.survive25.progress.correct > (next.survive25?.correct || 0)) next.survive25 = { correct: ev.survive25.progress.correct };
  return next;
}

/** الإعدادات المقترحة عند الانتقال من مهمة أو شارة */
export const PRESETS = {
  time: { mode: 'time', dur: 60, diff: 'medium' },
  survival: { mode: 'survival', diff: 'medium' },
  custom: { mode: 'custom', ops: ['add', 'sub'], level: 'easy', speed: 'fast', dur: 60, lives: 0, accel: true },
  speed20: { mode: 'time', dur: 120, diff: 'medium' },
  survive25: { mode: 'survival', diff: 'medium' },
};
