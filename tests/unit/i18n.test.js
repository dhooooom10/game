import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { _dicts } from '../../public/src/i18n.js';

function files(dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : []; }); }

test('every literal translation key used in the UI exists in Arabic and English', () => {
  const src = files(new URL('../../public/src', import.meta.url).pathname).map((f) => readFileSync(f, 'utf8')).join('\n');
  const keys = new Set([...src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]));
  // مفاتيح تُبنى ديناميكيًا (op., world., badge., m., theme., …) نتحقق منها بالعيّنة أدناه
  const missing = [...keys].filter((k) => !k.endsWith('.') && (!(k in _dicts.ar) || !(k in _dicts.en)));
  assert.deepEqual(missing, []);
});

test('Arabic and English dictionaries have the same keys', () => {
  const a = Object.keys(_dicts.ar), e = new Set(Object.keys(_dicts.en));
  assert.deepEqual(a.filter((k) => !e.has(k)), []);
  assert.deepEqual([...e].filter((k) => !(k in _dicts.ar)), []);
});

test('dynamic key families are complete', async () => {
  const { BADGES, MISSION_POOL, COSMETICS } = await import('../../public/src/core/progression.js');
  const { WORLDS } = await import('../../public/src/core/modes.js');
  const need = [
    ...BADGES.flatMap((b) => [`badge.${b.id}`, `badge.${b.id}D`]),
    ...MISSION_POOL.map((m) => `m.${m.id}`),
    ...Object.entries(COSMETICS).flatMap(([c, items]) => items.map((i) => `${c}.${i.id}`)),
    ...WORLDS.flatMap((w) => [`world.${w.key}`, `world.${w.key}t`]),
    ...['add', 'sub', 'mul', 'div', 'order', 'frac', 'percent', 'power'].map((o) => `op.${o}`),
    ...['input', 'choice', 'missing', 'compare'].map((f) => `fmt.${f}`),
    ...['easy', 'medium', 'hard', 'expert'].map((d) => `diff.${d}`),
  ];
  for (const k of need) { assert.ok(k in _dicts.ar, 'ar ' + k); assert.ok(k in _dicts.en, 'en ' + k); }
});
