/* =========================================================================
   التقدّم: الإحصاءات، الخبرة والمستويات، الشارات، المهام اليومية، المظاهر.
   -------------------------------------------------------------------------
   تعريف المؤشرات (يظهر أيضًا في صفحة «تقدّمي»):
   • «سؤال مُجاب»: أي سؤال أجاب عنه اللاعب أو انتهى وقته. الأسئلة المتخطّاة بسبب
     الخروج من التحدي اليومي لا تُحتسب.
   • الدقة = الإجابات الصحيحة ÷ الأسئلة المجابة.
   • متوسط زمن الإجابة = متوسط الزمن من ظهور السؤال حتى الإجابة، للأسئلة التي
     أُجيب عنها فعلًا (لا يشمل انتهاء الوقت ولا فترات الإيقاف ولا نمط المطر).
   • الجولة: جولة اكتملت أو أنهاها اللاعب وحُفظت نتيجتها (الجولات المتروكة لا تُحتسب
     جولة، لكن إجاباتها الحقيقية تُحتسب في الأسئلة والدقة).
   • مستوى العملية: تقدير المهارة التكيّفي (١–١٠) — انظر adaptive.js.
   ========================================================================= */
import { recordSkill, newSkill } from './adaptive.js';
import { createRng } from './rng.js';

export const STAT_OPS = ['add', 'sub', 'mul', 'div', 'order', 'frac', 'percent', 'power'];
export const DATA_VERSION = 2;

export function todayStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function dayDiff(a, b) {
  const pa = new Date(a + 'T12:00:00'), pb = new Date(b + 'T12:00:00');
  return Math.round((pb - pa) / 864e5);
}

export function defaultSettings(lang = 'ar') {
  return {
    lang, digits: lang === 'ar' ? 'arabic' : 'western',
    sfx: 0.8, music: 0.25, haptics: true,
    motion: 'system', // system | reduce | full
    contrast: false, bigText: false,
    tutorialDone: false,
  };
}

export function newProfileData(lang = 'ar') {
  return {
    v: DATA_VERSION,
    settings: defaultSettings(lang),
    xp: 0,
    journey: { unlocked: 1, stars: {}, best: {} },
    lessons: { done: {}, unlocked: {} },
    records: {},
    skill: {},
    stats: { rounds: 0, questions: 0, correct: 0, timedMs: 0, timedCount: 0, bestStreak: 0, perOp: {}, perFormat: {}, days: {}, modes: {}, friendMatches: 0, rainPops: 0 },
    history: [],
    daily: { last: null, streak: 0, bestStreak: 0, best: 0, results: {}, rewarded: {} },
    missions: { date: null, list: [] },
    badges: {},
    cosmetics: { theme: 'rain', skin: 'sky', acc: 'none' },
    committed: [],
    prefs: { practice: { topics: ['add', 'sub'], level: 'auto', format: 'mixed', timer: false, length: 10 }, time: { dur: 60, diff: 'medium' }, survival: { diff: 'medium' }, friend: { names: ['', ''], count: 10, diff: 'medium', layout: 'turns' }, rain: { diff: 'medium' } },
  };
}

/** يكمل أي حقول ناقصة (لبيانات قديمة أو تالفة جزئيًا) */
export function normalizeData(d, lang = 'ar') {
  const base = newProfileData(lang);
  if (!d || typeof d !== 'object') return base;
  const out = { ...base, ...d };
  out.settings = { ...base.settings, ...(d.settings || {}) };
  out.journey = { ...base.journey, ...(d.journey || {}) };
  out.lessons = { ...base.lessons, ...(d.lessons || {}) };
  out.stats = { ...base.stats, ...(d.stats || {}) };
  out.daily = { ...base.daily, ...(d.daily || {}) };
  out.missions = { ...base.missions, ...(d.missions || {}) };
  out.cosmetics = { ...base.cosmetics, ...(d.cosmetics || {}) };
  if (out.cosmetics.acc === 'glasses') out.cosmetics.acc = 'sparkle'; // أُزيلت النظارة مع إزالة الوجه
  out.prefs = { ...base.prefs, ...(d.prefs || {}) };
  for (const k of Object.keys(base.prefs)) out.prefs[k] = { ...base.prefs[k], ...((d.prefs || {})[k] || {}) };
  out.committed = Array.isArray(d.committed) ? d.committed : [];
  out.history = Array.isArray(d.history) ? d.history : [];
  out.v = DATA_VERSION;
  return out;
}

/* ---------------- الخبرة والمستويات ---------------- */
export const xpForLevel = (lvl) => 100 + 40 * (lvl - 1); // خبرة الانتقال من lvl إلى lvl+1
export function levelFromXp(xp) {
  let lvl = 1, rest = Math.max(0, xp | 0);
  while (rest >= xpForLevel(lvl)) { rest -= xpForLevel(lvl); lvl++; }
  return { level: lvl, into: rest, need: xpForLevel(lvl), pct: rest / xpForLevel(lvl) };
}

/* ---------------- تسجيل إجابة واحدة (لحظيًا) ---------------- */
export function recordAnswer(data, entry, date = todayStr()) {
  if (entry.skipped) return { change: 0 };
  const st = data.stats;
  st.questions++;
  if (entry.correct) st.correct++;
  if (entry.ms != null) { st.timedMs += entry.ms; st.timedCount++; }
  const op = entry.op;
  const po = (st.perOp[op] ||= { q: 0, c: 0, ms: 0, n: 0 });
  po.q++; if (entry.correct) po.c++;
  if (entry.ms != null) { po.ms += entry.ms; po.n++; }
  const pf = (st.perFormat[entry.format] ||= { q: 0, c: 0 });
  pf.q++; if (entry.correct) pf.c++;
  const day = (st.days[date] ||= { q: 0, c: 0, ms: 0, n: 0, rounds: 0 });
  day.q++; if (entry.correct) day.c++;
  if (entry.ms != null) { day.ms += entry.ms; day.n++; }
  pruneDays(st.days);
  let change = 0;
  if (entry.adapt !== false && STAT_OPS.includes(op)) {
    const r = recordSkill(data.skill[op] || newSkill(), entry);
    data.skill[op] = r.skill; change = r.change;
  }
  return { change };
}
function pruneDays(days) {
  const keys = Object.keys(days).sort();
  while (keys.length > 120) delete days[keys.shift()];
}

/* ---------------- الشارات ---------------- */
export const BADGES = [
  { id: 'first', icon: '🌱' }, { id: 'streak10', icon: '🔥' }, { id: 'streak25', icon: '☄️' },
  { id: 'correct100', icon: '💯' }, { id: 'correct1000', icon: '🏔️' }, { id: 'perfect', icon: '🎯' },
  { id: 'speed20', icon: '⚡' }, { id: 'survive25', icon: '🛡️' }, { id: 'daily3', icon: '📅' }, { id: 'daily7', icon: '🗓️' },
  { id: 'world1', icon: '🌦️' }, { id: 'world5', icon: '🌊' }, { id: 'world10', icon: '👑' }, { id: 'allstars', icon: '🌟' },
  { id: 'allround', icon: '🧭' }, { id: 'friend', icon: '🤝' }, { id: 'scholar', icon: '🎓' }, { id: 'rain', icon: '💧' },
];

function checkBadges(data, round) {
  const has = (id) => !!data.badges[id];
  const earn = [];
  const give = (id, cond) => { if (!has(id) && cond) earn.push(id); };
  const st = data.stats;
  give('first', st.rounds >= 1);
  give('streak10', st.bestStreak >= 10);
  give('streak25', st.bestStreak >= 25);
  give('correct100', st.correct >= 100);
  give('correct1000', st.correct >= 1000);
  give('perfect', round && round.answered >= 10 && round.correct === round.answered);
  give('speed20', round && round.mode === 'time' && round.duration === 60 && round.correct >= 20);
  give('survive25', round && round.mode === 'survival' && round.correct >= 25);
  give('daily3', data.daily.streak >= 3);
  give('daily7', data.daily.streak >= 7);
  give('world1', data.journey.unlocked > 10 || !!data.journey.stars[10]);
  give('world5', data.journey.unlocked > 50 || !!data.journey.stars[50]);
  give('world10', !!data.journey.stars[100]);
  let fullWorld = false;
  for (let w = 0; w < 10 && !fullWorld; w++) {
    let s = 0; for (let i = 1; i <= 10; i++) s += data.journey.stars[w * 10 + i] || 0;
    fullWorld = s === 30;
  }
  give('allstars', fullWorld);
  give('allround', ['add', 'sub', 'mul', 'div'].every((op) => (data.skill[op]?.r || 1) >= 5));
  give('friend', st.friendMatches >= 1);
  give('scholar', round && round.mode === 'lesson' && round.pathComplete);
  give('rain', round && round.mode === 'rain' && round.passed && (round.diff === 'hard' || round.diff === 'expert'));
  return earn;
}

/* ---------------- المهام اليومية ---------------- */
export const MISSION_POOL = [
  { id: 'journey1', goal: 1 }, { id: 'correct20', goal: 20 }, { id: 'acc90', goal: 1 }, { id: 'streak8', goal: 1 },
  { id: 'time1', goal: 1 }, { id: 'weak10', goal: 10 }, { id: 'daily1', goal: 1 }, { id: 'survive10', goal: 1 }, { id: 'rounds3', goal: 3 },
];
export const MISSION_XP = 40;

/** العملية الأضعف (الأقل دقة بعينة ≥ ١٠، وإلا الأقل تقديرًا) */
export function weakestOp(data) {
  const ops = ['add', 'sub', 'mul', 'div'];
  const withData = ops.filter((o) => (data.stats.perOp[o]?.q || 0) >= 10);
  if (withData.length) {
    return withData.reduce((a, b) => acc(data, b) < acc(data, a) ? b : a);
  }
  return ops.reduce((a, b) => ((data.skill[b]?.r || 1) < (data.skill[a]?.r || 1) ? b : a));
}
const acc = (data, op) => { const p = data.stats.perOp[op]; return p && p.q ? p.c / p.q : 1; };

export function ensureMissions(data, date = todayStr(), salt = '') {
  if (data.missions.date === date && data.missions.list.length) return false;
  const rng = createRng(`missions:${date}:${salt}`);
  const pool = rng.shuffle(MISSION_POOL.filter((m) => m.id !== 'daily1'));
  const picks = [{ id: 'daily1', goal: 1 }, pool[0], pool[1]];
  data.missions = {
    date,
    list: picks.map((m) => ({ id: m.id, goal: m.goal, progress: 0, done: false, claimed: false, op: m.id === 'weak10' ? weakestOp(data) : undefined })),
  };
  return true;
}

function progressMissions(data, round, date) {
  const done = [];
  if (data.missions.date !== date) return done;
  for (const m of data.missions.list) {
    if (m.done) continue;
    let inc = 0;
    switch (m.id) {
      case 'journey1': inc = round.mode === 'journey' && round.passed ? 1 : 0; break;
      case 'correct20': inc = round.correct || 0; break;
      case 'acc90': inc = round.answered >= 10 && round.correct / round.answered >= 0.9 ? 1 : 0; break;
      case 'streak8': inc = (round.bestStreak || 0) >= 8 ? 1 : 0; break;
      case 'time1': inc = round.mode === 'time' ? 1 : 0; break;
      case 'weak10': inc = (round.perOp?.[m.op]?.c) || 0; break;
      case 'daily1': inc = round.mode === 'daily' && round.official ? 1 : 0; break;
      case 'survive10': inc = round.mode === 'survival' && round.correct >= 10 ? 1 : 0; break;
      case 'rounds3': inc = round.mode === 'friend' ? 0 : 1; break;
    }
    if (inc > 0) {
      m.progress = Math.min(m.goal, m.progress + inc);
      if (m.progress >= m.goal) { m.done = true; }
    }
    if (m.done && !m.claimed) { m.claimed = true; done.push(m); }
  }
  return done;
}

/* ---------------- المظاهر التجميلية (لا تؤثر على اللعب) ---------------- */
export const COSMETICS = {
  theme: [
    { id: 'rain', need: { level: 1 } }, { id: 'dawn', need: { level: 1 } }, { id: 'oasis', need: { level: 3 } },
    { id: 'sunset', need: { level: 5 } }, { id: 'aurora', need: { level: 8 } }, { id: 'gold', need: { badge: 'allstars' } },
  ],
  skin: [
    { id: 'sky', need: { level: 1 } }, { id: 'mint', need: { level: 2 } }, { id: 'rose', need: { level: 4 } },
    { id: 'violet', need: { level: 6 } }, { id: 'sun', need: { badge: 'world5' } }, { id: 'night', need: { badge: 'daily7' } },
  ],
  acc: [
    { id: 'none', need: { level: 1 } }, { id: 'cap', need: { level: 3 } }, { id: 'sparkle', need: { level: 5 } },
    { id: 'phones', need: { level: 7 } }, { id: 'crown', need: { badge: 'world1' } }, { id: 'scarf', need: { badge: 'daily3' } },
  ],
};
export function isUnlocked(data, item) {
  if (item.need.badge) return !!data.badges[item.need.badge];
  return levelFromXp(data.xp).level >= (item.need.level || 1);
}
export function unlockedCosmetics(data) {
  const out = [];
  for (const [cat, items] of Object.entries(COSMETICS)) for (const it of items) if (isUnlocked(data, it)) out.push(`${cat}:${it.id}`);
  return out;
}

/* =========================================================================
   commitRound — يطبّق مكافآت الجولة مرة واحدة فقط (idempotent عبر معرّف الجولة).
   round: { id, mode, score, correct, answered, bestStreak, perOp, passed, stars, level,
            official, duration, diff, recordKey, recordValue, activeMs, ... }
   يعيد { applied, xp, levelBefore, levelAfter, badges, missions, records, unlocks }
   ========================================================================= */
export function commitRound(data, round, date = todayStr()) {
  if (!round || !round.id) throw new Error('round id required');
  if (data.committed.includes(round.id)) return { applied: false };
  data.committed.push(round.id);
  if (data.committed.length > 200) data.committed.splice(0, data.committed.length - 200);

  const st = data.stats;
  const before = levelFromXp(data.xp).level;
  const unlockedBefore = new Set(unlockedCosmetics(data));
  ensureMissions(data, date);

  st.rounds++;
  st.modes[round.mode] = (st.modes[round.mode] || 0) + 1;
  if ((round.bestStreak || 0) > st.bestStreak) st.bestStreak = round.bestStreak;
  if (st.days[date]) st.days[date].rounds++; else st.days[date] = { q: 0, c: 0, ms: 0, n: 0, rounds: 1 };
  if (round.mode === 'friend') st.friendMatches++;

  // الخبرة
  let xp = (round.correct || 0) * 10;
  if (round.mode === 'journey') {
    xp += round.passed ? 20 + (round.starsGained || 0) * 15 : 0;
  } else if (round.mode === 'lesson') {
    xp += round.passed ? 15 + (round.starsGained || 0) * 10 : 0;
  } else if (round.mode === 'daily') {
    xp += round.official ? 50 : 0;
  } else if (round.mode !== 'friend') {
    xp += 10;
  }
  if (round.mode === 'friend') xp = 20;

  // الأرقام القياسية
  const records = [];
  if (round.recordKey) {
    const prev = data.records[round.recordKey];
    const better = !prev || round.recordValue > prev.value || (round.recordValue === prev.value && round.score > (prev.score || 0));
    if (better) {
      data.records[round.recordKey] = { value: round.recordValue, score: round.score, correct: round.correct, date };
      records.push({ key: round.recordKey, value: round.recordValue, prev: prev ? prev.value : null });
    }
  }

  // السجل (للرسم البياني وآخر الجولات)
  data.history.push({ id: round.id, mode: round.mode, date, score: round.score, correct: round.correct, answered: round.answered, acc: round.answered ? +(round.correct / round.answered).toFixed(3) : 0 });
  if (data.history.length > 60) data.history.splice(0, data.history.length - 60);

  // المهام
  const missions = progressMissions(data, round, date);
  xp += missions.length * MISSION_XP;

  data.xp += xp;
  const badges = checkBadges(data, round);
  for (const b of badges) data.badges[b] = date;
  const after = levelFromXp(data.xp).level;
  const unlocks = unlockedCosmetics(data).filter((k) => !unlockedBefore.has(k));
  return { applied: true, xp, levelBefore: before, levelAfter: after, badges, missions, records, unlocks };
}

/* ---------------- التحدي اليومي ---------------- */
export function dailyStatus(data, date = todayStr()) {
  const r = data.daily.results[date];
  return { done: !!r, result: r || null, streak: currentDailyStreak(data, date) };
}
export function currentDailyStreak(data, date = todayStr()) {
  const last = data.daily.last;
  if (!last) return 0;
  const gap = dayDiff(last, date);
  return gap <= 1 ? data.daily.streak : 0;
}
/** يسجّل نتيجة المحاولة الرسمية لليوم (مرة واحدة). يعيد true إن كانت رسمية. */
export function recordDaily(data, date, result) {
  if (data.daily.results[date]) return false;
  data.daily.results[date] = result;
  const keys = Object.keys(data.daily.results).sort();
  while (keys.length > 60) delete data.daily.results[keys.shift()];
  const gap = data.daily.last ? dayDiff(data.daily.last, date) : null;
  data.daily.streak = gap === 1 ? data.daily.streak + 1 : gap === 0 ? data.daily.streak : 1;
  data.daily.bestStreak = Math.max(data.daily.bestStreak || 0, data.daily.streak);
  data.daily.last = date;
  data.daily.best = Math.max(data.daily.best || 0, result.score);
  return true;
}

/* ---------------- مؤشرات صفحة «تقدّمي» ---------------- */
export function metrics(data, date = todayStr()) {
  const st = data.stats;
  const perOp = {};
  for (const op of STAT_OPS) {
    const p = st.perOp[op];
    if (!p && !data.skill[op]) continue;
    perOp[op] = {
      q: p?.q || 0, c: p?.c || 0,
      acc: p && p.q ? p.c / p.q : null,
      avgMs: p && p.n ? Math.round(p.ms / p.n) : null,
      level: data.skill[op] ? Math.floor(data.skill[op].r) : 1,
      rating: data.skill[op]?.r || 1,
    };
  }
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - i);
    const k = todayStr(d), v = st.days[k];
    days.push({ date: k, q: v?.q || 0, c: v?.c || 0, acc: v && v.q ? v.c / v.q : null, avgMs: v && v.n ? Math.round(v.ms / v.n) : null });
  }
  return {
    rounds: st.rounds, questions: st.questions, correct: st.correct,
    accuracy: st.questions ? st.correct / st.questions : null,
    avgMs: st.timedCount ? Math.round(st.timedMs / st.timedCount) : null,
    bestStreak: st.bestStreak, perOp, days,
    empty: st.questions === 0,
  };
}

/** توصية تدريبية مبنية على البيانات الفعلية */
export function recommendation(data) {
  const st = data.stats;
  if (st.questions < 20) return { key: 'rec.needData', need: 20 - st.questions };
  const ops = ['add', 'sub', 'mul', 'div', 'order', 'frac', 'percent', 'power'].filter((o) => (st.perOp[o]?.q || 0) >= 10);
  if (!ops.length) return { key: 'rec.needData', need: 10 };
  const scored = ops.map((o) => ({ op: o, acc: st.perOp[o].c / st.perOp[o].q, ms: st.perOp[o].n ? st.perOp[o].ms / st.perOp[o].n : 0 }));
  const weak = scored.filter((s) => s.acc < 0.8).sort((a, b) => a.acc - b.acc)[0];
  if (weak) return { key: 'rec.accuracy', op: weak.op, acc: weak.acc };
  const slow = scored.slice().sort((a, b) => b.ms - a.ms)[0];
  if (slow && slow.ms > 8000) return { key: 'rec.speed', op: slow.op, ms: slow.ms };
  const low = ['add', 'sub', 'mul', 'div'].map((o) => ({ op: o, r: data.skill[o]?.r || 1 })).sort((a, b) => a.r - b.r)[0];
  return { key: 'rec.levelUp', op: low.op };
}
