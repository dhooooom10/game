import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, playBot, wsClient, ADMIN } from './helpers.js';
import { TICK_MS } from '../../public/src/core/rain.js';
import { dailyRain } from '../../public/src/core/modes.js';

let S;
before(async () => { S = await boot(); });
after(async () => { await S.close(); });

const reg = async (name) => (await S.api('POST', '/api/register', { name }));

test('register, auth, rename with moderation', async () => {
  const a = await reg('سارة');
  assert.ok(a.token && a.id && /^[0-9A-F]{6}$/.test(a.code));
  const me = await S.api('GET', '/api/me', null, a.token);
  assert.equal(me.player.name, 'سارة');
  assert.equal((await S.api('GET', '/api/me', null, 'nope')).status, 401);
  assert.equal((await S.api('POST', '/api/me/name', { name: 'x' }, a.token)).error, 'name_length');
  assert.equal((await S.api('POST', '/api/me/name', { name: 'ya غبي' }, a.token)).error, 'name_blocked');
  assert.equal((await S.api('POST', '/api/me/name', { name: '<script>' }, a.token)).error, 'name_chars');
  assert.equal((await S.api('POST', '/api/me/name', { name: 'Sara 2' }, a.token)).name, 'Sara 2');
  const bad = await reg('!!');
  assert.match(bad.name, /^قطرة\d{4}$/, 'invalid name falls back to a generated one');
});

test('weekly storm: server replays the log; real score accepted, forged score impossible, timing enforced', async () => {
  const a = await reg('Bot One');
  const run = await S.api('POST', '/api/weekly/run', null, a.token);
  const play = playBot(run.cfg, run.seed);
  // إرسال قبل أن يمضي الزمن الحقيقي = مرفوض (تشغيل مسرّع)
  const early = await S.api('POST', `/api/runs/${run.runId}/submit`, { log: play.log, endTick: play.endTick }, a.token);
  assert.equal(early.valid, false);
  // جولة جديدة مع زمن حقيقي مناسب
  const run2 = await S.api('POST', '/api/weekly/run', null, a.token);
  const p2 = playBot(run2.cfg, run2.seed);
  S.clock.t += p2.endTick * TICK_MS + 500;
  const ok = await S.api('POST', `/api/runs/${run2.runId}/submit`, { log: p2.log, endTick: p2.endTick }, a.token);
  assert.equal(ok.valid, true);
  assert.equal(ok.score, p2.summary.score);
  // لا يمكن الإرسال مرتين
  assert.equal((await S.api('POST', `/api/runs/${run2.runId}/submit`, { log: p2.log, endTick: p2.endTick }, a.token)).error, 'already_submitted');
  // سجل مزوّر أو جولة لاعب آخر
  const b = await reg('Bot Two');
  assert.equal((await S.api('POST', `/api/runs/${run2.runId}/submit`, { log: p2.log, endTick: p2.endTick }, b.token)).error, 'run_not_found');
  const run3 = await S.api('POST', '/api/weekly/run', null, b.token);
  S.clock.t += 61000;
  assert.equal((await S.api('POST', `/api/runs/${run3.runId}/submit`, { log: [[5, 'DROP TABLE']], endTick: 10 }, b.token)).error, 'bad_log');
  // لوحة الصدارة الأسبوعية
  const lb = await S.api('GET', '/api/leaderboard/weekly', null, a.token);
  assert.equal(lb.list[0].name, 'Bot One');
  assert.equal(lb.list[0].score, p2.summary.score);
  assert.ok(lb.mine && lb.mine.rank === 1);
});

test('inhuman (bot-speed) runs are rejected from leaderboards', async () => {
  const a = await reg('Speedy');
  const run = await S.api('POST', '/api/weekly/run', null, a.token);
  const p = playBot(run.cfg, run.seed, { think: 2 });
  S.clock.t += p.endTick * TICK_MS + 100;
  const r = await S.api('POST', `/api/runs/${run.runId}/submit`, { log: p.log, endTick: p.endTick }, a.token);
  assert.equal(r.valid, false);
  const lb = await S.api('GET', '/api/leaderboard/weekly');
  assert.ok(!lb.list.some((x) => x.name === 'Speedy'));
});

test('admin: tournaments need the admin token; schedule, play, attempts limit, prizes on end', async () => {
  const body = { name_ar: 'بطولة رمضان', name_en: 'Ramadan Cup', occasion: 'ramadan', starts: S.clock.t - 1000, ends: S.clock.t + 3 * 864e5,
    rules: { mode: 'storm', diff: 'hard', seconds: 60, attempts: 2, fixedSeed: true }, prize: { topN: 1, label_ar: 'هلال الذهب' } };
  assert.equal((await S.api('POST', '/api/admin/tournaments', body)).status, 401);
  assert.equal((await S.api('POST', '/api/admin/tournaments', body, 'wrong-token-xxxxxxxx')).status, 401);
  const { tournament: t } = await S.api('POST', '/api/admin/tournaments', body, ADMIN);
  assert.equal(t.status, 'active');
  assert.equal(t.icon, '🌙');
  const up = await S.api('POST', '/api/admin/tournaments', { ...body, name_ar: 'لاحقة', starts: S.clock.t + 864e5, ends: S.clock.t + 2 * 864e5 }, ADMIN);
  assert.equal(up.tournament.status, 'upcoming');
  assert.equal((await S.api('POST', '/api/admin/tournaments', { ...body, ends: body.starts - 1 }, ADMIN)).error, 'bad_dates');

  const cfgList = await S.api('GET', '/api/config');
  assert.equal(cfgList.theme.occasion, 'ramadan');
  assert.ok(cfgList.events.some((e) => e.id === t.id));

  const a = await reg('Champ'), b = await reg('Second');
  const scores = {};
  for (const [pl, think] of [[a, 40], [b, 70]]) {
    const run = await S.api('POST', `/api/tournaments/${t.id}/run`, null, pl.token);
    assert.equal(run.seed, 'T:' + t.rules.seed, 'fixed seed = same storm for everyone');
    const p = playBot(run.cfg, run.seed, { think });
    S.clock.t += p.endTick * TICK_MS + 200;
    const r = await S.api('POST', `/api/runs/${run.runId}/submit`, { log: p.log, endTick: p.endTick }, pl.token);
    assert.equal(r.valid, true);
    scores[pl.name] = r.score;
  }
  assert.ok(scores.Champ > scores.Second);
  await S.api('POST', `/api/tournaments/${t.id}/run`, null, b.token);
  assert.equal((await S.api('POST', `/api/tournaments/${t.id}/run`, null, b.token)).error, 'no_attempts');
  // تعديل ثم إنهاء من لوحة الإدارة → الجائزة للأول فقط
  const ed = await S.api('PUT', `/api/admin/tournaments/${t.id}`, { desc_ar: 'وصف جديد' }, ADMIN);
  assert.equal(ed.tournament.desc_ar, 'وصف جديد');
  const ended = await S.api('POST', `/api/admin/tournaments/${t.id}/end`, null, ADMIN);
  assert.equal(ended.tournament.status, 'ended');
  const meA = await S.api('GET', '/api/me', null, a.token);
  assert.equal(meA.rewards.length, 1);
  assert.match(meA.rewards[0].label_ar, /هلال الذهب/);
  assert.equal((await S.api('GET', '/api/me', null, b.token)).rewards.length, 0);
  assert.equal((await S.api('POST', `/api/tournaments/${t.id}/run`, null, a.token)).error, 'not_active');
});

test('admin: seasons, announcements, player moderation', async () => {
  const s1 = await S.api('GET', '/api/admin/seasons', null, ADMIN);
  const ns = await S.api('POST', '/api/admin/seasons', { name_ar: 'موسم الشتاء', color: '#9FE7FF' }, ADMIN);
  S.clock.t += 10;
  const cfg = await S.api('GET', '/api/config');
  assert.equal(cfg.season.name_ar, 'موسم الشتاء');
  assert.notEqual(cfg.season.id, s1.current.id);
  const an = await S.api('POST', '/api/admin/announcements', { text_ar: 'بطولة العيد تبدأ الجمعة!' }, ADMIN);
  assert.ok((await S.api('GET', '/api/config')).announcements.some((a) => a.id === an.id));
  await S.api('PUT', `/api/admin/announcements/${an.id}`, { active: false }, ADMIN);
  assert.ok(!(await S.api('GET', '/api/config')).announcements.some((a) => a.id === an.id));
  const bad = await reg('Troll');
  const found = await S.api('GET', '/api/admin/players?q=Troll', null, ADMIN);
  await S.api('POST', `/api/admin/players/${found.players[0].id}/ban`, { banned: true }, ADMIN);
  assert.equal((await S.api('GET', '/api/me', null, bad.token)).status, 403);
  const stats = await S.api('GET', '/api/admin/stats', null, ADMIN);
  assert.ok(stats.players >= 5);
  void ns;
});

test('friends by code and friends leaderboard; challenge link with the same storm', async () => {
  const a = await reg('Lina'), b = await reg('Omar');
  assert.equal((await S.api('POST', '/api/friends', { code: 'ZZZZZZ' }, a.token)).error, 'code_not_found');
  const f = await S.api('POST', '/api/friends', { code: b.code }, a.token);
  assert.equal(f.friends[0].name, 'Omar');
  assert.equal((await S.api('GET', '/api/friends', null, b.token)).friends[0].name, 'Lina', 'friendship is mutual');
  // Omar يلعب العاصفة الأسبوعية ثم يصنع تحديًا
  const run = await S.api('POST', '/api/weekly/run', null, b.token);
  const p = playBot(run.cfg, run.seed);
  S.clock.t += p.endTick * TICK_MS + 100;
  await S.api('POST', `/api/runs/${run.runId}/submit`, { log: p.log, endTick: p.endTick }, b.token);
  const fl = await S.api('GET', '/api/leaderboard/friends', null, a.token);
  assert.ok(fl.list.some((x) => x.name === 'Omar'));
  const ch = await S.api('POST', '/api/challenges', { runId: run.runId }, b.token);
  const info = await S.api('GET', `/api/challenges/${ch.id}`);
  assert.equal(info.challenge.creator, 'Omar');
  assert.equal(info.challenge.score, p.summary.score);
  const cr = await S.api('POST', `/api/challenges/${ch.id}/run`, null, a.token);
  assert.equal(cr.seed, run.seed, 'same drops as the challenger');
  const cp = playBot(cr.cfg, cr.seed, { think: 60 });
  S.clock.t += cp.endTick * TICK_MS + 100;
  await S.api('POST', `/api/runs/${cr.runId}/submit`, { log: cp.log, endTick: cp.endTick }, a.token);
  assert.equal((await S.api('GET', `/api/challenges/${ch.id}`)).challenge.takers[0].name, 'Lina');
});

test('account deletion removes the player and their data', async () => {
  const a = await reg('Bye Bye');
  const run = await S.api('POST', '/api/weekly/run', null, a.token);
  const p = playBot(run.cfg, run.seed);
  S.clock.t += p.endTick * TICK_MS + 100;
  await S.api('POST', `/api/runs/${run.runId}/submit`, { log: p.log, endTick: p.endTick }, a.token);
  assert.equal((await S.api('DELETE', '/api/me', null, a.token)).ok, true);
  assert.equal((await S.api('GET', '/api/me', null, a.token)).status, 401);
  assert.ok(!(await S.api('GET', '/api/leaderboard/weekly')).list.some((x) => x.name === 'Bye Bye'));
});

test('daily challenge result: validated once per day', async () => {
  const a = await reg('Daily Dan');
  const date = new Date(S.clock.t).toISOString().slice(0, 10);
  const { cfg, seed } = dailyRain(date);
  const p = playBot(cfg, seed);
  const r = await S.api('POST', '/api/daily/submit', { date, log: p.log, endTick: p.endTick }, a.token);
  assert.equal(r.valid, true);
  assert.equal(r.score, p.summary.score);
  assert.equal((await S.api('POST', '/api/daily/submit', { date, log: p.log, endTick: p.endTick }, a.token)).error, 'already_submitted');
  assert.equal((await S.api('POST', '/api/daily/submit', { date: '2020-01-01', log: [], endTick: 1 }, a.token)).error, 'stale_date');
});

test('websocket: quick match pairs two players, relays progress, validates, updates rating', async () => {
  const a = await reg('Fast Fay'), b = await reg('Slow Sam');
  const ca = await wsClient(S.url, a.token), cb = await wsClient(S.url, b.token);
  ca.send({ t: 'queue' }); cb.send({ t: 'queue' });
  const ma = await ca.wait('match'), mb = await cb.wait('match');
  assert.equal(ma.id, mb.id);
  assert.equal(ma.seed, mb.seed, 'both get the same storm');
  assert.equal(ma.players.length, 2);
  ca.send({ t: 'progress', id: ma.id, score: 300 });
  const pr = await cb.wait('progress');
  assert.equal(pr.score, 300); assert.equal(pr.name, 'Fast Fay');
  ca.send({ t: 'emote', e: '🔥' });
  assert.equal((await cb.wait('emote')).e, '🔥');
  ca.send({ t: 'emote', e: 'free text' });
  const pa = playBot(ma.cfg, ma.seed, { think: 35 }), pb = playBot(mb.cfg, mb.seed, { think: 80 });
  S.clock.t = ma.startAt + pa.endTick * TICK_MS + 200;
  ca.send({ t: 'finish', id: ma.id, log: pa.log, endTick: pa.endTick });
  cb.send({ t: 'finish', id: mb.id, log: pb.log, endTick: pb.endTick });
  const ra = await ca.wait('result'), rb = await cb.wait('result');
  assert.equal(ra.standings[0].name, 'Fast Fay');
  assert.ok(ra.rating.after > ra.rating.before);
  assert.ok(rb.rating.after < rb.rating.before);
  const season = await S.api('GET', '/api/leaderboard/season');
  assert.equal(season.list.find((x) => x.name === 'Fast Fay').score, ra.rating.after);
  ca.close(); cb.close();
});

test('websocket: lonely player gets a clearly-labelled ghost (a real recorded run)', async () => {
  const a = await reg('Lonely');
  const c = await wsClient(S.url, a.token);
  c.send({ t: 'queue' });
  const m = await c.wait('match', 5000);
  assert.equal(m.kind, 'ghost');
  assert.equal(m.ghosts.length, 1);
  assert.ok(m.ghosts[0].timeline.length > 1);
  c.close();
});

test('websocket: rooms by code — join, host settings, team toggle, start, results for all', async () => {
  const [a, b, c] = await Promise.all([reg('Host Hala'), reg('Guest Gana'), reg('Guest Ghaith')]);
  const [ca, cb, cc] = await Promise.all([wsClient(S.url, a.token), wsClient(S.url, b.token), wsClient(S.url, c.token)]);
  ca.send({ t: 'room.create', settings: { diff: 'easy', seconds: 30, mode: 'teams' } });
  const r1 = (await ca.wait('room')).room;
  assert.match(r1.code, /^\d{6}$/);
  cb.send({ t: 'room.join', code: '000000' });
  assert.equal((await cb.wait('error')).code, 'room_not_found');
  cb.send({ t: 'room.join', code: r1.code }); cc.send({ t: 'room.join', code: r1.code });
  await cc.wait((m) => m.t === 'room' && m.room.members.length === 3);
  cb.send({ t: 'room.start' }); // ليس المضيف
  ca.send({ t: 'room.settings', settings: { diff: 'easy', seconds: 30, mode: 'teams' } });
  ca.send({ t: 'room.start' });
  const [ma, mb, mc] = await Promise.all([ca.wait('match'), cb.wait('match'), cc.wait('match')]);
  assert.equal(ma.seed, mc.seed);
  assert.equal(ma.cfg.timeLimit, 30);
  for (const [cl, m, think] of [[ca, ma, 40], [cb, mb, 50], [cc, mc, 60]]) {
    const p = playBot(m.cfg, m.seed, { think });
    S.clock.t = Math.max(S.clock.t, m.startAt + p.endTick * TICK_MS + 100);
    cl.send({ t: 'finish', id: m.id, log: p.log, endTick: p.endTick });
  }
  const res = await cb.wait('result');
  assert.equal(res.standings.length, 3);
  assert.ok(res.teams && res.teams.length === 2);
  assert.equal(res.rating, null, 'room games are unranked');
  ca.close(); cb.close(); cc.close();
});
