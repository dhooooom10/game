/* =========================================================================
   تحدّي الأصدقاء بلا خادم: رموز قصيرة تُرسل في واتساب (أو أي تطبيق).
   • رمز التحدي  QC-…  : من تحدّاك + نوع التحدي وإعداداته + البذرة + نتيجته
                         → صديقك يلعب نفس القطرات بالضبط (المحرّك حتمي من البذرة).
   • رمز النتيجة QR-…  : يرسله صديقك بعد اللعب → تعرف من فاز.
   كل شيء يُحفظ على الجهاز (data.social). لا تحقق مركزي: النتائج بين الأصدقاء على الثقة،
   ولا تدخل أي ترتيب عام. رمز تالف أو معدّل يُرفض بفحص التحقق (checksum).
   ========================================================================= */
import { normalizeChallenge } from './challenge.js';
import { TOTAL_LEVELS } from './modes.js';

const MODES = ['time', 'survival', 'custom'];
const DIFFS = ['easy', 'medium', 'hard', 'expert'];
const SPEEDS = ['slow', 'normal', 'fast', 'veryfast', 'insane'];
const OPS = ['add', 'sub', 'mul', 'div'];

/* ---------- ترميز مضغوط للإعدادات ---------- */
function packArgs(kind, a) {
  if (kind === 'level') return [a.level | 0, a.turbo ? 1 : 0];
  const n = normalizeChallenge(a);
  if (n.mode === 'time') return [0, n.dur, DIFFS.indexOf(n.diff)];
  if (n.mode === 'survival') return [1, DIFFS.indexOf(n.diff)];
  const opsMask = n.ops.reduce((m, o) => m | (1 << OPS.indexOf(o)), 0);
  return [2, opsMask, DIFFS.indexOf(n.level), SPEEDS.indexOf(n.speed), n.dur, n.lives, n.accel ? 1 : 0];
}
function unpackArgs(kind, p) {
  if (!Array.isArray(p)) throw new Error('args');
  if (kind === 'level') {
    const level = p[0] | 0;
    if (level < 1 || level > TOTAL_LEVELS) throw new Error('level');
    return { level, turbo: !!p[1] };
  }
  const mode = MODES[p[0]];
  if (mode === 'time') return normalizeChallenge({ mode, dur: p[1], diff: DIFFS[p[2]] });
  if (mode === 'survival') return normalizeChallenge({ mode, diff: DIFFS[p[1]] });
  if (mode === 'custom') return normalizeChallenge({ mode, ops: OPS.filter((_, i) => p[1] & (1 << i)), level: DIFFS[p[2]], speed: SPEEDS[p[3]], dur: p[4], lives: p[5], accel: !!p[6] });
  throw new Error('mode');
}

/* ---------- base64url + فحص تحقق ---------- */
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
function check(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(-3).padStart(3, '0'); }
function enc(prefix, arr) {
  const body = b64(new TextEncoder().encode(JSON.stringify(arr)));
  return `${prefix}-${body}.${check(prefix + body)}`;
}
function dec(code) {
  const m = /\b(Q[CR])-([A-Za-z0-9_-]{8,600})\.([0-9a-z]{3})\b/.exec(String(code || ''));
  if (!m) throw new Error('format');
  if (check(m[1] + m[2]) !== m[3]) throw new Error('checksum');
  return { type: m[1], arr: JSON.parse(new TextDecoder().decode(unb64(m[2]))) };
}

/** معرّف ثابت للتحدي (يحسبه الطرفان بنفس الطريقة) */
export const challengeId = (uid, kind, args, seed) => check(`${uid}|${kind}|${JSON.stringify(packArgs(kind, args))}|${seed}`) + check(`${seed}|${uid}`);

const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
const int = (v, max = 1e7) => Math.max(0, Math.min(max, Math.round(+v || 0)));

/** رمز تحدٍّ من جولة لعبتها: kind = 'custom' | 'level' */
export function makeChallengeCode({ uid, name, kind, args, seed, score, popped }) {
  return enc('QC', [1, uid, cleanName(name), kind === 'level' ? 'l' : 'c', packArgs(kind, args), seed >>> 0, int(score), int(popped)]);
}
/** رمز النتيجة لتحدٍّ لعبته */
export function makeResultCode({ uid, name, id, score, popped }) {
  return enc('QR', [1, uid, cleanName(name), id, int(score), int(popped)]);
}

/** يفك أي رمز (حتى لو لُصق داخل رسالة كاملة). يرمي خطأ برسالة: format | checksum | version | … */
export function decodeCode(text) {
  const { type, arr } = dec(text);
  if (arr[0] !== 1) throw new Error('version');
  if (type === 'QC') {
    const [, uid, name, k, packed, seed, score, popped] = arr;
    const kind = k === 'l' ? 'level' : 'custom';
    const args = unpackArgs(kind, packed);
    if (!Number.isInteger(seed) || seed < 0) throw new Error('seed');
    return { type: 'challenge', uid: String(uid).slice(0, 12), name: cleanName(name), kind, args, seed, score: int(score), popped: int(popped), id: challengeId(uid, kind, args, seed) };
  }
  const [, uid, name, id, score, popped] = arr;
  return { type: 'result', uid: String(uid).slice(0, 12), name: cleanName(name), id: String(id).slice(0, 12), score: int(score), popped: int(popped) };
}

/* =========================================================================
   الحالة المحلية: هويتي (معرّف عشوائي)، التحديات المرسلة والمستلمة، والحصيلة مع كل صديق
   ========================================================================= */
export function ensureSocial(d) {
  const s = (d.social && typeof d.social === 'object') ? d.social : {};
  if (!s.uid) s.uid = Math.random().toString(36).slice(2, 8);
  s.list = Array.isArray(s.list) ? s.list.filter((c) => c && typeof c === 'object' && c.args && (c.dir === 'sent' || c.dir === 'recv')).slice(-100) : [];
  for (const c of s.list) if (c.dir === 'sent' && !Array.isArray(c.replies)) c.replies = [];
  d.social = s;
  return s;
}
const find = (s, id, dir) => s.list.find((c) => c.id === id && c.dir === dir);

/** يسجّل تحدّيًا أرسلته (مرة واحدة لكل جولة) ويعيد رمزه */
export function addSent(d, { runId, name, kind, args, seed, score, popped }, now = Date.now()) {
  const s = ensureSocial(d);
  const id = challengeId(s.uid, kind, args, seed);
  let c = find(s, id, 'sent');
  if (!c) { c = { id, dir: 'sent', runId, kind, args, seed, mine: int(score), minePopped: int(popped), replies: [], created: now }; s.list.push(c); }
  const code = makeChallengeCode({ uid: s.uid, name, kind, args, seed, score: c.mine, popped: c.minePopped });
  return { challenge: c, code, isNew: c.created === now };
}
/** يسجّل تحدّيًا وصلني (قبل اللعب) */
export function addReceived(d, ch, now = Date.now()) {
  const s = ensureSocial(d);
  if (ch.uid === s.uid) return { own: true, challenge: find(s, ch.id, 'sent') };
  let c = find(s, ch.id, 'recv');
  if (!c) { c = { id: ch.id, dir: 'recv', friendUid: ch.uid, friendName: ch.name, kind: ch.kind, args: ch.args, seed: ch.seed, theirs: ch.score, theirsPopped: ch.popped, mine: null, created: now }; s.list.push(c); }
  return { own: false, challenge: c };
}
/** نتيجتي في تحدٍّ وصلني (أفضل محاولة تُحفظ) */
export function setMyAnswer(d, id, { score, popped }) {
  const c = find(ensureSocial(d), id, 'recv');
  if (!c) return null;
  if (c.mine == null || score > c.mine) { c.mine = int(score); c.minePopped = int(popped); }
  return c;
}
/** رمز نتيجة وصلني لتحدٍّ أرسلته */
export function applyResult(d, r) {
  const s = ensureSocial(d);
  const c = find(s, r.id, 'sent');
  if (!c) return { ok: false, reason: 'unknown' };
  const prev = c.replies.find((x) => x.uid === r.uid);
  if (prev) { prev.score = Math.max(prev.score, r.score); prev.name = r.name || prev.name; }
  else c.replies.push({ uid: r.uid, name: r.name, score: r.score, popped: r.popped });
  return { ok: true, challenge: c, outcome: outcome(c.mine, r.score) };
}
export const outcome = (mine, theirs) => (mine == null || theirs == null ? null : mine > theirs ? 'win' : mine < theirs ? 'lose' : 'draw');

/** الحصيلة مع كل صديق (من التحديات المكتملة في الاتجاهين) */
export function friendsRecord(d) {
  const s = ensureSocial(d);
  const out = {};
  const add = (uid, name, res) => {
    if (!res) return;
    const f = (out[uid] ||= { uid, name, w: 0, l: 0, d: 0 });
    f.name = name || f.name;
    if (res === 'win') f.w++; else if (res === 'lose') f.l++; else f.d++;
  };
  for (const c of s.list) {
    if (c.dir === 'recv') add(c.friendUid, c.friendName, outcome(c.mine, c.theirs));
    else for (const r of c.replies || []) add(r.uid, r.name, outcome(c.mine, r.score));
  }
  return Object.values(out).sort((a, b) => (b.w + b.l + b.d) - (a.w + a.l + a.d));
}
