import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, KEYS, hashPass, verifyPass } from '../../public/src/core/storage.js';
import { commitRound } from '../../public/src/core/progression.js';

function fakeLS(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; }, _m: m };
}
import { createBackend } from '../../public/src/core/storage.js';

test('fresh install creates one profile and persists across reloads', () => {
  const ls = fakeLS();
  const s1 = createStore(createBackend(ls));
  s1.init();
  const id = s1.currentId();
  const d = s1.load(id);
  d.xp = 123; d.journey.unlocked = 5;
  s1.save(id, d);
  // «إعادة فتح» التطبيق: مخزن جديد على نفس localStorage
  const s2 = createStore(createBackend(ls));
  s2.init();
  assert.equal(s2.currentId(), id);
  assert.equal(s2.load(id).xp, 123);
  assert.equal(s2.load(id).journey.unlocked, 5);
  assert.equal(s2.profiles().length, 1);
});

test('legacy v1 data migrates non-destructively with user separation', () => {
  const legacy = {
    mc_users: JSON.stringify([{ uid: 'uA', name: 'سارة', salt: 's', hash: 'h', role: 'admin' }, { uid: 'uB', name: 'Omar', role: 'player' }]),
    mc_session: JSON.stringify({ uid: 'uB' }),
    'mc_set:uA': JSON.stringify({ lang: 'ar', digits: 'arabic', sound: false, haptics: false, tutDone: true }),
    'mc_prog:uA': JSON.stringify({ unlocked: 14, stars: { 1: 3, 2: 2, 13: 1 }, best: { '5|medium': 900 }, edu: { 'add|0': 3, 'mul|2': 1 }, eduUnlocked: { add: 2 }, daily: { last: '2026-10-02', best: 700, streak: 4 } }),
    'mc_stats:uA': JSON.stringify({ points: 5000, games: 20, popped: 300, bestStreak: 17, wins: 3 }),
    'mc_prog:uB': JSON.stringify({ unlocked: 3, stars: { 1: 1, 2: 1 } }),
  };
  const ls = fakeLS(legacy);
  const st = createStore(createBackend(ls));
  const r = st.init();
  assert.equal(r.migrated, 2);
  assert.equal(st.currentId(), 'uB', 'keeps the signed-in user');
  const A = st.load('uA'), B = st.load('uB');
  assert.equal(A.journey.unlocked, 14);
  assert.deepEqual(A.journey.stars, { 1: 3, 2: 2, 13: 1 });
  assert.equal(A.lessons.done['add|0'], 3);
  assert.equal(A.lessons.unlocked.add, 2);
  assert.equal(A.settings.digits, 'arabic');
  assert.equal(A.settings.sfx, 0);
  assert.equal(A.settings.haptics, false);
  assert.equal(A.settings.tutorialDone, true);
  assert.equal(A.daily.streak, 4);
  assert.equal(A.stats.bestStreak, 17);
  assert.equal(A.legacy.games, 20);
  assert.equal(B.journey.unlocked, 3);
  assert.deepEqual(B.journey.stars, { 1: 1, 2: 1 });
  assert.notEqual(A.xp, B.xp);
  // كلمة مرور الملف القديم محفوظة
  assert.equal(st.profiles().find((p) => p.id === 'uA').hash, 'h');
  // المفاتيح القديمة لم تُحذف
  assert.ok(ls.getItem('mc_prog:uA'));
  // الترحيل لا يتكرر
  const st2 = createStore(createBackend(ls));
  assert.equal(st2.init().migrated, 0);
  assert.equal(st2.profiles().length, 2);
});

test('profiles are isolated', () => {
  const st = createStore(createBackend(fakeLS()));
  st.init();
  const a = st.currentId();
  const b = st.createProfile('B');
  const da = st.load(a); commitRound(da, { id: 'x', mode: 'time', score: 10, correct: 5, answered: 5 }); st.save(a, da);
  assert.equal(st.load(b).stats.rounds, 0);
  assert.equal(st.load(a).stats.rounds, 1);
  st.saveActive(a, { v: 1 });
  assert.equal(st.loadActive(b), null);
  st.deleteProfile(b);
  assert.equal(st.profiles().length, 1);
});

test('corrupted data falls back safely', () => {
  const ls = fakeLS();
  const st = createStore(createBackend(ls));
  st.init();
  const id = st.currentId();
  ls.setItem(KEYS.data(id), '{broken');
  const d = st.load(id);
  assert.equal(d.journey.unlocked, 1);
});

test('memory fallback when localStorage throws', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('denied'); }, removeItem() {}, key() {}, length: 0 };
  const be = createBackend(bad);
  assert.equal(be.persistent, false);
  const st = createStore(be); st.init();
  assert.ok(st.currentId());
});

test('export/import roundtrip and legacy v1 export import', () => {
  const st = createStore(createBackend(fakeLS()));
  st.init();
  const id = st.currentId();
  const d = st.load(id); d.xp = 77; st.save(id, d);
  const exp = JSON.stringify(st.exportData(id));
  const other = st.createProfile('O');
  st.importData(other, exp);
  assert.equal(st.load(other).xp, 77);
  st.importData(other, { v: 1, settings: { lang: 'en' }, progress: { unlocked: 9, stars: { 1: 2 } }, stats: { games: 1 } });
  assert.equal(st.load(other).journey.unlocked, 9);
  assert.throws(() => st.importData(other, '{"foo":1}'));
});

test('password hashing compatible with v1 format', async () => {
  const { salt, hash } = await hashPass('secret1');
  assert.ok(await verifyPass('secret1', { salt, hash }));
  assert.ok(!(await verifyPass('nope', { salt, hash })));
  assert.ok(await verifyPass('anything', { hash: null }));
});

test('password-protected profile needs unlock unless remembered', () => {
  const st = createStore(createBackend(fakeLS()));
  st.init();
  const id = st.createProfile('P', { salt: 'a', hash: 'b' });
  assert.equal(st.needsUnlock(id), true);
  st.setCurrent(id, { remember: true });
  assert.equal(st.needsUnlock(id), false);
  st.lock(id);
  assert.equal(st.needsUnlock(id), true);
});
