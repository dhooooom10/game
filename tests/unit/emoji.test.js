// حارس الإيموجي: اللعبة تعمل من Android 7 (minSdk 24) الذي يعرض حتى Emoji 3.0 فقط،
// وWebView يستخدم خط الإيموجي من النظام. أي إيموجي أحدث يظهر مربعًا فارغًا على تلك الأجهزة.
// النطاقات مولّدة من unicode.org/Public/emoji/latest/emoji-test.txt (كل ما إصداره > E3.0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const NEWER_THAN_E3 = [[0x2640, 0x2640], [0x2642, 0x2642], [0x265F, 0x265F], [0x267E, 0x267E], [0x2695, 0x2695], [0x26A7, 0x26A7],
  [0x1F6D5, 0x1F6D9], [0x1F6DC, 0x1F6DF], [0x1F6F7, 0x1F6FC], [0x1F7E0, 0x1F7EB], [0x1F7F0, 0x1F7F0], [0x1F90C, 0x1F90F], [0x1F91F, 0x1F91F],
  [0x1F928, 0x1F92F], [0x1F931, 0x1F932], [0x1F93F, 0x1F93F], [0x1F94C, 0x1F94F], [0x1F95F, 0x1F97F], [0x1F992, 0x1F9AF], [0x1F9B4, 0x1F9BF],
  [0x1F9C1, 0x1F9FF], [0x1FA70, 0x1FAFF]];
const isNew = (cp) => NEWER_THAN_E3.some(([a, b]) => cp >= a && cp <= b);

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') yield* files(p); } else if (/\.(js|html|css)$/.test(e.name) && e.name !== 'sw.js') yield p;
  }
}

test('every emoji shown in the app renders on Android 7 (Emoji ≤ 3.0, no ZWJ sequences)', () => {
  const bad = [];
  for (const f of files('public')) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const ch of txt) {
      const cp = ch.codePointAt(0);
      if (isNew(cp)) bad.push(`${path.relative('public', f)}: ${ch} U+${cp.toString(16).toUpperCase()}`);
    }
    // تسلسلات ZWJ (مثل 👨‍👩‍👧) ظهرت تدريجيًا ولا تُضمن على الأجهزة القديمة
    const zwj = txt.match(/\p{Extended_Pictographic}️?‍\p{Extended_Pictographic}/gu);
    if (zwj) bad.push(...zwj.map((z) => `${path.relative('public', f)}: ZWJ ${z}`));
  }
  assert.deepEqual(bad, []);
});
