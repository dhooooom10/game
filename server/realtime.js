/* =========================================================================
   الزمن الحقيقي (WebSocket): البحث عن خصم، الغرف بالرمز، تقدّم المباراة المباشر،
   التفاعلات (رموز تعبيرية محددة مسبقًا فقط — بلا دردشة مفتوحة حفاظًا على الأطفال).
   ========================================================================= */
import { WebSocketServer } from 'ws';
import { randomBytes, randomInt } from 'node:crypto';
import { stormConfig, TICK_MS } from '../public/src/core/rain.js';
import { newId, DUEL, EMOTES, HttpError } from './services.js';

const COLORS = ['#FF7BB0', '#FFC94A', '#3DDC97', '#9B8CFF', '#FF9F5A', '#7CF0D0', '#5FD3F5', '#E06FA8'];

export function createRealtime(httpServer, svc, db, { now = () => Date.now(), queueWaitMs = 12000, startDelayMs = 4000, graceMs = 15000, forceSeconds = null } = {}) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 512 * 1024 });
  const clients = new Map();       // playerId -> Set<ws>
  const queue = [];                // [{ws, pid, at, rating}]
  const rooms = new Map();         // code -> room
  const matches = new Map();       // id -> match

  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const sendTo = (pid, msg) => { for (const ws of clients.get(pid) || []) send(ws, msg); };
  const online = () => new Set(clients.keys());

  /* ---------------- المباريات ---------------- */
  function createMatch(kind, players, { cfg = stormConfig(DUEL.diff, DUEL.seconds, true), seed = 'M:' + randomBytes(6).toString('hex'), room = null, ghosts = [] } = {}) {
    if (forceSeconds && kind !== 'ghost') cfg = { ...cfg, timeLimit: forceSeconds }; // للاختبارات فقط
    const id = newId('m_');
    const startAt = now() + startDelayMs;
    db.run('INSERT INTO matches(id, kind, seed, cfg, created, start_at) VALUES (?,?,?,?,?,?)', id, kind, seed, JSON.stringify(cfg), now(), startAt);
    const m = { id, kind, seed, cfg, startAt, room, ghosts, players: new Map(), ended: false, timer: null };
    players.forEach((p, i) => {
      const runId = svc.startRun(p.id, { kind: kind === 'ghost' ? 'duel' : kind, ref: id, seed, cfg, started: startAt });
      m.players.set(p.id, { id: p.id, name: p.name, color: COLORS[i % COLORS.length], team: p.team ?? null, runId, score: 0, done: false, result: null });
    });
    matches.set(id, m);
    for (const p of m.players.values()) {
      sendTo(p.id, { t: 'match', id, kind, seed, cfg, startAt, runId: p.runId, serverTime: now(), me: p.id,
        players: [...m.players.values()].map((x) => ({ id: x.id, name: x.name, color: x.color, team: x.team })),
        ghosts: ghosts.map((g) => ({ id: g.id, name: g.name, color: '#FFC94A', timeline: g.timeline })) });
    }
    const durMs = (cfg.timeLimit || 900) * 1000;
    m.timer = setTimeout(() => finishMatch(m), startAt - now() + durMs + graceMs);
    return m;
  }

  function finishMatch(m) {
    if (m.ended) return;
    m.ended = true; clearTimeout(m.timer);
    const real = [...m.players.values()];
    const standings = real.map((p) => ({ id: p.id, name: p.name, color: p.color, team: p.team, score: p.result?.valid ? p.result.score : 0, popped: p.result?.popped ?? 0, valid: !!p.result?.valid, dnf: !p.result }))
      .concat(m.ghosts.map((g) => ({ id: g.id, name: g.name, ghost: true, score: g.score, popped: null, valid: true })))
      .sort((a, b) => b.score - a.score);
    standings.forEach((s, i) => { s.rank = i + 1; });
    let ratings = {};
    if ((m.kind === 'duel') && real.length >= 2) ratings = svc.applyElo(standings.filter((s) => !s.ghost));
    let teams = null;
    if (m.room?.settings.mode === 'teams') {
      teams = [0, 1].map((tm) => ({ team: tm, score: standings.filter((s) => s.team === tm).reduce((a, s) => a + s.score, 0) }));
    }
    const result = { standings, ratings, teams };
    db.run('UPDATE matches SET ended=?, result=? WHERE id=?', now(), JSON.stringify(result), m.id);
    for (const p of real) sendTo(p.id, { t: 'result', id: m.id, ...result, rating: ratings[p.id] || null });
    if (m.room) { m.room.match = null; broadcastRoom(m.room); }
    setTimeout(() => matches.delete(m.id), 60000);
  }

  /* ---------------- قائمة الانتظار ---------------- */
  function tryMatch() {
    queue.sort((a, b) => a.at - b.at);
    while (queue.length >= 2) {
      const a = queue.shift();
      // أقرب تصنيف لمن ينتظر أطول
      let bi = 0, best = Infinity;
      queue.forEach((q, i) => { const d = Math.abs(q.rating - a.rating); if (d < best) { best = d; bi = i; } });
      const b = queue.splice(bi, 1)[0];
      createMatch('duel', [a.player, b.player]);
    }
  }
  setInterval(() => {
    // من انتظر طويلًا بلا خصم: مباراة ضد «شبح» — جولة مسجّلة حقيقية للاعب آخر (موضّحة كذلك)
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (Date.now() - q.at < queueWaitMs) continue;
      queue.splice(i, 1);
      const g = svc.pickGhost(q.player.id);
      if (!g) { sendTo(q.player.id, { t: 'queue.empty' }); continue; }
      createMatch('ghost', [q.player], { seed: g.seed, cfg: JSON.parse(g.cfg), ghosts: [{ id: 'ghost:' + g.pid, name: g.name, score: g.score, timeline: JSON.parse(g.timeline) }] });
    }
  }, 1000).unref();

  /* ---------------- الغرف ---------------- */
  const roomPublic = (r) => ({ code: r.code, host: r.host, settings: r.settings, inMatch: !!r.match,
    members: [...r.members.values()].map((m) => ({ id: m.id, name: m.name, team: m.team, color: m.color })) });
  const broadcastRoom = (r) => { for (const m of r.members.values()) sendTo(m.id, { t: 'room', room: roomPublic(r) }); };
  function leaveRoom(pid) {
    for (const r of rooms.values()) {
      if (!r.members.has(pid)) continue;
      r.members.delete(pid);
      if (!r.members.size) { rooms.delete(r.code); continue; }
      if (r.host === pid) r.host = r.members.keys().next().value;
      broadcastRoom(r);
    }
  }
  const sanitizeSettings = (s = {}) => ({
    diff: ['easy', 'medium', 'hard', 'expert'].includes(s.diff) ? s.diff : 'medium',
    seconds: [30, 60, 90, 120].includes(+s.seconds) ? +s.seconds : 60,
    mode: s.mode === 'teams' ? 'teams' : 'race',
    specials: s.specials !== false,
  });

  /* ---------------- الرسائل ---------------- */
  const handlers = {
    queue(ws) {
      if (queue.some((q) => q.player.id === ws.player.id)) return;
      leaveRoom(ws.player.id);
      queue.push({ player: ws.player, at: Date.now(), rating: svc.rating(ws.player.id).rating });
      send(ws, { t: 'queue.joined', waitMs: queueWaitMs });
      tryMatch();
    },
    'queue.leave'(ws) { const i = queue.findIndex((q) => q.player.id === ws.player.id); if (i >= 0) queue.splice(i, 1); send(ws, { t: 'queue.left' }); },
    'room.create'(ws, msg) {
      leaveRoom(ws.player.id);
      let code; do { code = String(randomInt(100000, 1000000)); } while (rooms.has(code));
      const r = { code, host: ws.player.id, settings: sanitizeSettings(msg.settings), members: new Map(), match: null, created: now() };
      r.members.set(ws.player.id, { id: ws.player.id, name: ws.player.name, team: 0, color: COLORS[0] });
      rooms.set(code, r);
      broadcastRoom(r);
    },
    'room.join'(ws, msg) {
      const r = rooms.get(String(msg.code || ''));
      if (!r) return send(ws, { t: 'error', code: 'room_not_found' });
      if (r.members.size >= 8 && !r.members.has(ws.player.id)) return send(ws, { t: 'error', code: 'room_full' });
      if (r.match) return send(ws, { t: 'error', code: 'room_busy' });
      leaveRoom(ws.player.id);
      const n = r.members.size;
      r.members.set(ws.player.id, { id: ws.player.id, name: ws.player.name, team: n % 2, color: COLORS[n % COLORS.length] });
      broadcastRoom(r);
    },
    'room.leave'(ws) { leaveRoom(ws.player.id); send(ws, { t: 'room', room: null }); },
    'room.settings'(ws, msg) {
      const r = [...rooms.values()].find((x) => x.members.has(ws.player.id));
      if (!r || r.host !== ws.player.id || r.match) return;
      r.settings = sanitizeSettings(msg.settings);
      broadcastRoom(r);
    },
    'room.team'(ws, msg) {
      const r = [...rooms.values()].find((x) => x.members.has(ws.player.id));
      if (!r || r.host !== ws.player.id || r.match) return;
      const m = r.members.get(msg.id); if (m) { m.team = m.team ? 0 : 1; broadcastRoom(r); }
    },
    'room.start'(ws) {
      const r = [...rooms.values()].find((x) => x.members.has(ws.player.id));
      if (!r || r.host !== ws.player.id || r.match) return;
      if (r.members.size < 2) return send(ws, { t: 'error', code: 'need_players' });
      const cfg = stormConfig(r.settings.diff, r.settings.seconds, r.settings.specials);
      r.match = createMatch('room', [...r.members.values()], { cfg, room: r });
      broadcastRoom(r);
    },
    progress(ws, msg) {
      const m = matches.get(msg.id); if (!m || m.ended) return;
      const p = m.players.get(ws.player.id); if (!p) return;
      p.score = Math.max(0, Math.min(1e7, msg.score | 0));
      for (const o of m.players.values()) if (o.id !== p.id) sendTo(o.id, { t: 'progress', id: m.id, pid: p.id, name: p.name, color: p.color, score: p.score, lives: msg.lives ?? null });
    },
    finish(ws, msg) {
      const m = matches.get(msg.id); if (!m) return send(ws, { t: 'error', code: 'match_not_found' });
      const p = m.players.get(ws.player.id); if (!p || p.done) return;
      try {
        p.result = svc.submitRun(p.id, p.runId, { log: msg.log, endTick: msg.endTick }, { realtime: true });
      } catch (e) { p.result = { valid: false, score: 0 }; }
      p.done = true; p.score = p.result.valid ? p.result.score : 0;
      for (const o of m.players.values()) sendTo(o.id, { t: 'progress', id: m.id, pid: p.id, name: p.name, color: p.color, score: p.score, done: true });
      send(ws, { t: 'finished', id: m.id, score: p.score, valid: p.result.valid, runId: p.runId });
      if ([...m.players.values()].every((x) => x.done)) finishMatch(m);
    },
    emote(ws, msg) {
      if (!EMOTES.includes(msg.e)) return;
      const now_ = now();
      if (ws._lastEmote && now_ - ws._lastEmote < 1500) return;
      ws._lastEmote = now_;
      const targets = new Set();
      const r = [...rooms.values()].find((x) => x.members.has(ws.player.id));
      if (r) r.members.forEach((m) => targets.add(m.id));
      for (const m of matches.values()) if (m.players.has(ws.player.id) && !m.ended) m.players.forEach((p) => targets.add(p.id));
      for (const id of targets) sendTo(id, { t: 'emote', pid: ws.player.id, name: ws.player.name, e: msg.e });
    },
    ping(ws) { send(ws, { t: 'pong', serverTime: now() }); },
  };

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws._bucket = { n: 0, at: now() };
    ws.on('message', (raw) => {
      // حدّ للرسائل: 40 رسالة في الثانية
      const b = ws._bucket; if (now() - b.at > 1000) { b.n = 0; b.at = now(); } if (++b.n > 40) return;
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      if (!ws.player) {
        if (msg.t !== 'hello') return send(ws, { t: 'error', code: 'auth_required' });
        try {
          const p = svc.auth(msg.token);
          if (!p) return send(ws, { t: 'error', code: 'bad_token' });
          ws.player = { id: p.id, name: p.name };
          if (!clients.has(p.id)) clients.set(p.id, new Set());
          clients.get(p.id).add(ws);
          send(ws, { t: 'welcome', player: svc.publicPlayer(p), serverTime: now(), rating: svc.rating(p.id) });
          // إن كان في غرفة يعيد إرسال حالتها
          const r = [...rooms.values()].find((x) => x.members.has(p.id));
          if (r) send(ws, { t: 'room', room: roomPublic(r) });
        } catch (e) { send(ws, { t: 'error', code: e instanceof HttpError ? e.code : 'error' }); }
        return;
      }
      const h = handlers[msg.t];
      if (h) { try { h(ws, msg); } catch (e) { console.error('ws handler', msg.t, e); } }
    });
    ws.on('close', () => {
      if (!ws.player) return;
      const set = clients.get(ws.player.id);
      if (set) { set.delete(ws); if (!set.size) clients.delete(ws.player.id); }
      if (!clients.has(ws.player.id)) {
        const i = queue.findIndex((q) => q.player.id === ws.player.id); if (i >= 0) queue.splice(i, 1);
        // نمهل اللاعب 20 ثانية للعودة قبل إخراجه من الغرفة
        const pid = ws.player.id;
        setTimeout(() => { if (!clients.has(pid)) leaveRoom(pid); }, 20000).unref();
      }
    });
  });
  const hb = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 30000);
  hb.unref();

  return {
    online, clientsCount: () => clients.size,
    close: () => { clearInterval(hb); for (const m of matches.values()) clearTimeout(m.timer); for (const ws of wss.clients) ws.terminate(); wss.close(); },
    _state: { queue, rooms, matches },
    TICK_MS,
  };
}
