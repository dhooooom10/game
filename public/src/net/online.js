/* =========================================================================
   طبقة الاتصال بالخادم: REST + WebSocket مع إعادة اتصال تلقائية.
   اللعب الفردي يعمل دائمًا بلا إنترنت؛ الأونلاين يتطلب اتصالًا.
   هوية الأونلاين محفوظة داخل الملف الشخصي (data.online) فلكل لاعب على الجهاز هويته.
   ========================================================================= */

const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="mc-server"]') : null;
export const SERVER = (meta && meta.content) || (typeof location !== 'undefined' ? location.origin : '');

let ws = null, wsReady = false, wsWanted = false, backoff = 500, offset = 0;
const listeners = new Set();
let identity = null;           // { id, token, name, code }
let lastConfig = null;

export const serverNow = () => Date.now() + offset;
export const config = () => lastConfig;
export const me = () => identity;
export const isConnected = () => wsReady;

export class NetError extends Error { constructor(code, status = 0) { super(code); this.code = code; this.status = status; } }

export async function api(method, path, body, { auth = true, timeout = 10000 } = {}) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(SERVER + path, {
      method, signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(auth && identity?.token ? { Authorization: 'Bearer ' + identity.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let j = {};
    try { j = await r.json(); } catch { /* ignore */ }
    if (!r.ok) throw new NetError(j.error || 'http_' + r.status, r.status);
    return j;
  } catch (e) {
    if (e instanceof NetError) throw e;
    throw new NetError('offline');
  } finally { clearTimeout(tm); }
}

/** يضمن وجود هوية أونلاين للملف الحالي (يسجّل عند أول دخول) */
export async function ensureIdentity(app) {
  const d = app.data;
  if (d.online?.token) { identity = d.online; return identity; }
  // داخل تطبيق Android: حساب Play Games يسترجع التقدّم الأونلاين على أي جهاز
  try {
    const pg = await import('./playgames.js');
    if (pg.available() && (await pg.signIn({ interactive: true })) && (await pg.linkAccount(app))) { identity = d.online; return identity; }
  } catch { /* نكمل بالتسجيل العادي */ }
  const name = (app.playerName || '').trim();
  const r = await api('POST', '/api/register', { name }, { auth: false });
  d.online = { id: r.id, token: r.token, name: r.name, code: r.code };
  app.save();
  identity = d.online;
  return identity;
}
export function useIdentity(d) { identity = d?.online?.token ? d.online : null; if (!identity) disconnect(); }

export async function loadConfig() {
  const c = await api('GET', '/api/config', null, { timeout: 6000 });
  offset = c.serverTime - Date.now();
  lastConfig = c;
  return c;
}

/* ---------------- WebSocket ---------------- */
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (m) => { for (const fn of [...listeners]) { try { fn(m); } catch (e) { console.error(e); } } };

export function connect() {
  wsWanted = true;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  if (!identity?.token) return;
  const url = SERVER.replace(/^http/, 'ws') + '/ws';
  try { ws = new WebSocket(url); } catch { return scheduleReconnect(); }
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', token: identity.token })); };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.serverTime) offset = m.serverTime - Date.now();
    if (m.t === 'welcome') { wsReady = true; backoff = 500; }
    emit(m);
  };
  ws.onclose = () => { const was = wsReady; wsReady = false; ws = null; if (was) emit({ t: 'disconnected' }); if (wsWanted) scheduleReconnect(); };
  ws.onerror = () => { /* onclose يتولى الأمر */ };
}
function scheduleReconnect() { setTimeout(() => { if (wsWanted) connect(); }, backoff); backoff = Math.min(8000, backoff * 2); }
export function disconnect() { wsWanted = false; if (ws) { try { ws.close(); } catch { /* ignore */ } } ws = null; wsReady = false; }
export function send(m) { if (ws && wsReady) { ws.send(JSON.stringify(m)); return true; } return false; }
export function waitFor(pred, ms = 15000) {
  return new Promise((ok, fail) => {
    const off = on((m) => { if (pred(m)) { off(); clearTimeout(tm); ok(m); } });
    const tm = setTimeout(() => { off(); fail(new NetError('timeout')); }, ms);
  });
}
export async function ready(ms = 6000) {
  connect();
  if (wsReady) return true;
  await waitFor((m) => m.t === 'welcome', ms);
  return true;
}

/** يرسل نتيجة جولة REST مع إعادة المحاولة */
export async function submitRun(runId, payload) {
  let err;
  for (let i = 0; i < 3; i++) {
    try { return await api('POST', `/api/runs/${runId}/submit`, payload, { timeout: 15000 }); }
    catch (e) { err = e; if (e.code !== 'offline') break; await new Promise((r) => setTimeout(r, 1000 * (i + 1))); }
  }
  throw err;
}
