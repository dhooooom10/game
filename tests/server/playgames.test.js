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

test('clubs: create, join by code, owner dashboard, members see no private stats, league, leave/remove, delete', async () => {
  const s = await boot();
  try {
    const { isoWeek } = await import('../../server/services.js');
    const ins = (pid, score) => s.db.run("INSERT INTO runs(id, player_id, kind, seed, cfg, started, submitted, score, accuracy, valid, week) VALUES (?,?,?,?,?,?,?,?,0.9,1,?)", 'r' + Math.random(), pid, 'weekly', 's', '{}', s.clock.t, s.clock.t, score, isoWeek(s.clock.t));
    const t = await s.api('POST', '/api/register', { name: 'الأستاذ' });
    const st = [];
    for (let i = 0; i < 3; i++) st.push(await s.api('POST', '/api/register', { name: 'طالب ' + i }));
    const c = await s.api('POST', '/api/clubs', { name: 'فصل ٣ب' }, t.token);
    assert.match(c.code, /^[0-9A-F]{6}$/);
    for (const x of st) assert.equal((await s.api('POST', '/api/clubs/join', { code: c.code.toLowerCase() }, x.token)).id, c.id);
    assert.equal((await s.api('POST', '/api/clubs/join', { code: 'ZZZZZZ' }, st[0].token)).status, 404);
    ins(st[0].id, 500); ins(st[1].id, 200);
    const asOwner = (await s.api('GET', `/api/clubs/${c.id}`, null, t.token)).club;
    assert.equal(asOwner.owner, true);
    assert.equal(asOwner.members.length, 4);
    assert.equal(asOwner.members[0].name, 'طالب 0');
    assert.equal(asOwner.members[0].runs, 1);
    assert.equal(asOwner.members[0].accuracy, 90);
    assert.equal(asOwner.points, 700);
    const asMember = (await s.api('GET', `/api/clubs/${c.id}`, null, st[1].token)).club;
    assert.equal(asMember.owner, false);
    assert.equal(asMember.members[0].runs, undefined, 'private stats only for the owner');
    const outsider = await s.api('POST', '/api/register', { name: 'غريب' });
    assert.equal((await s.api('GET', `/api/clubs/${c.id}`, null, outsider.token)).status, 403);
    const lg = (await s.api('GET', '/api/clubs/league', null, st[0].token)).league;
    assert.equal(lg[0].id, c.id); assert.equal(lg[0].mine, true);
    assert.equal((await s.api('GET', '/api/clubs', null, st[2].token)).clubs.length, 1);
    // عضو يغادر، المالك يحذف عضوًا، غير المالك لا يحذف غيره
    assert.equal((await s.api('DELETE', `/api/clubs/${c.id}/members/${st[0].id}`, null, st[1].token)).status, 403);
    await s.api('DELETE', `/api/clubs/${c.id}/members/me`, null, st[2].token);
    await s.api('DELETE', `/api/clubs/${c.id}/members/${st[1].id}`, null, t.token);
    assert.equal((await s.api('GET', `/api/clubs/${c.id}`, null, t.token)).club.members.length, 2);
    assert.equal((await s.api('DELETE', `/api/clubs/${c.id}`, null, st[0].token)).status, 403);
    await s.api('DELETE', `/api/clubs/${c.id}`, null, t.token);
    assert.equal((await s.api('GET', '/api/clubs', null, st[0].token)).clubs.length, 0);
  } finally { await s.close(); }
});

test('analytics: anonymous daily activity, retention, sources, events whitelist, admin only', async () => {
  const s = await boot();
  try {
    const iid = (n) => 'install-' + String(n).padStart(4, '0');
    for (let i = 0; i < 4; i++) await s.api('POST', '/api/a', { iid: iid(i), ref: i < 2 ? 'tiktok' : null, platform: 'app', lang: 'ar', events: { round: 3, hack: 5, share_daily: 1 } });
    assert.equal((await s.api('POST', '/api/a', { iid: 'x' })).status, 400);
    s.clock.t += 864e5; // اليوم التالي: يعود اثنان
    await s.api('POST', '/api/a', { iid: iid(0) }); await s.api('POST', '/api/a', { iid: iid(2) });
    assert.equal((await s.api('GET', '/api/admin/analytics')).status, 401);
    const r = await fetch(s.url + '/api/admin/analytics', { headers: { Authorization: 'Bearer test-admin-token-123456' } }).then((x) => x.json());
    const yesterday = r.days[r.days.length - 2];
    assert.equal(yesterday.fresh, 4);
    assert.equal(yesterday.d1, 50);
    assert.equal(r.days[r.days.length - 1].dau, 2);
    assert.deepEqual(r.sources.find((x) => x.k === 'tiktok'), { k: 'tiktok', n: 2 });
    assert.equal(r.events.find((x) => x.k === 'round').n, 12);
    assert.equal(r.events.find((x) => x.k === 'hack'), undefined);
  } finally { await s.close(); }
});

test('purchases: verified with Google (mocked), acknowledged/consumed, idempotent, not reusable, season pass marks leaderboard', async () => {
  const { generateKeyPairSync, createVerify } = await import('node:crypto');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'svc@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const calls = [];
  const store = { 'tok-ads-0000001': { productId: 'remove_ads', purchaseState: 0, acknowledgementState: 0, consumptionState: 0, orderId: 'GPA.1' },
    'tok-pass-000001': { productId: 'season_pass', purchaseState: 0, acknowledgementState: 0, consumptionState: 0, orderId: 'GPA.2' },
    'tok-pend-000001': { productId: 'skins_pack', purchaseState: 2 } };
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url); calls.push([opts.method || 'GET', u]);
    const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (u.includes('oauth2')) {
      const jwt = new URLSearchParams(opts.body).get('assertion').split('.');
      const ok = createVerify('RSA-SHA256').update(jwt[0] + '.' + jwt[1]).verify(publicKey, Buffer.from(jwt[2], 'base64url'));
      return ok ? res(200, { access_token: 'AT', expires_in: 3600 }) : res(401, {});
    }
    assert.equal(opts.headers.Authorization, 'Bearer AT');
    const m = /products\/([^/]+)\/tokens\/([^/:]+)(?::(\w+))?/.exec(u);
    const p = store[decodeURIComponent(m[2])];
    if (!p || p.productId !== m[1]) return res(404, {});
    if (m[3] === 'acknowledge') { p.acknowledgementState = 1; return res(204, {}); }
    if (m[3] === 'consume') { p.consumptionState = 1; return res(204, {}); }
    return res(200, p);
  };
  const s = await boot({ billing: { packageName: 'app.mathclash.game', serviceAccount: sa, fetchImpl } });
  try {
    const a = await s.api('POST', '/api/register', { name: 'مشتري' });
    const b = await s.api('POST', '/api/register', { name: 'آخر' });
    assert.equal((await s.api('GET', '/api/config')).billing, true);
    let r = await s.api('POST', '/api/purchases/verify', { productId: 'remove_ads', token: 'tok-ads-0000001' }, a.token);
    assert.equal(r.entitlements.noAds, true);
    assert.equal(store['tok-ads-0000001'].acknowledgementState, 1, 'acknowledged on server');
    assert.equal((await s.api('POST', '/api/purchases/verify', { productId: 'remove_ads', token: 'tok-ads-0000001' }, a.token)).entitlements.noAds, true, 'idempotent');
    assert.equal((await s.api('POST', '/api/purchases/verify', { productId: 'remove_ads', token: 'tok-ads-0000001' }, b.token)).status, 409, 'token cannot be reused');
    assert.equal((await s.api('POST', '/api/purchases/verify', { productId: 'skins_pack', token: 'tok-pend-000001' }, a.token)).status, 402, 'pending is not granted');
    assert.equal((await s.api('POST', '/api/purchases/verify', { productId: 'skins_pack', token: 'tok-unknown-0001' }, a.token)).status, 400);
    assert.equal((await s.api('POST', '/api/purchases/verify', { productId: 'gems', token: 'tok-ads-0000001' }, a.token)).status, 400);
    r = await s.api('POST', '/api/purchases/verify', { productId: 'season_pass', token: 'tok-pass-000001' }, a.token);
    assert.ok(r.entitlements.season);
    assert.equal(store['tok-pass-000001'].consumptionState, 1, 'season pass consumed');
    const ent = (await s.api('GET', '/api/me/entitlements', null, a.token)).entitlements;
    assert.deepEqual({ noAds: ent.noAds, skins: ent.skins, season: !!ent.season }, { noAds: true, skins: false, season: true });
    // علامة التذكرة في لوحة الصدارة
    const { isoWeek } = await import('../../server/services.js');
    s.db.run("INSERT INTO runs(id, player_id, kind, seed, cfg, started, submitted, score, valid, week) VALUES ('rx',?,?,?,?,?,?,?,1,?)", a.id, 'weekly', 's', '{}', s.clock.t, s.clock.t, 99, isoWeek(s.clock.t));
    const lb = await s.api('GET', '/api/leaderboard/weekly');
    assert.equal(lb.list[0].pass, true);
  } finally { await s.close(); }
});

test('purchases: disabled without a service account', async () => {
  const s = await boot();
  try {
    const a = await s.api('POST', '/api/register', { name: 'x' });
    assert.equal((await s.api('POST', '/api/purchases/verify', { productId: 'remove_ads', token: 'tok-ads-0000001' }, a.token)).status, 501);
    assert.equal((await s.api('GET', '/api/me/entitlements', null, a.token)).billing, false);
  } finally { await s.close(); }
});
