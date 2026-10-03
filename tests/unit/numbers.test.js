import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, formatNumber, normalizeDigits } from '../../public/src/core/numbers.js';

test('parseAnswer accepts Arabic-Indic, Persian and Western digits', () => {
  assert.equal(parseAnswer('١٢'), 12);
  assert.equal(parseAnswer('12'), 12);
  assert.equal(parseAnswer('۴۵'), 45);
  assert.equal(parseAnswer('١2'), 12);
  assert.equal(parseAnswer(' ٧ '), 7);
  assert.equal(parseAnswer('-٣'), -3);
  assert.equal(parseAnswer('−3'), -3);
  assert.equal(parseAnswer('‏-5'), -5);
  assert.equal(parseAnswer('0'), 0);
  assert.equal(parseAnswer('-0'), 0);
});
test('parseAnswer rejects invalid input', () => {
  for (const s of ['', '-', '1.5', '١٫٥', 'abc', '1-2', '--3', '12345678', null, undefined]) assert.equal(parseAnswer(s), null, String(s));
});
test('formatNumber renders digits and math minus', () => {
  assert.equal(formatNumber(42, 'arabic'), '٤٢');
  assert.equal(formatNumber(-7, 'western'), '−7');
  assert.equal(formatNumber(-7, 'arabic'), '−٧');
  assert.equal(normalizeDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
});
