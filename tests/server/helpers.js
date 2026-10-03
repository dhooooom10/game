import WebSocket from 'ws';
import { createRain } from '../../public/src/core/rain.js';
import { startServer } from '../../server/index.js';

export const ADMIN = 'test-admin-token-123456';
export async function boot(opts = {}) {
  const clock = { t: Date.parse('2026-10-03T12:00:00Z') };
  const s = await startServer({ adminToken: ADMIN, now: () => clock.t, registerLimit: 10000, realtimeOpts: { startDelayMs: 30, queueWaitMs: 400, graceMs: 300, ...opts.realtimeOpts }, ...opts });
  const api = async (method, path, body, token) => {
    const r = await fetch(s.url + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    return { status: r.status, ...j };
  };
  return { ...s, clock, api };
}

/** يلعب جولة كاملة بمحرك المطر (لاعب آلي بزمن تفكير بشري) ويعيد السجل */
export function playBot(cfg, seed, { think = 45, accuracy = 1 } = {}) {
  const R = createRain(cfg, seed);
  let target = null, waitUntil = 0, n = 0;
  while (!R.state.over && R.state.tick < 60 * 60 * 20) {
    const live = R.state.drops.filter((d) => !d.dead);
    if (!target || target.dead) { target = live.sort((a, b) => b.y - a.y)[0] || null; waitUntil = R.state.tick + think; }
    if (target && R.state.tick >= waitUntil) {
      const ans = (n++ % 10) < accuracy * 10 ? target.q.answer : target.q.answer + 1;
      for (const ch of String(ans)) R.input(ch);
      R.input('ok'); target = null;
    }
    R.step();
  }
  return { log: R.state.log, endTick: R.state.tick, summary: R.summary() };
}

export function wsClient(url, token) {
  const ws = new WebSocket(url.replace('http', 'ws') + '/ws');
  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    const i = waiters.findIndex((w) => w.pred(m));
    if (i >= 0) { const [w] = waiters.splice(i, 1); w.ok(m); } else inbox.push(m);
  });
  const c = {
    ws,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 4000) => {
      const pf = typeof pred === 'string' ? (m) => m.t === pred : pred;
      const i = inbox.findIndex(pf);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((ok, fail) => { const w = { pred: pf, ok }; waiters.push(w); setTimeout(() => fail(new Error('timeout waiting ' + pred)), ms); });
    },
    close: () => ws.close(),
  };
  return new Promise((ok) => ws.on('open', async () => { c.send({ t: 'hello', token }); await c.wait('welcome'); ok(c); }));
}
