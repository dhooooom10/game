import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './helpers.js';

/** محاكاة خوادم Google: كل رمز «code-X» يعود باللاعب X */
function fakeGoogle() {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      const p = new URLSearchParams(opts.body);
      if (p.get('client_secret') !== 'sec' || !p.get('code').startsWith('code-')) return res(400, { error: 'invalid_grant' });
      return res(200, { access_token: 'at-' + p.get('code').slice(5) });
    }
    if (String(url).startsWith('https://www.googleapis.com/games/v1/players/me')) {
      const tok = opts.headers.Authorization.replace('Bearer at-', '');
      return res(200, { playerId: 'g' + tok, displayName: 'Player ' + tok });
    }
    return res(404, {});
  };
  return { fetchImpl, calls };
}

test('play games: disabled without credentials', async () => {
  const s = await boot();
  try {
    const r = await s.api('POST', '/api/auth/playgames', { authCode: 'code-aaaaaaaaaa' });
    assert.equal(r.status, 501);
    assert.equal((await s.api('GET', '/api/config')).playGames, false);
  } finally { await s.close(); }
});

test('play games: links device account, restores on a new device, new player otherwise', async () => {
  const g = fakeGoogle();
  const s = await boot({ playGames: { clientId: 'cid', clientSecret: 'sec', fetchImpl: g.fetchImpl } });
  try {
    assert.equal((await s.api('GET', '/api/config')).playGames, true);
    // جهاز ١: لاعب مجهول يلعب ثم يربط حسابه
    const dev1 = await s.api('POST', '/api/register', { name: 'سلمى' });
    const link = await s.api('POST', '/api/auth/playgames', { authCode: 'code-alice01' }, dev1.token);
    assert.equal(link.status, 200);
    assert.equal(link.id, dev1.id);
    assert.equal(link.token, null, 'same device keeps its token');
    assert.equal(link.linked, true);
    // تبادل الرمز تم بالسرّ الصحيح
    const body = new URLSearchParams(g.calls[0].opts.body);
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('client_id'), 'cid');
    // جهاز ٢ جديد: يسترجع الحساب نفسه برمز جديد، والجهاز الأول يبقى مسجّلًا
    const restore = await s.api('POST', '/api/auth/playgames', { authCode: 'code-alice01' });
    assert.equal(restore.id, dev1.id);
    assert.equal(restore.name, 'سلمى');
    assert.ok(restore.token && restore.token !== dev1.token);
    assert.equal((await s.api('GET', '/api/me', null, restore.token)).player.id, dev1.id);
    assert.equal((await s.api('GET', '/api/me', null, dev1.token)).player.id, dev1.id);
    // حساب Play لم يُربط بعد ومن غير جهاز: لاعب جديد باسم Play
    const fresh = await s.api('POST', '/api/auth/playgames', { authCode: 'code-bob0001' });
    assert.equal(fresh.created, true);
    assert.equal(fresh.name, 'Player bob0001');
    assert.notEqual(fresh.id, dev1.id);
    // جهاز لاعبه مربوط بحساب Play آخر: يتحوّل إلى صاحب حساب Play
    const sw = await s.api('POST', '/api/auth/playgames', { authCode: 'code-alice01' }, fresh.token);
    assert.equal(sw.id, dev1.id);
    assert.ok(sw.token);
    // رموز مرفوضة
    assert.equal((await s.api('POST', '/api/auth/playgames', { authCode: 'bad-code-xyz' })).status, 401);
    assert.equal((await s.api('POST', '/api/auth/playgames', { authCode: 'x' })).status, 400);
    // حذف الحساب يلغي كل الرموز
    await s.api('DELETE', '/api/me', null, restore.token);
    assert.equal((await s.api('GET', '/api/me', null, dev1.token)).status, 401);
    assert.equal((await s.api('GET', '/api/me', null, restore.token)).status, 401);
  } finally { await s.close(); }
});

test('local challenge: server replays the run, rejects tampered config, friend plays same drops', async () => {
  const { replayRain, stormConfig } = await import('../../public/src/core/rain.js');
  const { playBot } = await import('./helpers.js');
  const s = await boot();
  try {
    const a = await s.api('POST', '/api/register', { name: 'منى' });
    const cfg = stormConfig('easy', 30);
    const seed = 424242;
    const bot = playBot(cfg, seed, { think: 50 });
    const r = await s.api('POST', '/api/challenges/local', { cfg, seed, log: bot.log, endTick: bot.endTick }, a.token);
    assert.equal(r.status, 200);
    assert.equal(r.score, bot.summary.score);
    assert.ok(bot.summary.score > 0);
    // صديق يلعب: نفس الإعدادات والبذرة (رقمية) تعود كما هي
    const b = await s.api('POST', '/api/register', { name: 'سعد' });
    const run = await s.api('POST', `/api/challenges/${r.id}/run`, null, b.token);
    assert.equal(run.seed, seed);
    assert.equal(run.target, bot.summary.score);
    assert.equal(replayRain(run.cfg, run.seed, bot.log, { endTick: bot.endTick }).summary.score, bot.summary.score, 'friend gets identical drops');
    // إعدادات مستحيلة أو جولة بلا نهاية تُرفض
    assert.equal((await s.api('POST', '/api/challenges/local', { cfg: { ...cfg, timeLimit: null, lives: null }, seed, log: bot.log, endTick: bot.endTick }, a.token)).status, 400);
    assert.equal((await s.api('POST', '/api/challenges/local', { cfg: { ...cfg, travel: 9999 }, seed, log: bot.log, endTick: bot.endTick }, a.token)).status, 400);
    assert.equal((await s.api('POST', '/api/challenges/local', { cfg, seed, log: [], endTick: 100 }, a.token)).status, 422);
    assert.equal((await s.api('POST', '/api/challenges/local', { cfg, seed, log: bot.log, endTick: bot.endTick })).status, 401);
  } finally { await s.close(); }
});

test('nations league: country validation, weekly points from daily bests, top players, change lock', async () => {
  const s = await boot();
  try {
    const a = await s.api('POST', '/api/register', { name: 'A', country: 'SA' });
    const b = await s.api('POST', '/api/register', { name: 'B', country: 'eg' });
    const c = await s.api('POST', '/api/register', { name: 'C', country: 'QQ' });
    assert.equal((await s.api('GET', '/api/me', null, a.token)).player.country, 'SA');
    assert.equal((await s.api('GET', '/api/me', null, b.token)).player.country, 'EG');
    assert.equal((await s.api('GET', '/api/me', null, c.token)).player.country, null, 'invalid code ignored');
    assert.equal((await s.api('POST', '/api/me/country', { country: 'ZZ' }, c.token)).status, 400);
    assert.equal((await s.api('POST', '/api/me/country', { country: 'MA' }, c.token)).country, 'MA');
    assert.equal((await s.api('POST', '/api/me/country', { country: 'TN' }, c.token)).status, 429, 'locked for a week');
    // نتائج صالحة مباشرة في القاعدة: يومان لـ A، يوم لـ B
    const t0 = s.clock.t; // السبت 2026-10-03 ظهرًا
    const { isoWeek } = await import('../../server/services.js');
    const ins2 = (pid, score, t) => s.db.run("INSERT INTO runs(id, player_id, kind, seed, cfg, started, submitted, score, valid, week) VALUES (?,?,?,?,?,?,?,?,1,?)", 'r' + Math.random(), pid, 'weekly', 's', '{}', t, t, score, isoWeek(t));
    ins2(a.id, 100, t0); ins2(a.id, 300, t0 + 1000); ins2(a.id, 50, t0 - 3600e3 * 13); // يوم سابق في الأسبوع نفسه
    ins2(b.id, 250, t0);
    const n = await s.api('GET', '/api/nations', null, a.token);
    const sa = n.list.find((x) => x.country === 'SA');
    assert.equal(sa.points, 350, 'best of each day summed (300 + 50)');
    assert.equal(n.list[0].country, 'SA');
    assert.equal(n.mine.country, 'SA');
    assert.equal(n.mine.rank, 1);
    assert.equal(n.mine.myRank, 1);
    assert.equal(n.list.find((x) => x.country === 'EG').points, 250);
  } finally { await s.close(); }
});
