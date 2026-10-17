import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeChallengeCode, makeResultCode, decodeCode, addSent, addReceived, setMyAnswer, applyResult, friendsRecord, ensureSocial, challengeId } from '../../public/src/core/social.js';
import { normalizeChallenge, challengeConfig } from '../../public/src/core/challenge.js';
import { createRain } from '../../public/src/core/rain.js';
import { newProfileData } from '../../public/src/core/progression.js';

const custom = normalizeChallenge({ mode: 'custom', ops: ['add', 'mul'], level: 'medium', speed: 'veryfast', dur: 90, lives: 3, accel: false });

test('challenge codes round-trip settings, seed and score — and survive being pasted in a message', () => {
  const code = makeChallengeCode({ uid: 'abc123', name: 'سارة', kind: 'custom', args: custom, seed: 123456789, score: 1520, popped: 31 });
  assert.match(code, /^QC-[A-Za-z0-9_-]+\.[0-9a-z]{3}$/);
  assert.ok(code.length < 140, 'short enough for WhatsApp');
  const c = decodeCode(`⚔️ تحدّيتك!\n${code}\nhttps://play.google.com/...`);
  assert.equal(c.type, 'challenge'); assert.equal(c.name, 'سارة'); assert.equal(c.seed, 123456789);
  assert.deepEqual(c.args, custom); assert.equal(c.score, 1520); assert.equal(c.popped, 31);
  assert.equal(c.id, challengeId('abc123', 'custom', custom, 123456789));
  // نفس الإعدادات + نفس البذرة = نفس القطرات بالضبط
  const a = createRain(challengeConfig(c.args), c.seed), b = createRain(challengeConfig(custom), 123456789);
  for (let i = 0; i < 600; i++) { a.step(); b.step(); }
  assert.deepEqual(a.state.drops.map((d) => d.q?.text ?? d.id), b.state.drops.map((d) => d.q?.text ?? d.id));
  const lv = decodeCode(makeChallengeCode({ uid: 'u', name: 'x', kind: 'level', args: { level: 42, turbo: true }, seed: 7, score: 10, popped: 1 }));
  assert.deepEqual(lv.args, { level: 42, turbo: true }); assert.equal(lv.kind, 'level');
});

test('tampered, truncated or garbage codes are rejected', () => {
  const code = makeChallengeCode({ uid: 'abc123', name: 'A', kind: 'custom', args: custom, seed: 5, score: 100, popped: 5 });
  const body = code.slice(3, code.lastIndexOf('.'));
  const flipped = 'QC-' + (body[5] === 'A' ? body.slice(0, 5) + 'B' : body.slice(0, 5) + 'A') + body.slice(6) + code.slice(code.lastIndexOf('.'));
  assert.throws(() => decodeCode(flipped), /checksum|format/);
  assert.throws(() => decodeCode(code.slice(0, 20)), /format|checksum/);
  assert.throws(() => decodeCode('hello'), /format/);
  assert.throws(() => decodeCode(makeChallengeCode({ uid: 'u', name: 'x', kind: 'level', args: { level: 999 }, seed: 1, score: 1, popped: 1 })), /level/);
});

test('full round trip between two players: send → play → result → who won, and the head-to-head record', () => {
  const me = newProfileData('ar'), friend = newProfileData('en');
  ensureSocial(me).uid = 'me0001'; ensureSocial(friend).uid = 'fr0001';
  const sent = addSent(me, { runId: 1, name: 'Me', kind: 'custom', args: custom, seed: 99, score: 800, popped: 20 });
  assert.equal(addSent(me, { runId: 1, name: 'Me', kind: 'custom', args: custom, seed: 99, score: 800, popped: 20 }).challenge, sent.challenge, 'no duplicate on re-share');
  const ch = decodeCode(sent.code);
  const r = addReceived(friend, ch);
  assert.equal(r.own, false); assert.equal(r.challenge.theirs, 800);
  assert.equal(addReceived(me, ch).own, true, 'own code is recognised');
  setMyAnswer(friend, ch.id, { score: 950, popped: 24 });
  setMyAnswer(friend, ch.id, { score: 700, popped: 15 });
  assert.equal(r.challenge.mine, 950, 'best attempt kept');
  const res = decodeCode(makeResultCode({ uid: 'fr0001', name: 'Friend', id: ch.id, score: r.challenge.mine, popped: r.challenge.minePopped }));
  const ap = applyResult(me, res);
  assert.equal(ap.ok, true); assert.equal(ap.outcome, 'lose');
  assert.equal(applyResult(me, res).challenge.replies.length, 1, 'same friend replying twice is one reply');
  assert.equal(applyResult(newProfileData('ar'), res).ok, false, 'result for an unknown challenge');
  assert.deepEqual(friendsRecord(me).map((f) => [f.uid, f.w, f.l]), [['fr0001', 0, 1]]);
  assert.deepEqual(friendsRecord(friend).map((f) => [f.uid, f.w, f.l]), [['me0001', 1, 0]]);
});

test('saved-round validation and data repair (startup must never crash on bad local data)', async () => {
  const { validActive } = await import('../../public/src/runs.js');
  assert.equal(validActive({ engine: 'rain', kind: 'journey', args: { level: 3 }, seed: 1, log: [], tick: 0 }), true);
  assert.equal(validActive({ engine: 'rain', kind: 'levelDuel', args: null, seed: 1, log: [], tick: 0 }), false);
  assert.equal(validActive({ engine: 'rain', kind: 'daily', args: {}, seed: 1, log: [], tick: 0 }), false);
  assert.equal(validActive({ kind: 'practice', args: {}, snap: { v: 1, state: { answers: [] } } }), true);
  assert.equal(validActive('x'), false);
  const { normalizeData } = await import('../../public/src/core/progression.js');
  const d = normalizeData({ v: 3, journey: { unlocked: 'x', stars: null }, records: null, social: { uid: 'a', list: [null, { dir: 'recv' }, { id: 'q', dir: 'sent', args: {}, replies: null }] } });
  assert.equal(d.journey.unlocked, 1); assert.deepEqual(d.journey.stars, {}); assert.deepEqual(d.records, {});
  assert.equal(d.social.list.length, 1); assert.deepEqual(d.social.list[0].replies, []);
});
