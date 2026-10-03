/* =========================================================================
   منطق الخادم: اللاعبون، الجولات والتحقق منها، لوحات الصدارة، البطولات،
   المواسم، الأصدقاء، التحديات، والإعلانات.
   كل نتيجة تُحسب هنا بإعادة تشغيل سجل الإدخال على محرّك المطر نفسه —
   لا يُقبل أي رقم يرسله الجهاز مباشرة.
   ========================================================================= */
import { randomBytes, createHash } from 'node:crypto';
import { replayRain, plausible, stormConfig, survivalConfig, rainConfig, TICK_MS } from '../public/src/core/rain.js';

export const OCCASIONS = {
  ramadan: { icon: '🌙', color: '#9B8CFF', ar: 'رمضان', en: 'Ramadan' },
  eid: { icon: '🎉', color: '#3DDC97', ar: 'العيد', en: 'Eid' },
  national_day: { icon: '💚', color: '#1FA463', ar: 'اليوم الوطني', en: 'National Day' },
  founding_day: { icon: '🏰', color: '#C8913A', ar: 'يوم التأسيس', en: 'Founding Day' },
  summer: { icon: '☀️', color: '#FF9F5A', ar: 'الصيف', en: 'Summer' },
  back_to_school: { icon: '🎒', color: '#38D6F5', ar: 'العودة للمدارس', en: 'Back to School' },
  winter: { icon: '❄️', color: '#9FE7FF', ar: 'الشتاء', en: 'Winter' },
  new_year: { icon: '🎆', color: '#FF7BB0', ar: 'العام الجديد', en: 'New Year' },
  math_day: { icon: '🔢', color: '#38D6F5', ar: 'اليوم الدولي للرياضيات', en: 'International Day of Mathematics' },
  weekend_storm: { icon: '⛈️', color: '#7B8CFF', ar: 'عاصفة نهاية الأسبوع', en: 'Weekend Storm' },
  nations_cup: { icon: '🌍', color: '#5AD1A0', ar: 'كأس الدول', en: 'Nations Cup' },
  custom: { icon: '🏆', color: '#FFC94A', ar: 'بطولة', en: 'Tournament' },
};
export const EMOTES = ['👏', '🔥', '😮', '😂', '💪', '🎉', '👋', '❤️'];
export const DUEL = { diff: 'medium', seconds: 60 };
export const WEEKLY = { diff: 'medium', seconds: 60 };

const BAD_WORDS = ['كلب', 'حمار', 'غبي', 'لعن', 'زق', 'fuck', 'shit', 'bitch', 'sex', 'porn', 'nazi', 'dick'];

export const newId = (p = '') => p + randomBytes(9).toString('base64url');
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
export const isoWeek = (ms = Date.now()) => {
  const d = new Date(ms); const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round(((d - firstThu) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
};

export class HttpError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }

export function cleanName(name) {
  const n = String(name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 16) throw new HttpError(400, 'name_length');
  if (!/^[\p{L}\p{N} _.-]+$/u.test(n)) throw new HttpError(400, 'name_chars');
  const low = n.toLowerCase();
  if (BAD_WORDS.some((w) => low.includes(w))) throw new HttpError(400, 'name_blocked');
  return n;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
export function validCountry(c) {
  if (!/^[A-Z]{2}$/.test(c) || ['EU', 'UN', 'XX', 'ZZ', 'AQ'].includes(c)) return false;
  try { return regionNames.of(c) !== c; } catch { return false; }
}

/** يقبل إعدادات مطر من العميل بحدود آمنة فقط (لا جولات لا نهائية ولا أرقام غريبة) */
export function sanitizeCfg(cfg) {
  if (!cfg || typeof cfg !== 'object') throw new HttpError(400, 'bad_cfg');
  const base = rainConfig();
  const out = {};
  for (const k of Object.keys(base)) if (k in cfg) out[k] = cfg[k];
  const c = { ...base, ...out };
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const ok = num(c.travel, 2, 30) && num(c.spawn, 0.3, 10) && num(c.maxDrops, 1, 8)
    && (c.lives == null || num(c.lives, 1, 9)) && (c.timeLimit == null || num(c.timeLimit, 10, 300)) && (c.target == null || num(c.target, 1, 200))
    && (c.lives != null || c.timeLimit != null || c.target != null)
    && (c.ramp == null || (typeof c.ramp === 'object' && num(c.ramp.every ?? 5, 1, 100) && num(c.ramp.mul ?? 0.94, 0.5, 1) && num(c.ramp.tierEvery ?? 8, 1, 100) && num(c.ramp.tierMax ?? 2, 0, 9)))
    && typeof c.specials === 'boolean'
    && c.tiers && typeof c.tiers === 'object' && Object.entries(c.tiers).every(([k, v]) => /^[a-z]{2,8}$/.test(k) && num(v, 0, 9))
    && c.formats && typeof c.formats === 'object' && Object.entries(c.formats).every(([k, v]) => ['input', 'missing'].includes(k) && num(v, 0, 9));
  if (!ok || JSON.stringify(c).length > 2000) throw new HttpError(400, 'bad_cfg');
  return c;
}

export function rulesToCfg(rules) {
  const diff = ['easy', 'medium', 'hard', 'expert'].includes(rules.diff) ? rules.diff : 'medium';
  if (rules.mode === 'survival') return { ...survivalConfig(diff), timeLimit: 15 * 60 };
  const secs = Math.max(30, Math.min(300, rules.seconds | 0 || 60));
  return stormConfig(diff, secs, rules.specials !== false);
}

export function createServices(db, { now = () => Date.now() } = {}) {
  const S = {};

  /* ---------------- اللاعبون ---------------- */
  S.register = (name, country = null) => {
    const id = newId('p_');
    const token = randomBytes(24).toString('base64url');
    let nm;
    try { nm = cleanName(name); } catch { nm = 'قطرة' + (1000 + Math.floor(Math.random() * 9000)); }
    let code;
    for (let i = 0; i < 20; i++) { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); if (!db.get('SELECT 1 FROM players WHERE code=?', code)) break; }
    const cc = country && validCountry(String(country).toUpperCase()) ? String(country).toUpperCase() : null;
    db.run('INSERT INTO players(id, token_hash, name, code, created, last_seen, country) VALUES (?,?,?,?,?,?,?)', id, hashToken(token), nm, code, now(), now(), cc);
    return { id, token, name: nm, code };
  };
  S.auth = (token) => {
    if (!token) return null;
    const h = hashToken(token);
    let p = db.get('SELECT * FROM players WHERE token_hash=?', h);
    if (!p) p = db.get('SELECT p.* FROM player_tokens t JOIN players p ON p.id=t.player_id WHERE t.token_hash=?', h);
    if (!p) return null;
    if (p.banned) throw new HttpError(403, 'banned');
    db.run('UPDATE players SET last_seen=? WHERE id=?', now(), p.id);
    return p;
  };
  /** حذف الحساب وكل بياناته (متطلب من Google Play) */
  S.deleteAccount = (pid) => db.tx(() => {
    for (const c of db.all('SELECT id FROM clubs WHERE owner=?', pid)) { db.run('DELETE FROM club_members WHERE club_id=?', c.id); db.run('DELETE FROM clubs WHERE id=?', c.id); }
    for (const sql of ['DELETE FROM runs WHERE player_id=?', 'DELETE FROM player_tokens WHERE player_id=?', 'DELETE FROM club_members WHERE player_id=?', 'DELETE FROM friends WHERE a=? OR b=?', 'DELETE FROM season_ratings WHERE player_id=?',
      'DELETE FROM rewards WHERE player_id=?', 'DELETE FROM challenges WHERE creator=?', 'DELETE FROM players WHERE id=?']) {
      const n = (sql.match(/\?/g) || []).length;
      db.run(sql, ...Array(n).fill(pid));
    }
  });
  /**
   * ربط Google Play Games: حساب Play هو المرجع الدائم للاعب.
   *  - إن كان حساب Play مربوطًا مسبقًا بلاعب ← نعيد هوية ذلك اللاعب (استرجاع التقدّم على جهاز جديد).
   *  - وإلا إن كان على الجهاز لاعب غير مربوط ← نربطه به.
   *  - وإلا ← ننشئ لاعبًا جديدًا باسم Play.
   * عند الاسترجاع يصدر رمز دخول إضافي لهذا الجهاز (الأجهزة الأخرى تبقى مسجّلة). token=null يعني: احتفظ برمزك.
   */
  S.linkPlayGames = (pgsId, displayName, currentPid = null) => db.tx(() => {
    if (!pgsId || typeof pgsId !== 'string' || pgsId.length > 128) throw new HttpError(400, 'bad_player');
    let p = db.get('SELECT * FROM players WHERE pgs_id=?', pgsId);
    let linked = false;
    if (!p && currentPid) {
      const cur = db.get('SELECT * FROM players WHERE id=?', currentPid);
      if (cur && !cur.pgs_id) { db.run('UPDATE players SET pgs_id=? WHERE id=?', pgsId, cur.id); p = { ...cur, pgs_id: pgsId }; linked = true; }
    }
    if (!p) {
      const r = S.register(displayName);
      db.run('UPDATE players SET pgs_id=? WHERE id=?', pgsId, r.id);
      return { ...r, created: true, linked: false };
    }
    if (p.banned) throw new HttpError(403, 'banned');
    if (linked || p.id === currentPid) return { id: p.id, token: null, name: p.name, code: p.code, created: false, linked };
    const token = randomBytes(24).toString('base64url');
    db.run('INSERT INTO player_tokens(token_hash, player_id, created) VALUES (?,?,?)', hashToken(token), p.id, now());
    // حدّ معقول للأجهزة: نُبقي أحدث ١٠ رموز
    db.run('DELETE FROM player_tokens WHERE player_id=? AND token_hash NOT IN (SELECT token_hash FROM player_tokens WHERE player_id=? ORDER BY created DESC LIMIT 10)', p.id, p.id);
    return { id: p.id, token, name: p.name, code: p.code, created: false, linked };
  });
  S.publicPlayer = (p) => ({ id: p.id, name: p.name, code: p.code, skin: p.skin, country: p.country || null });

  /* ---------------- النوادي (مجموعات: معلم وطلابه، مدرّب، أصدقاء، فريق عمل) ---------------- */
  const CLUB_MAX = 200, CLUBS_OWNED = 10, CLUBS_JOINED = 20;
  const clubCode = () => { for (let i = 0; i < 30; i++) { const c = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); if (!db.get('SELECT 1 FROM clubs WHERE code=?', c)) return c; } throw new Error('code'); };
  const clubOf = (id) => { const c = db.get('SELECT * FROM clubs WHERE id=?', id); if (!c) throw new HttpError(404, 'not_found'); return c; };
  const isMember = (cid, pid) => !!db.get('SELECT 1 FROM club_members WHERE club_id=? AND player_id=?', cid, pid);
  S.createClub = (pid, name) => {
    const nm = cleanName(name);
    if (db.get('SELECT COUNT(*) AS n FROM clubs WHERE owner=?', pid).n >= CLUBS_OWNED) throw new HttpError(429, 'too_many_clubs');
    const id = newId('c_'), code = clubCode();
    db.tx(() => {
      db.run('INSERT INTO clubs(id, code, name, owner, created) VALUES (?,?,?,?,?)', id, code, nm, pid, now());
      db.run('INSERT INTO club_members(club_id, player_id, joined) VALUES (?,?,?)', id, pid, now());
    });
    return { id, code, name: nm };
  };
  S.joinClub = (pid, code) => {
    const c = db.get('SELECT * FROM clubs WHERE code=?', String(code || '').trim().toUpperCase());
    if (!c) throw new HttpError(404, 'club_not_found');
    if (isMember(c.id, pid)) return { id: c.id, name: c.name };
    if (db.get('SELECT COUNT(*) AS n FROM club_members WHERE club_id=?', c.id).n >= CLUB_MAX) throw new HttpError(409, 'club_full');
    if (db.get('SELECT COUNT(*) AS n FROM club_members WHERE player_id=?', pid).n >= CLUBS_JOINED) throw new HttpError(429, 'too_many_clubs');
    db.run('INSERT INTO club_members(club_id, player_id, joined) VALUES (?,?,?)', c.id, pid, now());
    return { id: c.id, name: c.name };
  };
  S.myClubs = (pid) => db.all(`SELECT c.id, c.code, c.name, c.owner = ? AS mine, (SELECT COUNT(*) FROM club_members m2 WHERE m2.club_id=c.id) AS members
    FROM clubs c JOIN club_members m ON m.club_id=c.id WHERE m.player_id=? ORDER BY c.created DESC`, pid, pid).map((c) => ({ ...c, mine: !!c.mine }));
  /** صفحة النادي: الأعضاء مرتبين بنقاط الأسبوع. المالك يرى نشاط كل عضو (جولات، دقة، آخر ظهور) */
  S.getClub = (pid, id) => {
    const c = clubOf(id);
    if (!isMember(c.id, pid)) throw new HttpError(403, 'not_member');
    const per = weeklyPoints(isoWeek(now()));
    const owner = c.owner === pid;
    const weekStart = now() - 7 * 864e5;
    const members = db.all(`SELECT p.id, p.name, p.skin, p.last_seen FROM club_members m JOIN players p ON p.id=m.player_id WHERE m.club_id=?`, c.id).map((m) => {
      const out = { id: m.id, name: m.name, skin: m.skin, points: per.get(m.id)?.pts || 0, days: per.get(m.id)?.days || 0, me: m.id === pid, owner: m.id === c.owner };
      if (owner) {
        const a = db.get('SELECT COUNT(*) AS n, AVG(accuracy) AS acc FROM runs WHERE player_id=? AND valid=1 AND started>=?', m.id, weekStart);
        Object.assign(out, { runs: a.n, accuracy: a.acc == null ? null : Math.round(a.acc * 100), lastSeen: m.last_seen });
      }
      return out;
    }).sort((a, b) => b.points - a.points).map((m, i) => ({ ...m, rank: i + 1 }));
    return { id: c.id, name: c.name, code: c.code, owner, members, points: clubPoints(members) };
  };
  const clubPoints = (members) => members.map((m) => m.points).sort((a, b) => b - a).slice(0, 30).reduce((s2, x) => s2 + x, 0);
  S.leaveClub = (pid, id, target = null) => {
    const c = clubOf(id);
    const who = target || pid;
    if (who !== pid && c.owner !== pid) throw new HttpError(403, 'owner_only');
    if (who === c.owner) throw new HttpError(400, 'owner_cannot_leave');
    db.run('DELETE FROM club_members WHERE club_id=? AND player_id=?', c.id, who);
  };
  S.deleteClub = (pid, id) => {
    const c = clubOf(id);
    if (c.owner !== pid) throw new HttpError(403, 'owner_only');
    db.tx(() => { db.run('DELETE FROM club_members WHERE club_id=?', c.id); db.run('DELETE FROM clubs WHERE id=?', c.id); });
  };
  /** دوري النوادي الأسبوعي: نقاط النادي = مجموع أفضل ٣٠ عضوًا (نوادٍ بثلاثة أعضاء على الأقل) */
  S.clubLeague = (pid = null) => {
    const per = weeklyPoints(isoWeek(now()));
    const rows = db.all('SELECT club_id, player_id FROM club_members');
    const by = new Map();
    for (const r of rows) { const a = by.get(r.club_id) || []; a.push(per.get(r.player_id)?.pts || 0); by.set(r.club_id, a); }
    const mine = new Set(pid ? db.all('SELECT club_id FROM club_members WHERE player_id=?', pid).map((r) => r.club_id) : []);
    const names = new Map(db.all('SELECT id, name FROM clubs').map((c) => [c.id, c.name]));
    return [...by.entries()].filter(([, a]) => a.length >= 3).map(([id, a]) => ({ id, name: names.get(id), members: a.length, points: a.sort((x, y) => y - x).slice(0, 30).reduce((s2, x) => s2 + x, 0), mine: mine.has(id) }))
      .filter((x) => x.points > 0).sort((a, b) => b.points - a.points).slice(0, 50).map((x, i) => ({ ...x, rank: i + 1 }));
  };

  /* ---------------- دوري الدول ---------------- */
  /** يقبل رمز دولة ISO صالحًا فقط. التغيير مسموح مرة كل ٧ أيام (منعًا للتنقل بين الدول لرفع النقاط) */
  S.setCountry = (p, code) => {
    const c = String(code || '').toUpperCase();
    if (!validCountry(c)) throw new HttpError(400, 'bad_country');
    if (p.country === c) return c;
    if (p.country && p.country_set && now() - p.country_set < 7 * 864e5) throw new HttpError(429, 'country_locked');
    db.run('UPDATE players SET country=?, country_set=? WHERE id=?', c, now(), p.id);
    return c;
  };
  /**
   * نقاط الدولة هذا الأسبوع: لكل لاعب مجموع أفضل نتيجة له في كل يوم (يكافئ الانتظام لا جولة واحدة)،
   * ثم مجموع أفضل ١٠٠ لاعب من كل دولة (حتى لا تفوز الدول الكبيرة بالعدد وحده).
   */
  /** نقاط كل لاعب هذا الأسبوع = مجموع أفضل نتيجة له في كل يوم */
  const weeklyPoints = (week) => {
    const rows = db.all(`SELECT r.player_id AS pid, p.country, date(r.started/1000, 'unixepoch') AS d, MAX(r.score) AS best
      FROM runs r JOIN players p ON p.id=r.player_id
      WHERE r.valid=1 AND r.week=? AND p.banned=0 GROUP BY r.player_id, d`, week);
    const per = new Map();
    for (const r of rows) { const x = per.get(r.pid) || { country: r.country, pts: 0, days: 0 }; x.pts += r.best || 0; x.days++; per.set(r.pid, x); }
    return per;
  };
  S.nations = (pid = null) => {
    const week = isoWeek(now());
    const per = weeklyPoints(week);
    for (const [k, x] of per) if (!x.country) per.delete(k);
    const byC = new Map();
    for (const [id, x] of per) { const a = byC.get(x.country) || []; a.push({ id, pts: x.pts }); byC.set(x.country, a); }
    const list = [...byC.entries()].map(([country, ps]) => {
      ps.sort((a, b) => b.pts - a.pts);
      return { country, points: ps.slice(0, 100).reduce((s, x) => s + x.pts, 0), players: ps.length };
    }).sort((a, b) => b.points - a.points).map((x, i) => ({ ...x, rank: i + 1 }));
    let mine = null;
    if (pid) {
      const me = db.get('SELECT country FROM players WHERE id=?', pid);
      if (me?.country) {
        const row = list.find((x) => x.country === me.country);
        const ps = (byC.get(me.country) || []).sort((a, b) => b.pts - a.pts);
        const idx = ps.findIndex((x) => x.id === pid);
        mine = { country: me.country, rank: row?.rank || null, points: row?.points || 0, myPoints: per.get(pid)?.pts || 0, myRank: idx >= 0 ? idx + 1 : null, players: row?.players || 0 };
      }
    }
    return { week, list: list.slice(0, 60), mine };
  };
  S.rename = (p, name) => { const n = cleanName(name); db.run('UPDATE players SET name=? WHERE id=?', n, p.id); return n; };
  S.setSkin = (p, skin) => { if (/^[a-z]{2,10}$/.test(skin)) db.run('UPDATE players SET skin=? WHERE id=?', skin, p.id); };

  /* ---------------- المواسم ---------------- */
  S.currentSeason = () => {
    let s = db.get('SELECT * FROM seasons WHERE starts<=? AND (ends IS NULL OR ends>?) ORDER BY starts DESC LIMIT 1', now(), now());
    if (!s) {
      const id = newId('s_');
      db.run('INSERT INTO seasons(id, name_ar, name_en, color, starts) VALUES (?,?,?,?,?)', id, 'الموسم الأول', 'Season 1', '#38D6F5', now());
      s = db.get('SELECT * FROM seasons WHERE id=?', id);
    }
    return s;
  };
  S.startSeason = ({ name_ar, name_en, color }) => {
    if (!name_ar) throw new HttpError(400, 'name_required');
    const t = now();
    db.run('UPDATE seasons SET ends=? WHERE ends IS NULL OR ends>?', t, t);
    const id = newId('s_');
    db.run('INSERT INTO seasons(id, name_ar, name_en, color, starts) VALUES (?,?,?,?,?)', id, name_ar, name_en || name_ar, color || '#38D6F5', t + 1);
    return db.get('SELECT * FROM seasons WHERE id=?', id);
  };
  S.rating = (pid) => {
    const s = S.currentSeason();
    return db.get('SELECT rating, games, wins FROM season_ratings WHERE season_id=? AND player_id=?', s.id, pid) || { rating: 1000, games: 0, wins: 0 };
  };
  /** تحديث تصنيف Elo بعد مباراة حقيقية (لا يشمل الأشباح) */
  S.applyElo = (standings) => {
    const s = S.currentSeason();
    const R = Object.fromEntries(standings.map((x) => [x.id, S.rating(x.id).rating]));
    const delta = Object.fromEntries(standings.map((x) => [x.id, 0]));
    for (const a of standings) for (const b of standings) {
      if (a.id >= b.id) continue;
      const ea = 1 / (1 + 10 ** ((R[b.id] - R[a.id]) / 400));
      const sa = a.score > b.score ? 1 : a.score < b.score ? 0 : 0.5;
      const k = 32 / Math.max(1, standings.length - 1);
      delta[a.id] += k * (sa - ea); delta[b.id] -= k * (sa - ea);
    }
    const out = {};
    for (const x of standings) {
      const before = R[x.id], after = Math.max(100, Math.round(before + delta[x.id]));
      const won = standings.every((o) => o.id === x.id || x.score > o.score) ? 1 : 0;
      db.run(`INSERT INTO season_ratings(season_id, player_id, rating, games, wins) VALUES (?,?,?,1,?)
        ON CONFLICT(season_id, player_id) DO UPDATE SET rating=excluded.rating, games=games+1, wins=wins+excluded.wins`, s.id, x.id, after, won);
      out[x.id] = { before, after };
    }
    return out;
  };

  /* ---------------- الجولات والتحقق ---------------- */
  S.startRun = (pid, { kind, ref = null, seed, cfg, started = now() }) => {
    const id = newId('r_');
    db.run('INSERT INTO runs(id, player_id, kind, ref, seed, cfg, started, week) VALUES (?,?,?,?,?,?,?,?)', id, pid, kind, ref, String(seed), JSON.stringify(cfg), started, isoWeek(started));
    return id;
  };
  /**
   * يتحقق من جولة: يعيد تشغيل السجل، يفحص التوقيت والمعقولية، ويحفظ النتيجة.
   * opts.realtime: يجب أن يكون الزمن الحقيقي المنقضي متسقًا مع طول الجولة.
   */
  S.submitRun = (pid, runId, { log, endTick }, { realtime = true } = {}) => {
    const run = db.get('SELECT * FROM runs WHERE id=?', runId);
    if (!run || run.player_id !== pid) throw new HttpError(404, 'run_not_found');
    if (run.submitted) throw new HttpError(409, 'already_submitted');
    if (!Array.isArray(log) || log.length > 30000) throw new HttpError(400, 'bad_log');
    const cleanLog = [];
    let prev = -1;
    for (const e of log) {
      if (!Array.isArray(e) || e.length !== 2) throw new HttpError(400, 'bad_log');
      const [tk, k] = e;
      if (!Number.isInteger(tk) || tk < prev || tk < 0 || !/^(\d|-|back|clear|ok)$/.test(String(k))) throw new HttpError(400, 'bad_log');
      prev = tk; cleanLog.push([tk, String(k)]);
    }
    const cfg = JSON.parse(run.cfg);
    const maxTicks = (cfg.timeLimit ? cfg.timeLimit : 15 * 60) * 60;
    const et = Number.isInteger(endTick) ? Math.min(endTick, maxTicks) : maxTicks;
    const { summary, timeline } = replayRain(cfg, run.seed, cleanLog, { endTick: et, maxTicks });
    let valid = plausible(summary) ? 1 : 0;
    if (realtime) {
      const elapsed = now() - run.started;
      const played = summary.ticks * TICK_MS;
      if (elapsed + 3000 < played) valid = 0;            // أسرع من الزمن الحقيقي = تلاعب
      if (elapsed > played + 10 * 60 * 1000) valid = 0;  // تأخّر غير منطقي (تشغيل بطيء)
    }
    db.run('UPDATE runs SET submitted=?, score=?, popped=?, accuracy=?, ticks=?, valid=?, timeline=? WHERE id=?',
      now(), summary.score, summary.popped, summary.accuracy, summary.ticks, valid, JSON.stringify(timeline.slice(-400)), runId);
    return { score: summary.score, popped: summary.popped, accuracy: summary.accuracy, ticks: summary.ticks, valid: !!valid, summary };
  };

  /* ---------------- لوحات الصدارة ---------------- */
  const bestByPlayer = (where, params, limit = 50) => db.all(`
    SELECT p.id, p.name, p.skin, MAX(r.score) AS score FROM runs r JOIN players p ON p.id=r.player_id
    WHERE r.valid=1 AND p.banned=0 AND ${where} GROUP BY p.id ORDER BY score DESC, MIN(r.submitted) ASC LIMIT ?`, ...params, limit);
  S.leaderboard = (board, { pid = null, ref = null } = {}) => {
    let rows;
    if (board === 'weekly') rows = bestByPlayer("r.kind='weekly' AND r.week=?", [isoWeek(now())]);
    else if (board === 'alltime') rows = bestByPlayer("r.kind IN ('weekly','duel','room','tournament')", []);
    else if (board === 'daily') rows = bestByPlayer("r.kind='daily' AND r.ref=?", [ref || new Date(now()).toISOString().slice(0, 10)]);
    else if (board === 'tournament') rows = bestByPlayer("r.kind='tournament' AND r.ref=?", [ref]);
    else if (board === 'season') {
      const s = S.currentSeason();
      rows = db.all(`SELECT p.id, p.name, p.skin, sr.rating AS score, sr.games, sr.wins FROM season_ratings sr JOIN players p ON p.id=sr.player_id
        WHERE sr.season_id=? AND p.banned=0 ORDER BY sr.rating DESC, sr.wins DESC LIMIT 50`, s.id);
    } else if (board === 'friends') {
      const ids = [pid, ...S.friendIds(pid)];
      rows = bestByPlayer(`r.kind='weekly' AND r.week=? AND p.id IN (${ids.map(() => '?').join(',')})`, [isoWeek(now()), ...ids]);
    } else throw new HttpError(400, 'bad_board');
    const list = rows.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, skin: r.skin, score: r.score, games: r.games, wins: r.wins, me: r.id === pid }));
    let mine = list.find((x) => x.me) || null;
    if (!mine && pid && board !== 'season' && board !== 'friends') {
      const all = board === 'weekly' ? bestByPlayer("r.kind='weekly' AND r.week=?", [isoWeek(now())], 100000)
        : board === 'tournament' ? bestByPlayer("r.kind='tournament' AND r.ref=?", [ref], 100000) : [];
      const idx = all.findIndex((r) => r.id === pid);
      if (idx >= 0) mine = { rank: idx + 1, id: pid, name: all[idx].name, score: all[idx].score, me: true };
    }
    return { board, list, mine };
  };

  /* ---------------- البطولات ---------------- */
  const tStatus = (t) => !t.enabled ? 'disabled' : now() < t.starts ? 'upcoming' : now() >= t.ends ? 'ended' : 'active';
  const pubT = (t, pid) => {
    const rules = JSON.parse(t.rules), prize = JSON.parse(t.prize);
    const occ = OCCASIONS[t.occasion] || OCCASIONS.custom;
    const out = { id: t.id, name_ar: t.name_ar, name_en: t.name_en || t.name_ar, desc_ar: t.desc_ar || '', desc_en: t.desc_en || t.desc_ar || '',
      occasion: t.occasion, icon: t.icon || occ.icon, color: t.color || occ.color, starts: t.starts, ends: t.ends, rules, prize, status: tStatus(t) };
    if (pid) {
      const r = db.get("SELECT COUNT(*) AS n, MAX(CASE WHEN valid=1 THEN score END) AS best FROM runs WHERE kind='tournament' AND ref=? AND player_id=?", t.id, pid);
      out.attemptsUsed = r.n; out.best = r.best;
      out.players = db.get("SELECT COUNT(DISTINCT player_id) AS n FROM runs WHERE kind='tournament' AND ref=?", t.id).n;
    }
    return out;
  };
  S.validateTournament = (b, existing = {}) => {
    const t = { ...existing, ...b };
    if (!t.name_ar || String(t.name_ar).length > 60) throw new HttpError(400, 'name_required');
    if (!(Number(t.starts) > 0) || !(Number(t.ends) > Number(t.starts))) throw new HttpError(400, 'bad_dates');
    const rules = typeof t.rules === 'string' ? JSON.parse(t.rules) : (t.rules || {});
    const r = { mode: rules.mode === 'survival' ? 'survival' : 'storm', diff: ['easy', 'medium', 'hard', 'expert'].includes(rules.diff) ? rules.diff : 'medium',
      seconds: Math.max(30, Math.min(300, rules.seconds | 0 || 60)), attempts: Math.max(0, Math.min(100, rules.attempts | 0)), fixedSeed: !!rules.fixedSeed,
      specials: rules.specials !== false, seed: rules.seed || randomBytes(6).toString('hex') };
    const prize = typeof t.prize === 'string' ? JSON.parse(t.prize) : (t.prize || {});
    const p = { topN: Math.max(0, Math.min(100, prize.topN | 0 || 3)), label_ar: String(prize.label_ar || 'بطل البطولة').slice(0, 60), label_en: String(prize.label_en || prize.label_ar || 'Champion').slice(0, 60) };
    return { name_ar: String(t.name_ar).slice(0, 60), name_en: String(t.name_en || '').slice(0, 60), desc_ar: String(t.desc_ar || '').slice(0, 300), desc_en: String(t.desc_en || '').slice(0, 300),
      occasion: OCCASIONS[t.occasion] ? t.occasion : 'custom', color: /^#[0-9a-fA-F]{6}$/.test(t.color || '') ? t.color : null, icon: t.icon ? String(t.icon).slice(0, 4) : null,
      starts: Number(t.starts), ends: Number(t.ends), rules: r, prize: p, enabled: t.enabled === false || t.enabled === 0 ? 0 : 1 };
  };
  S.createTournament = (b) => {
    const v = S.validateTournament(b);
    const id = newId('t_');
    db.run(`INSERT INTO tournaments(id,name_ar,name_en,desc_ar,desc_en,occasion,color,icon,starts,ends,rules,prize,enabled,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, v.name_ar, v.name_en, v.desc_ar, v.desc_en, v.occasion, v.color, v.icon, v.starts, v.ends, JSON.stringify(v.rules), JSON.stringify(v.prize), v.enabled, now());
    return pubT(db.get('SELECT * FROM tournaments WHERE id=?', id));
  };
  S.updateTournament = (id, b) => {
    const cur = db.get('SELECT * FROM tournaments WHERE id=?', id);
    if (!cur) throw new HttpError(404, 'not_found');
    const v = S.validateTournament(b, { ...cur, rules: JSON.parse(cur.rules), prize: JSON.parse(cur.prize) });
    db.run(`UPDATE tournaments SET name_ar=?,name_en=?,desc_ar=?,desc_en=?,occasion=?,color=?,icon=?,starts=?,ends=?,rules=?,prize=?,enabled=? WHERE id=?`,
      v.name_ar, v.name_en, v.desc_ar, v.desc_en, v.occasion, v.color, v.icon, v.starts, v.ends, JSON.stringify(v.rules), JSON.stringify(v.prize), v.enabled, id);
    return pubT(db.get('SELECT * FROM tournaments WHERE id=?', id));
  };
  S.deleteTournament = (id) => { db.run('DELETE FROM tournaments WHERE id=?', id); };
  S.endTournament = (id) => { db.run('UPDATE tournaments SET ends=? WHERE id=? AND ends>?', now(), id, now()); S.finalizeTournaments(); };
  S.listTournaments = (pid, { all = false } = {}) => {
    S.finalizeTournaments();
    const rows = all ? db.all('SELECT * FROM tournaments ORDER BY starts DESC')
      : db.all('SELECT * FROM tournaments WHERE enabled=1 AND ends>? ORDER BY starts ASC', now() - 3 * 864e5);
    return rows.map((t) => pubT(t, pid));
  };
  S.getTournament = (id, pid) => { const t = db.get('SELECT * FROM tournaments WHERE id=?', id); if (!t) throw new HttpError(404, 'not_found'); return pubT(t, pid); };
  S.startTournamentRun = (pid, id) => {
    const t = db.get('SELECT * FROM tournaments WHERE id=?', id);
    if (!t) throw new HttpError(404, 'not_found');
    if (tStatus(t) !== 'active') throw new HttpError(409, 'not_active');
    const rules = JSON.parse(t.rules);
    const used = db.get("SELECT COUNT(*) AS n FROM runs WHERE kind='tournament' AND ref=? AND player_id=?", id, pid).n;
    if (rules.attempts && used >= rules.attempts) throw new HttpError(409, 'no_attempts');
    const cfg = rulesToCfg(rules);
    const seed = rules.fixedSeed ? 'T:' + rules.seed : 'T:' + randomBytes(6).toString('hex');
    const runId = S.startRun(pid, { kind: 'tournament', ref: id, seed, cfg });
    return { runId, seed, cfg, attemptsLeft: rules.attempts ? rules.attempts - used - 1 : null };
  };
  /** يمنح جوائز البطولات المنتهية مرة واحدة */
  S.finalizeTournaments = () => {
    for (const t of db.all('SELECT * FROM tournaments WHERE finalized=0 AND enabled=1 AND ends<=?', now())) {
      const prize = JSON.parse(t.prize);
      const top = S.leaderboard('tournament', { ref: t.id }).list.slice(0, prize.topN || 3);
      const occ = OCCASIONS[t.occasion] || OCCASIONS.custom;
      db.tx(() => {
        for (const r of top) db.run('INSERT OR IGNORE INTO rewards(player_id, tournament_id, rank, label_ar, label_en, icon, created) VALUES (?,?,?,?,?,?,?)', r.id, t.id, r.rank, `${prize.label_ar} — ${t.name_ar}`, `${prize.label_en} — ${t.name_en || t.name_ar}`, t.icon || occ.icon, now());
        db.run('UPDATE tournaments SET finalized=1 WHERE id=?', t.id);
      });
    }
  };
  S.rewards = (pid) => db.all('SELECT tournament_id, rank, label_ar, label_en, icon, created FROM rewards WHERE player_id=? ORDER BY created DESC', pid);

  /* ---------------- العاصفة الأسبوعية واليومي ---------------- */
  S.startWeeklyRun = (pid) => {
    const cfg = stormConfig(WEEKLY.diff, WEEKLY.seconds, true);
    const seed = 'W:' + randomBytes(6).toString('hex');
    return { runId: S.startRun(pid, { kind: 'weekly', seed, cfg }), seed, cfg };
  };
  /** التحدي اليومي يُلعب على الجهاز (حتى بلا إنترنت) ثم تُرفع نتيجته الرسمية للتحقق */
  S.submitDaily = (pid, date, cfg, { log, endTick }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'bad_date');
    const d = Date.parse(date + 'T00:00:00Z');
    if (Math.abs(now() - d) > 2.5 * 864e5) throw new HttpError(409, 'stale_date');
    if (db.get("SELECT 1 FROM runs WHERE kind='daily' AND ref=? AND player_id=?", date, pid)) throw new HttpError(409, 'already_submitted');
    const runId = S.startRun(pid, { kind: 'daily', ref: date, seed: 'daily:' + date, cfg });
    return S.submitRun(pid, runId, { log, endTick }, { realtime: false });
  };

  /* ---------------- الأصدقاء ---------------- */
  S.friendIds = (pid) => db.all('SELECT b FROM friends WHERE a=?', pid).map((r) => r.b);
  S.addFriend = (pid, code) => {
    const f = db.get('SELECT id FROM players WHERE code=? AND banned=0', String(code || '').trim().toUpperCase());
    if (!f) throw new HttpError(404, 'code_not_found');
    if (f.id === pid) throw new HttpError(400, 'self');
    if (S.friendIds(pid).length >= 200) throw new HttpError(409, 'too_many');
    db.run('INSERT OR IGNORE INTO friends(a,b,created) VALUES (?,?,?)', pid, f.id, now());
    db.run('INSERT OR IGNORE INTO friends(a,b,created) VALUES (?,?,?)', f.id, pid, now());
    return f.id;
  };
  S.removeFriend = (pid, fid) => { db.run('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)', pid, fid, fid, pid); };
  S.friends = (pid, onlineSet = new Set()) => db.all(`
    SELECT p.id, p.name, p.skin, p.code, (SELECT MAX(score) FROM runs r WHERE r.player_id=p.id AND r.kind='weekly' AND r.week=? AND r.valid=1) AS weekly
    FROM friends f JOIN players p ON p.id=f.b WHERE f.a=? AND p.banned=0 ORDER BY p.name`, isoWeek(now()), pid)
    .map((f) => ({ ...f, online: onlineSet.has(f.id) }));

  /* ---------------- التحدي بالرابط ---------------- */
  S.createChallenge = (pid, runId) => {
    const run = db.get('SELECT * FROM runs WHERE id=? AND player_id=? AND valid=1', runId, pid);
    if (!run) throw new HttpError(404, 'run_not_found');
    const id = randomBytes(5).toString('base64url');
    db.run('INSERT INTO challenges(id, creator, seed, cfg, score, created, expires) VALUES (?,?,?,?,?,?,?)', id, pid, run.seed, run.cfg, run.score, now(), now() + 14 * 864e5);
    return id;
  };
  /**
   * تحدٍّ من جولة فردية لُعبت على الجهاز (بدون اتصال وقتها): الخادم يعيد تشغيلها من سجل الإدخال
   * ويعتمد النتيجة الناتجة فقط. لا تدخل لوحات الصدارة — هي تحدٍّ بين أصدقاء.
   */
  S.createLocalChallenge = (pid, { cfg, seed, log, endTick }) => {
    const c = sanitizeCfg(cfg);
    if (!(typeof seed === 'string' && seed.length <= 64) && !Number.isSafeInteger(seed)) throw new HttpError(400, 'bad_seed');
    if (!Array.isArray(log) || log.length > 20000 || !log.every((e) => Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= 0 && typeof e[1] === 'string' && e[1].length <= 4)) throw new HttpError(400, 'bad_log');
    if (!Number.isInteger(endTick) || endTick < 0 || endTick > 60 * 60 * 15) throw new HttpError(400, 'bad_end');
    const { summary } = replayRain(c, seed, log, { endTick });
    if (summary.popped < 1 || !plausible(summary)) throw new HttpError(422, 'run_invalid');
    const id = randomBytes(5).toString('base64url');
    const enc = typeof seed === 'number' ? '#' + seed : seed;
    db.run('INSERT INTO challenges(id, creator, seed, cfg, score, created, expires) VALUES (?,?,?,?,?,?,?)', id, pid, enc, JSON.stringify(c), summary.score, now(), now() + 14 * 864e5);
    return { id, score: summary.score };
  };
  S.getChallenge = (id) => {
    const c = db.get('SELECT c.*, p.name AS creator_name FROM challenges c JOIN players p ON p.id=c.creator WHERE c.id=?', id);
    if (!c || c.expires < now()) throw new HttpError(404, 'not_found');
    const best = db.all(`SELECT p.name, MAX(r.score) AS score FROM runs r JOIN players p ON p.id=r.player_id WHERE r.kind='challenge' AND r.ref=? AND r.valid=1 GROUP BY p.id ORDER BY score DESC LIMIT 20`, id);
    return { id, creator: c.creator_name, creatorId: c.creator, score: c.score, cfg: JSON.parse(c.cfg), takers: best };
  };
  S.startChallengeRun = (pid, id) => {
    const c = db.get('SELECT * FROM challenges WHERE id=?', id);
    if (!c || c.expires < now()) throw new HttpError(404, 'not_found');
    const seed = c.seed.startsWith('#') ? Number(c.seed.slice(1)) : c.seed;
    return { runId: S.startRun(pid, { kind: 'challenge', ref: id, seed, cfg: JSON.parse(c.cfg) }), seed, cfg: JSON.parse(c.cfg), target: c.score };
  };

  /* ---------------- الأشباح (جولات مسجّلة حقيقية) ---------------- */
  S.pickGhost = (pid) => {
    const r = db.get(`SELECT r.seed, r.cfg, r.timeline, r.score, p.name, p.id AS pid FROM runs r JOIN players p ON p.id=r.player_id
      WHERE r.kind IN ('duel','weekly') AND r.valid=1 AND r.player_id<>? AND r.timeline IS NOT NULL AND p.banned=0
      ORDER BY r.submitted DESC LIMIT 1 OFFSET ?`, pid, Math.floor(Math.random() * 10));
    return r || db.get(`SELECT r.seed, r.cfg, r.timeline, r.score, p.name, p.id AS pid FROM runs r JOIN players p ON p.id=r.player_id
      WHERE r.kind IN ('duel','weekly') AND r.valid=1 AND r.player_id<>? AND r.timeline IS NOT NULL AND p.banned=0 ORDER BY r.submitted DESC LIMIT 1`, pid) || null;
  };

  /* ---------------- الإعلانات والإعداد العام ---------------- */
  S.announcements = () => db.all('SELECT id, text_ar, text_en FROM announcements WHERE active=1 AND (starts IS NULL OR starts<=?) AND (ends IS NULL OR ends>?) ORDER BY created DESC LIMIT 3', now(), now());
  S.config = (pid) => {
    const season = S.currentSeason();
    const events = S.listTournaments(pid).filter((t) => t.status === 'active' || t.status === 'upcoming').slice(0, 5);
    const active = events.find((e) => e.status === 'active');
    return { serverTime: now(), season: { id: season.id, name_ar: season.name_ar, name_en: season.name_en, color: season.color, starts: season.starts },
      announcements: S.announcements(), events, theme: active ? { occasion: active.occasion, color: active.color, icon: active.icon, name_ar: active.name_ar, name_en: active.name_en } : null,
      occasions: OCCASIONS, emotes: EMOTES };
  };

  /* ---------------- الإدارة ---------------- */
  S.adminStats = (onlineCount = 0) => ({
    players: db.get('SELECT COUNT(*) AS n FROM players').n,
    active24h: db.get('SELECT COUNT(*) AS n FROM players WHERE last_seen>?', now() - 864e5).n,
    runsToday: db.get('SELECT COUNT(*) AS n FROM runs WHERE submitted>?', now() - 864e5).n,
    invalidToday: db.get('SELECT COUNT(*) AS n FROM runs WHERE submitted>? AND valid=0', now() - 864e5).n,
    online: onlineCount,
    season: S.currentSeason(),
  });
  S.searchPlayers = (qs) => db.all(`SELECT id, name, code, created, last_seen, banned FROM players WHERE name LIKE ? OR code=? ORDER BY last_seen DESC LIMIT 50`, `%${qs || ''}%`, String(qs || '').toUpperCase());
  S.setBan = (id, banned) => db.run('UPDATE players SET banned=? WHERE id=?', banned ? 1 : 0, id);
  S.resetName = (id) => db.run('UPDATE players SET name=? WHERE id=?', 'قطرة' + (1000 + Math.floor(Math.random() * 9000)), id);
  S.createAnnouncement = ({ text_ar, text_en, starts, ends }) => {
    if (!text_ar || String(text_ar).length > 200) throw new HttpError(400, 'text_required');
    const id = newId('a_');
    db.run('INSERT INTO announcements(id, text_ar, text_en, active, starts, ends, created) VALUES (?,?,?,?,?,?,?)', id, String(text_ar), String(text_en || '').slice(0, 200), 1, starts || null, ends || null, now());
    return id;
  };
  S.listAnnouncements = () => db.all('SELECT * FROM announcements ORDER BY created DESC LIMIT 50');
  S.setAnnouncement = (id, active) => db.run('UPDATE announcements SET active=? WHERE id=?', active ? 1 : 0, id);
  S.deleteAnnouncement = (id) => db.run('DELETE FROM announcements WHERE id=?', id);
  S.listSeasons = () => db.all('SELECT * FROM seasons ORDER BY starts DESC');

  return S;
}
