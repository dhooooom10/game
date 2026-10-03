/* =========================================================================
   خادم Math Clash — يخدم ملفات اللعبة + واجهة برمجية REST + WebSocket.
   التشغيل:  ADMIN_TOKEN=سر-طويل  DB_PATH=./data/mc.db  PORT=8080  node server/index.js
   ========================================================================= */
import { createServer as createHttp } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { openDb } from './db.js';
import { createServices, HttpError, OCCASIONS } from './services.js';
import { createRealtime } from './realtime.js';
import { createPlayGames } from './playgames.js';
import { dailyRain } from '../public/src/core/modes.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const SECURITY = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'",
};

export function startServer({ port = 0, dbPath = ':memory:', adminToken = '', now = () => Date.now(), realtimeOpts = {}, corsOrigins = [], registerLimit = 40, playGames = {} } = {}) {
  const db = openDb(dbPath);
  const pgs = createPlayGames(playGames);
  const svc = createServices(db, { now });
  svc.currentSeason();

  /* ---------- حدّ الطلبات لكل عنوان ---------- */
  const buckets = new Map();
  const limit = (ip, key, max, perMs) => {
    const k = ip + '|' + key, t = Date.now();
    let b = buckets.get(k);
    if (!b || t - b.at > perMs) { b = { n: 0, at: t }; buckets.set(k, b); }
    if (++b.n > max) throw new HttpError(429, 'rate_limited');
  };
  setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (t - b.at > 600000) buckets.delete(k); }, 600000).unref();

  const json = (res, status, body, extra = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) => new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 700 * 1024) { fail(new HttpError(413, 'too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return ok({}); try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { fail(new HttpError(400, 'bad_json')); } });
    req.on('error', fail);
  });
  const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const player = (req) => { const p = svc.auth(bearer(req)); if (!p) throw new HttpError(401, 'unauthorized'); return p; };
  const isAdmin = (req) => {
    if (!adminToken || adminToken.length < 12) return false;
    const a = Buffer.from(bearer(req)), b = Buffer.from(adminToken);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const admin = (req) => { if (!isAdmin(req)) throw new HttpError(401, 'admin_only'); };

  /* ---------- المسارات ---------- */
  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

  route('GET', '/api/health', () => ({ ok: true, time: now() }));
  route('POST', '/api/register', async (req, _p, body, ip) => { limit(ip, 'register', registerLimit, 3600000); /* المدارس قد تشترك في عنوان واحد */ return svc.register(body.name, body.country); });
  /* تسجيل الدخول/الربط عبر Google Play Games (تطبيق Android فقط) */
  route('POST', '/api/auth/playgames', async (req, _p, body, ip) => {
    limit(ip, 'pgs', 30, 600000);
    let cur = null;
    try { cur = svc.auth(bearer(req)); } catch (e) { if (e.code === 'banned') throw e; }
    const v = await pgs.verify(body.authCode);
    return svc.linkPlayGames(v.playerId, v.displayName, cur?.id || null);
  });
  route('GET', '/api/me', (req) => { const p = player(req); return { player: svc.publicPlayer(p), rating: svc.rating(p.id), rewards: svc.rewards(p.id) }; });
  route('DELETE', '/api/me', (req) => { const p = player(req); svc.deleteAccount(p.id); return { ok: true }; });
  route('POST', '/api/me/name', async (req, _p, body) => { const p = player(req); return { name: svc.rename(p, body.name) }; });
  route('POST', '/api/me/country', async (req, _p, body) => { const p = player(req); return { country: svc.setCountry(p, body.country) }; });
  route('GET', '/api/clubs', (req) => { const p = player(req); return { clubs: svc.myClubs(p.id) }; });
  route('POST', '/api/clubs', async (req, _p, body, ip) => { const p = player(req); limit(ip, 'club', 20, 3600000); return svc.createClub(p.id, body.name); });
  route('POST', '/api/clubs/join', async (req, _p, body, ip) => { const p = player(req); limit(ip, 'cjoin', 30, 600000); return svc.joinClub(p.id, body.code); });
  route('GET', '/api/clubs/league', (req) => { let pid = null; try { pid = svc.auth(bearer(req))?.id; } catch { /* ignore */ } return { league: svc.clubLeague(pid) }; });
  route('GET', '/api/clubs/:id', (req, p) => { const pl = player(req); return { club: svc.getClub(pl.id, p.id) }; });
  route('DELETE', '/api/clubs/:id', (req, p) => { const pl = player(req); svc.deleteClub(pl.id, p.id); return { ok: true }; });
  route('DELETE', '/api/clubs/:id/members/:pid', (req, p) => { const pl = player(req); svc.leaveClub(pl.id, p.id, p.pid === 'me' ? null : p.pid); return { ok: true }; });
  route('GET', '/api/nations', (req) => { let pid = null; try { pid = svc.auth(bearer(req))?.id; } catch { /* ignore */ } return svc.nations(pid); });
  route('POST', '/api/me/skin', async (req, _p, body) => { const p = player(req); svc.setSkin(p, String(body.skin || '')); return { ok: true }; });
  route('GET', '/api/config', (req) => { let pid = null; try { pid = svc.auth(bearer(req))?.id; } catch { /* ignore */ } return { ...svc.config(pid), playGames: pgs.enabled }; });
  route('GET', '/api/leaderboard/:board', (req, p, _b, _ip, url) => {
    let pid = null; try { pid = svc.auth(bearer(req))?.id; } catch { /* ignore */ }
    if (p.board === 'friends' && !pid) throw new HttpError(401, 'unauthorized');
    return svc.leaderboard(p.board, { pid, ref: url.searchParams.get('ref') });
  });
  route('GET', '/api/tournaments', (req) => { let pid = null; try { pid = svc.auth(bearer(req))?.id; } catch { /* ignore */ } return { tournaments: svc.listTournaments(pid) }; });
  route('GET', '/api/tournaments/:id', (req, p) => { let pid = null; try { pid = svc.auth(bearer(req))?.id; } catch { /* ignore */ } return { tournament: svc.getTournament(p.id, pid), leaderboard: svc.leaderboard('tournament', { pid, ref: p.id }) }; });
  route('POST', '/api/tournaments/:id/run', (req, p, _b, ip) => { const pl = player(req); limit(ip, 'run', 60, 600000); return svc.startTournamentRun(pl.id, p.id); });
  route('POST', '/api/weekly/run', (req, _p, _b, ip) => { const pl = player(req); limit(ip, 'run', 60, 600000); return svc.startWeeklyRun(pl.id); });
  route('POST', '/api/runs/:id/submit', async (req, p, body, ip) => {
    const pl = player(req); limit(ip, 'submit', 60, 600000);
    const r = svc.submitRun(pl.id, p.id, body, { realtime: true });
    const run = svc_runInfo(p.id);
    return { score: r.score, popped: r.popped, valid: r.valid, accuracy: r.accuracy, board: run ? svc.leaderboard(run.kind === 'tournament' ? 'tournament' : 'weekly', { pid: pl.id, ref: run.ref }).mine : null };
  });
  route('POST', '/api/daily/submit', async (req, _p, body, ip) => {
    const pl = player(req); limit(ip, 'submit', 60, 600000);
    const r = svc.submitDaily(pl.id, body.date, dailyRain(String(body.date)).cfg, body);
    return { score: r.score, valid: r.valid, board: svc.leaderboard('daily', { pid: pl.id, ref: body.date }).mine };
  });
  route('GET', '/api/friends', (req) => { const p = player(req); return { friends: svc.friends(p.id, rt.online()), code: p.code }; });
  route('POST', '/api/friends', async (req, _p, body, ip) => { const p = player(req); limit(ip, 'friend', 30, 600000); svc.addFriend(p.id, body.code); return { friends: svc.friends(p.id, rt.online()) }; });
  route('DELETE', '/api/friends/:id', (req, p) => { const pl = player(req); svc.removeFriend(pl.id, p.id); return { ok: true }; });
  route('POST', '/api/challenges', async (req, _p, body) => { const p = player(req); return { id: svc.createChallenge(p.id, body.runId) }; });
  route('POST', '/api/challenges/local', async (req, _p, body, ip) => { const p = player(req); limit(ip, 'lchal', 20, 600000); return svc.createLocalChallenge(p.id, body); });
  route('GET', '/api/challenges/:id', (req, p) => ({ challenge: svc.getChallenge(p.id) }));
  route('POST', '/api/challenges/:id/run', (req, p, _b, ip) => { const pl = player(req); limit(ip, 'run', 60, 600000); return svc.startChallengeRun(pl.id, p.id); });

  /* ---------- الإدارة ---------- */
  route('POST', '/api/a', async (req, _p, body, ip) => { limit(ip, 'a', 60, 3600000); return svc.track(body); });
  route('GET', '/api/admin/analytics', (req, _p, _b, _ip, url) => { admin(req); return svc.analytics(Math.min(60, Math.max(7, +url.searchParams.get('days') || 14))); });
  route('GET', '/api/admin/stats', (req) => { admin(req); return svc.adminStats(rt.clientsCount()); });
  route('GET', '/api/admin/occasions', (req) => { admin(req); return { occasions: OCCASIONS }; });
  route('GET', '/api/admin/tournaments', (req) => { admin(req); return { tournaments: svc.listTournaments(null, { all: true }) }; });
  route('POST', '/api/admin/tournaments', async (req, _p, body) => { admin(req); return { tournament: svc.createTournament(body) }; });
  route('PUT', '/api/admin/tournaments/:id', async (req, p, body) => { admin(req); return { tournament: svc.updateTournament(p.id, body) }; });
  route('POST', '/api/admin/tournaments/:id/end', (req, p) => { admin(req); svc.endTournament(p.id); return { tournament: svc.getTournament(p.id) }; });
  route('DELETE', '/api/admin/tournaments/:id', (req, p) => { admin(req); svc.deleteTournament(p.id); return { ok: true }; });
  route('GET', '/api/admin/tournaments/:id/leaderboard', (req, p) => { admin(req); return svc.leaderboard('tournament', { ref: p.id }); });
  route('GET', '/api/admin/seasons', (req) => { admin(req); return { seasons: svc.listSeasons(), current: svc.currentSeason() }; });
  route('POST', '/api/admin/seasons', async (req, _p, body) => { admin(req); return { season: svc.startSeason(body) }; });
  route('GET', '/api/admin/announcements', (req) => { admin(req); return { announcements: svc.listAnnouncements() }; });
  route('POST', '/api/admin/announcements', async (req, _p, body) => { admin(req); return { id: svc.createAnnouncement(body) }; });
  route('PUT', '/api/admin/announcements/:id', async (req, p, body) => { admin(req); svc.setAnnouncement(p.id, !!body.active); return { ok: true }; });
  route('DELETE', '/api/admin/announcements/:id', (req, p) => { admin(req); svc.deleteAnnouncement(p.id); return { ok: true }; });
  route('GET', '/api/admin/players', (req, _p, _b, _ip, url) => { admin(req); return { players: svc.searchPlayers(url.searchParams.get('q')) }; });
  route('POST', '/api/admin/players/:id/ban', async (req, p, body) => { admin(req); svc.setBan(p.id, body.banned !== false); return { ok: true }; });
  route('POST', '/api/admin/players/:id/reset-name', (req, p) => { admin(req); svc.resetName(p.id); return { ok: true }; });

  const svc_runInfo = (id) => db.get('SELECT kind, ref FROM runs WHERE id=?', id);

  /* ---------- الملفات الثابتة ---------- */
  async function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p === '/admin' || p === '/admin/') p = '/admin.html';
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(PUBLIC, p));
    if (!file.startsWith(resolve(PUBLIC))) { res.writeHead(403); return res.end(); }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error('nf');
      const body = await readFile(file);
      const ext = extname(file);
      const cache = ext === '.woff2' || ext === '.png' ? 'public, max-age=31536000, immutable' : 'no-cache';
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SECURITY });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      const nf = await readFile(join(PUBLIC, '404.html')).catch(() => 'Not found');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY }); res.end(nf);
    }
  }

  const server = createHttp(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
    const origin = req.headers.origin;
    const cors = origin && corsOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE' } : {};
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
    try {
      limit(ip, 'api', 600, 60000);
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
        const out = await r.fn(req, m.groups || {}, body, ip, url);
        return json(res, 200, out, cors);
      }
      throw new HttpError(404, 'not_found');
    } catch (e) {
      if (e instanceof HttpError) return json(res, e.status, { error: e.code }, cors);
      console.error(e);
      return json(res, 500, { error: 'server_error' }, cors);
    }
  });
  const rt = createRealtime(server, svc, db, { now, ...realtimeOpts });

  return new Promise((ok) => server.listen(port, () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    ok({ url, port: server.address().port, svc, db, rt, close: () => new Promise((r) => { rt.close(); server.close(() => { db.close(); r(); }); server.closeAllConnections?.(); }) });
  }));
}

/* تشغيل مباشر */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const adminToken = process.env.ADMIN_TOKEN || '';
  if (adminToken.length < 12) console.warn('⚠️  ADMIN_TOKEN غير مضبوط أو قصير (12 حرفًا على الأقل) — لوحة الإدارة معطّلة.');
  const s = await startServer({ port: +process.env.PORT || 8080, dbPath: process.env.DB_PATH || './data/mathclash.db', adminToken,
    corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
    playGames: { clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '' } });
  console.log(`Math Clash server on ${s.url}  (admin: ${s.url}/admin)`);
}
