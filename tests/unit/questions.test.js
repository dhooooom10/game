import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../public/src/core/rng.js';
import { generateQuestion, createQuestionFactory, checkAnswer, evalParts, OPS, FORMATS, MAX_TIER, makeChoices, formatsFor } from '../../public/src/core/questions.js';

const SPECIAL = ['order', 'frac', 'percent', 'power', 'count', 'countAdd'];

function valueOfExpr(q) {
  // للمعادلات العادية: قيمة الطرف الأيسر يجب أن تساوي الإجابة
  return evalParts(q.parts);
}

test('arithmetic answers are always correct integers for every op, tier and format', () => {
  const rng = createRng(42);
  for (const op of OPS) for (let tier = 1; tier <= MAX_TIER; tier++) for (const format of FORMATS) for (let k = 0; k < 60; k++) {
    const q = generateQuestion({ rng, topic: op, tier, format });
    if (q.format === 'compare') {
      assert.ok(['left', 'right', 'equal'].includes(q.answer));
      const L = evalParts(q.left.parts), R = evalParts(q.right.parts);
      assert.equal(L, q.left.value); assert.equal(R, q.right.value);
      assert.equal(q.answer, L > R ? 'left' : L < R ? 'right' : 'equal');
      continue;
    }
    assert.ok(Number.isInteger(q.answer), `non-integer ${JSON.stringify(q)}`);
    if (q.format === 'missing') {
      // نعوّض الإجابة في الخانة ونتحقق من صحة المساواة
      const filled = q.parts.map((p) => (p.blank ? { n: q.answer } : p));
      const eqi = filled.findIndex((p) => p.eq);
      assert.equal(evalParts(filled.slice(0, eqi)), filled[eqi + 1].n, JSON.stringify(q.parts));
    } else {
      assert.equal(valueOfExpr(q), q.answer);
    }
  }
});

test('division never by zero or one, never with remainder', () => {
  const rng = createRng(7);
  for (let tier = 1; tier <= MAX_TIER; tier++) for (let k = 0; k < 300; k++) {
    const q = generateQuestion({ rng, topic: 'div', tier, format: 'input' });
    const a = q.parts[0].n, b = q.parts[2].n;
    assert.ok(b >= 2, 'divisor >= 2');
    assert.equal(a % b, 0);
  }
});

test('multiplication never uses zero (unique missing number)', () => {
  const rng = createRng(9);
  for (let tier = 1; tier <= MAX_TIER; tier++) for (let k = 0; k < 200; k++) {
    const q = generateQuestion({ rng, topic: 'mul', tier, format: 'missing' });
    for (const p of q.parts) if ('n' in p) assert.notEqual(p.n, 0);
  }
});

test('negative policy: no negatives below tier 8 for sub and tier 9 for add', () => {
  const rng = createRng(3);
  for (let tier = 1; tier <= 7; tier++) for (let k = 0; k < 300; k++) {
    for (const op of ['add', 'sub']) {
      const q = generateQuestion({ rng, topic: op, tier, format: 'input' });
      assert.ok(q.answer >= 0, `${op} t${tier} gave ${q.answer}`);
      for (const p of q.parts) if ('n' in p) assert.ok(p.n >= 0);
    }
  }
  for (let k = 0; k < 300; k++) {
    const q = generateQuestion({ rng, topic: 'add', tier: 8, format: 'input' });
    for (const p of q.parts) if ('n' in p) assert.ok(p.n >= 0);
  }
  let sawNeg = false;
  for (let k = 0; k < 200; k++) if (generateQuestion({ rng, topic: 'sub', tier: 9, format: 'input' }).answer < 0) sawNeg = true;
  assert.ok(sawNeg, 'tier 9 sub should sometimes be negative');
});

test('multiple choice: 4 distinct options containing the answer, no negatives unless allowed', () => {
  const rng = createRng(11);
  for (const op of OPS) for (let tier = 1; tier <= MAX_TIER; tier++) for (let k = 0; k < 80; k++) {
    const q = generateQuestion({ rng, topic: op, tier, format: 'choice' });
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4, 'distinct');
    assert.ok(q.choices.includes(q.answer));
    if (!q.allowNegative) for (const c of q.choices) assert.ok(c >= 0, `neg choice ${c} for ${op} t${tier}`);
  }
  const small = makeChoices(rng, 0, {});
  assert.equal(new Set(small).size, 4);
  assert.ok(small.every((x) => x >= 0));
});

test('special topics produce valid integer answers', () => {
  const rng = createRng(5);
  for (const topic of SPECIAL) for (let tier = 1; tier <= MAX_TIER; tier++) for (let k = 0; k < 50; k++) {
    for (const format of formatsFor(topic)) {
      const q = generateQuestion({ rng, topic, tier, format });
      if (q.format === 'compare') { assert.ok(['left', 'right', 'equal'].includes(q.answer)); continue; }
      assert.ok(Number.isInteger(q.answer), `${topic} ${JSON.stringify(q.parts)}`);
      if (topic === 'frac') { const f = q.parts[0].frac; assert.equal((q.parts[2].n * f[0]) / f[1], q.answer); }
      if (topic === 'percent') assert.equal((q.parts[2].n * q.parts[0].pct) / 100, q.answer);
      if (topic === 'order' || topic === 'power' || topic === 'countAdd') assert.equal(evalParts(q.parts), q.answer);
      if (topic === 'order' && tier <= 7) assert.ok(q.answer >= 0);
    }
  }
});

test('lesson configs: tables and fixed divisors', () => {
  const rng = createRng(1);
  for (let k = 0; k < 100; k++) {
    const q = generateQuestion({ rng, topic: 'mul', tier: 3, cfg: { table: 7 } });
    assert.ok(q.parts[0].n === 7 || q.parts[2].n === 7);
    const d = generateQuestion({ rng, topic: 'div', tier: 3, cfg: { divBy: 4 } });
    assert.equal(d.parts[2].n, 4);
    const n = generateQuestion({ rng, topic: 'sub', tier: 8, cfg: { forceNeg: true, min: 1, max: 10 } });
    assert.ok(n.answer < 0); assert.ok(n.allowNegative);
  }
});

test('compare questions never compare identical expressions', () => {
  const rng = createRng(13);
  for (const op of OPS) for (let tier = 1; tier <= MAX_TIER; tier++) for (let k = 0; k < 60; k++) {
    const q = generateQuestion({ rng, topic: op, tier, format: 'compare' });
    const s = (p) => p.parts.map((x) => x.n ?? x.op).join(' ');
    assert.notEqual(s(q.left), s(q.right));
  }
});

test('factory avoids repeating recent questions', () => {
  const rng = createRng(21);
  const fac = createQuestionFactory(rng, { memory: 10 });
  const sigs = [];
  for (let i = 0; i < 200; i++) sigs.push(fac.make({ topic: 'add', tier: 3, format: 'input' }).sig);
  for (let i = 0; i < sigs.length; i++) {
    const window = sigs.slice(Math.max(0, i - 10), i);
    assert.ok(!window.includes(sigs[i]), `repeat at ${i}`);
  }
});

test('checkAnswer handles numbers and compare answers', () => {
  const rng = createRng(2);
  const q = generateQuestion({ rng, topic: 'add', tier: 2, format: 'input' });
  assert.ok(checkAnswer(q, q.answer));
  assert.ok(!checkAnswer(q, q.answer + 1));
  assert.ok(!checkAnswer(q, null));
  const c = generateQuestion({ rng, topic: 'mul', tier: 3, format: 'compare' });
  assert.ok(checkAnswer(c, c.answer));
});

test('seeded generation is deterministic', () => {
  const a = createQuestionFactory(createRng('x')), b = createQuestionFactory(createRng('x'));
  for (let i = 0; i < 30; i++) assert.deepEqual(a.make({ topic: 'mul', tier: 4, format: 'choice' }), b.make({ topic: 'mul', tier: 4, format: 'choice' }));
});
