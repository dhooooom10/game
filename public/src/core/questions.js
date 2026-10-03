/* =========================================================================
   محرّك الأسئلة — مشترك بين جميع الأنماط.
   -------------------------------------------------------------------------
   سياسة الأعداد (موثّقة أيضًا في README وفي شاشة التدريب):
   • كل الإجابات أعداد صحيحة. لا توجد كسور عشرية، فلا حاجة لأي تقريب.
   • القسمة دائمًا بلا باقٍ، والمقسوم عليه ≥ ٢ (لا قسمة على صفر ولا على ١).
   • الضرب لا يستخدم الصفر عاملًا (حتى لا يكون للعدد المفقود أكثر من حل).
   • الأعداد السالبة: لا تظهر إلا في الطرح من المستوى ٨ وفي الجمع من المستوى ٩،
     أو في دروس السوالب تحديدًا. وتُكتب بين قوسين داخل المعادلة: ٥ + (−٣).
   • الكسور: «كسر من عدد» فقط، والعدد يقبل القسمة على المقام دائمًا.
   • النسب المئوية: نسب شائعة من أعداد تجعل الناتج صحيحًا.
   • المعادلة تُعرض دائمًا من اليسار إلى اليمين (معزولة الاتجاه) حتى لا تنعكس
     «٥ − ٣» إلى «٣ − ٥» داخل الواجهة العربية.
   ========================================================================= */

export const OPS = ['add', 'sub', 'mul', 'div'];
export const TOPICS = ['add', 'sub', 'mul', 'div', 'order', 'frac', 'percent', 'power', 'count', 'countAdd'];
export const FORMATS = ['input', 'choice', 'missing', 'compare'];
export const MAX_TIER = 10;

const SYM = { add: '+', sub: '−', mul: '×', div: '÷' };

/* ---------- جداول المستويات ---------- */
const ADD_RANGE = [[1, 5], [1, 9], [2, 15], [5, 30], [10, 50], [10, 99], [20, 199], [50, 499], [100, 999], [100, 1999]];
const MUL_RANGE = [
  [[1, 5], [2, 5]], [[2, 5], [1, 10]], [[2, 10], [1, 10]], [[2, 12], [2, 12]], [[6, 12], [6, 12]],
  [[11, 20], [2, 9]], [[11, 30], [2, 9]], [[11, 50], [3, 12]], [[12, 40], [11, 19]], [[21, 60], [11, 25]],
];
// [المقسوم عليه, الناتج]
const DIV_RANGE = [
  [[2, 5], [1, 5]], [[2, 5], [1, 10]], [[2, 10], [1, 10]], [[2, 12], [2, 12]], [[6, 12], [6, 12]],
  [[2, 9], [11, 20]], [[2, 9], [11, 30]], [[3, 12], [11, 50]], [[11, 19], [12, 40]], [[11, 25], [21, 60]],
];

/** سياسة كل مستوى — تُعرض للاعب في شاشة التدريب */
export function tierPolicy(tier) {
  const t = clampTier(tier);
  const [lo, hi] = ADD_RANGE[t - 1];
  const [ma, mb] = MUL_RANGE[t - 1];
  return {
    tier: t,
    addRange: [lo, hi],
    mulFactors: [ma, mb],
    divisor: DIV_RANGE[t - 1][0],
    negatives: t >= 9 ? 'add-sub' : t >= 8 ? 'sub' : 'none',
    decimals: false,
  };
}

export const clampTier = (t) => Math.max(1, Math.min(MAX_TIER, Math.round(t || 1)));

/* ---------- أدوات ---------- */
const N = (n) => ({ n });
const O = (op) => ({ op: SYM[op] || op });
const EQ = { eq: true };
const BLANK = { blank: true };

/** يحسب قيمة عملية ثنائية */
export function applyOp(op, a, b) {
  switch (op) {
    case 'add': return a + b;
    case 'sub': return a - b;
    case 'mul': return a * b;
    case 'div': return a / b;
    default: throw new Error('op ' + op);
  }
}

/** تقدير زمن معقول لحل السؤال (بالمللي ثانية) — يستخدم لمكافأة السرعة والتقييم */
export function parTime(topic, tier, format) {
  const t = clampTier(tier);
  let base;
  switch (topic) {
    case 'add': base = 2200 + t * 650; break;
    case 'sub': base = 2500 + t * 700; break;
    case 'mul': base = 2400 + t * 900; break;
    case 'div': base = 2800 + t * 950; break;
    case 'order': base = 5000 + t * 900; break;
    case 'count': case 'countAdd': base = 3500; break;
    default: base = 4200 + t * 700;
  }
  const f = { input: 1, choice: 0.8, missing: 1.25, compare: 1.7 }[format] || 1;
  return Math.round(base * f);
}

/* ---------- مولّدات العمليات الأساسية ---------- */
function genAdd(rng, tier) {
  const t = clampTier(tier);
  let [lo, hi] = ADD_RANGE[t - 1];
  let a, b;
  if (t === 1) { a = rng.int(1, 5); b = rng.int(1, 5); }
  else { a = rng.int(lo, hi); b = rng.int(lo, hi); }
  if (t >= 9 && rng.chance(0.3)) a = -a; // سالب في الجمع من المستوى ٩
  return { op: 'add', a, b, c: a + b };
}
function genSub(rng, tier) {
  const t = clampTier(tier);
  const [lo, hi] = ADD_RANGE[t - 1];
  let a = rng.int(lo, hi), b = rng.int(lo, hi);
  if (t === 1) { a = rng.int(2, 9); b = rng.int(1, a); }
  const allowNeg = t >= 8;
  if (allowNeg && rng.chance(0.4)) { if (a > b) [a, b] = [b, a]; }
  else if (b > a) [a, b] = [b, a];
  if (a === b && a > 1) b = a - rng.int(1, Math.min(a - 1, 9));
  return { op: 'sub', a, b, c: a - b };
}
function genMul(rng, tier) {
  const t = clampTier(tier);
  const [ra, rb] = MUL_RANGE[t - 1];
  let a = rng.int(ra[0], ra[1]), b = rng.int(rb[0], rb[1]);
  if (rng.chance(0.5)) [a, b] = [b, a];
  if (a === 1 && b === 1) b = rng.int(2, 5);
  return { op: 'mul', a, b, c: a * b };
}
function genDiv(rng, tier) {
  const t = clampTier(tier);
  const [rd, rq] = DIV_RANGE[t - 1];
  const b = rng.int(Math.max(2, rd[0]), rd[1]);
  const c = rng.int(rq[0], rq[1]);
  return { op: 'div', a: b * c, b, c };
}
const GEN = { add: genAdd, sub: genSub, mul: genMul, div: genDiv };

/** عملية ثنائية بسيطة صالحة دائمًا. cfg اختياري للدروس:
 *  table: جدول ضرب ثابت · divBy: مقسوم عليه ثابت · range: [أدنى, أعلى] للجمع والطرح */
export function genBinary(rng, op, tier, cfg = {}) {
  if (op === 'mul' && cfg.table) {
    const b = rng.int(1, 12);
    return rng.chance(0.5) ? { op, a: cfg.table, b, c: cfg.table * b } : { op, a: b, b: cfg.table, c: cfg.table * b };
  }
  if (op === 'div' && cfg.divBy) {
    const c = rng.int(1, 12);
    return { op, a: cfg.divBy * c, b: cfg.divBy, c };
  }
  if ((op === 'add' || op === 'sub') && cfg.range) {
    const [lo, hi] = cfg.range;
    let a = rng.int(lo, hi), b = rng.int(lo, hi);
    if (op === 'sub' && b > a) [a, b] = [b, a];
    if (op === 'sub' && a === b && a > 1) b = a - 1;
    return { op, a, b, c: op === 'add' ? a + b : a - b };
  }
  const g = GEN[op];
  if (!g) throw new Error('unknown op ' + op);
  return g(rng, tier);
}

/* ---------- الشرح المختصر ---------- */
function explainBinary({ op, a, b, c }) {
  if (op === 'add') {
    if (a > 0 && b > 0 && a < 10 && b < 10 && a + b > 10) {
      const need = 10 - Math.max(a, b);
      const big = Math.max(a, b), small = Math.min(a, b);
      return { key: 'ex.make10', p: { a: big, b: small, need, rest: small - need, c } };
    }
    if (a >= 10 && b >= 10 && a < 100 && b < 100) {
      const tens = Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10;
      const ones = (a % 10) + (b % 10);
      return { key: 'ex.addSplit', p: { e: [N(a), O('add'), N(b)], tens, ones, c } };
    }
    return { key: 'ex.addCheck', p: { e: [N(a), O('add'), N(b), EQ, N(c)], back: [N(c), O('sub'), N(b), EQ, N(a)] } };
  }
  if (op === 'sub') {
    if (c < 0) return { key: 'ex.subNeg', p: { e: [N(a), O('sub'), N(b), EQ, N(c)], a, b, d: b - a } };
    return { key: 'ex.subCheck', p: { e: [N(a), O('sub'), N(b), EQ, N(c)], back: [N(c), O('add'), N(b), EQ, N(a)] } };
  }
  if (op === 'mul') {
    const big = Math.max(a, b), small = Math.min(a, b);
    if (big > 10 && big < 100) {
      const t = Math.floor(big / 10) * 10, o = big % 10;
      if (o !== 0) {
        return { key: 'ex.mulSplit', p: {
          e: [N(big), O('mul'), N(small)],
          s: [N(t), O('mul'), N(small), O('add'), N(o), O('mul'), N(small)],
          v: [N(t * small), O('add'), N(o * small), EQ, N(c)] } };
      }
    }
    return { key: 'ex.mulGroups', p: { e: [N(a), O('mul'), N(b), EQ, N(c)], a, b } };
  }
  return { key: 'ex.divCheck', p: { e: [N(a), O('div'), N(b), EQ, N(c)], back: [N(b), O('mul'), N(c), EQ, N(a)] } };
}

/* ---------- الصيغ ---------- */
function binaryParts({ op, a, b, c }, blankPos = -1) {
  return [blankPos === 0 ? BLANK : N(a), O(op), blankPos === 1 ? BLANK : N(b), EQ, blankPos === 2 ? BLANK : N(c)];
}

function missingFrom(bin, rng) {
  // نُخفي أحد المعاملين ونضمن حلًا وحيدًا
  const pos = rng.int(0, 1);
  const { op, a, b, c } = bin;
  const x = pos === 0 ? a : b;
  let inv;
  if (op === 'add') inv = [N(c), O('sub'), N(pos === 0 ? b : a)];
  else if (op === 'sub') inv = pos === 0 ? [N(c), O('add'), N(b)] : [N(a), O('sub'), N(c)];
  else if (op === 'mul') inv = [N(c), O('div'), N(pos === 0 ? b : a)];
  else inv = pos === 0 ? [N(c), O('mul'), N(b)] : [N(a), O('div'), N(c)];
  return {
    parts: binaryParts(bin, pos),
    answer: x,
    explain: { key: 'ex.missing', p: { e: inv.concat([EQ, N(x)]) } },
  };
}

const commSig = (op, a, b) => (op === 'add' || op === 'mul') ? `${op}:${Math.min(a, b)},${Math.max(a, b)}` : `${op}:${a},${b}`;

/** يولّد عملية مكافئة القيمة لعملية أخرى (للمقارنة بنتيجة «متساويان») */
function equalPartner(rng, bin) {
  const { op, c } = bin;
  for (let i = 0; i < 20; i++) {
    if (op === 'add' || (op === 'sub' && rng.chance(0.4))) {
      if (c < 3) break;
      const a = rng.int(1, c - 1);
      if (a !== bin.a && a !== bin.b) return { op: 'add', a, b: c - a, c };
    } else if (op === 'sub') {
      const b = rng.int(1, Math.max(2, Math.abs(c) + 9));
      if (b !== bin.b) return { op: 'sub', a: c + b, b, c };
    } else if (op === 'mul') {
      const divs = [];
      for (let k = 2; k * k <= c; k++) if (c % k === 0) divs.push(k);
      const opts = divs.filter((k) => k !== bin.a && k !== bin.b);
      if (opts.length) { const k = rng.pick(opts); return { op: 'mul', a: k, b: c / k, c }; }
      break;
    } else if (op === 'div') {
      const b = rng.int(2, 9);
      if (b !== bin.b) return { op: 'div', a: c * b, b, c };
    }
  }
  return null;
}

function compareFrom(rng, op, tier, cfg = {}) {
  const L = genBinary(rng, op, tier, cfg);
  let R = null, answer;
  const wantEqual = rng.chance(0.22);
  if (wantEqual) R = equalPartner(rng, L);
  if (!R) {
    for (let i = 0; i < 30; i++) {
      const cand = genBinary(rng, op, tier, cfg);
      const diff = Math.abs(cand.c - L.c);
      const close = diff > 0 && diff <= Math.max(3, Math.abs(L.c) * 0.25);
      if (close && commSig(cand.op, cand.a, cand.b) !== commSig(L.op, L.a, L.b)) { R = cand; break; }
    }
    if (!R) {
      R = genBinary(rng, op, tier);
      if (commSig(R.op, R.a, R.b) === commSig(L.op, L.a, L.b)) R = { op: 'add', a: L.c, b: 1, c: L.c + 1 };
    }
  }
  answer = L.c > R.c ? 'left' : L.c < R.c ? 'right' : 'equal';
  return {
    left: { parts: [N(L.a), O(L.op), N(L.b)], value: L.c },
    right: { parts: [N(R.a), O(R.op), N(R.b)], value: R.c },
    answer,
    sig: `cmp:${commSig(L.op, L.a, L.b)}|${commSig(R.op, R.a, R.b)}`,
    explain: { key: 'ex.compare', p: { l: [N(L.a), O(L.op), N(L.b), EQ, N(L.c)], r: [N(R.a), O(R.op), N(R.b), EQ, N(R.c)], rel: answer } },
  };
}

/* ---------- الخيارات المتعددة ---------- */
export function makeChoices(rng, answer, ctx = {}) {
  const { a, b, op, allowNeg = false } = ctx;
  const cands = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10];
  if (op === 'add' && a != null) cands.push(a * b, answer + 10, Math.abs(a - b));
  if (op === 'sub' && a != null) cands.push(a + b, -answer);
  if (op === 'mul' && a != null) cands.push(a + b, answer + a, answer - b, (a + 1) * b);
  if (op === 'div' && a != null) cands.push(answer * 2, b, answer + 1);
  const s = String(Math.abs(answer));
  if (s.length === 2 && s[0] !== s[1]) cands.push(Math.sign(answer || 1) * Number(s[1] + s[0]));
  const ok = (v) => Number.isInteger(v) && v !== answer && (allowNeg || v >= 0) && Math.abs(v) < 1e6;
  const pool = rng.shuffle([...new Set(cands.filter(ok))]);
  const out = [answer];
  for (const v of pool) { if (out.length >= 4) break; if (!out.includes(v)) out.push(v); }
  let spread = Math.max(3, Math.round(Math.abs(answer) * 0.2));
  let guard = 0;
  while (out.length < 4 && guard++ < 200) {
    const v = answer + rng.int(-spread, spread);
    if (ok(v) && !out.includes(v)) out.push(v);
    if (guard % 20 === 0) spread += 3;
  }
  return rng.shuffle(out);
}

/* ---------- موضوعات خاصة ---------- */
const OBJECTS = ['🍎', '⭐', '🐟', '🌸', '🎈', '🍪', '🦋', '🍊'];
const FRACS_BY_TIER = [
  [[1, 2]], [[1, 2], [1, 4]], [[1, 2], [1, 3], [1, 4], [1, 5]],
  [[1, 3], [1, 4], [1, 5], [2, 3], [3, 4]], [[2, 3], [3, 4], [2, 5], [3, 5], [1, 6], [1, 8]],
];
const PCTS_BY_TIER = [[50, 10], [50, 10, 25], [10, 20, 25, 50], [5, 10, 20, 25, 50, 75], [5, 15, 20, 30, 40, 60, 75]];

function genSpecial(rng, topic, tier, cfg = {}) {
  const t = clampTier(tier);
  switch (topic) {
    case 'count': {
      const o = rng.pick(OBJECTS), n = rng.int(cfg.min || 1, cfg.max || (t <= 1 ? 5 : 10));
      return { parts: [{ objs: { e: o, n } }], answer: n, sig: `count:${n}`, dir: 'ui', explain: { key: 'ex.count', p: { x: n } } };
    }
    case 'countAdd': {
      const o = rng.pick(OBJECTS), max = cfg.max || 4, a = rng.int(1, max), b = rng.int(1, max);
      return { parts: [{ objs: { e: o, n: a } }, O('add'), { objs: { e: o, n: b } }], answer: a + b, sig: `cadd:${a},${b}`,
        explain: { key: 'ex.addCheck', p: { e: [N(a), O('add'), N(b), EQ, N(a + b)], back: [N(a + b), O('sub'), N(b), EQ, N(a)] } } };
    }
    case 'frac': {
      const list = FRACS_BY_TIER[Math.min(FRACS_BY_TIER.length, cfg.fracTier || Math.ceil(t / 2)) - 1];
      const [num, den] = rng.pick(list);
      const k = rng.int(2, cfg.kMax || (4 + t * 2));
      const n = den * k, x = num * k;
      return { parts: [{ frac: [num, den] }, { word: 'of' }, N(n)], answer: x, sig: `frac:${num}/${den}:${n}`, dir: 'ui', op: 'frac',
        explain: num === 1 ? { key: 'ex.frac1', p: { e: [N(n), O('div'), N(den), EQ, N(x)] } }
          : { key: 'ex.fracN', p: { e1: [N(n), O('div'), N(den), EQ, N(k)], e2: [N(k), O('mul'), N(num), EQ, N(x)] } } };
    }
    case 'percent': {
      const list = PCTS_BY_TIER[Math.min(PCTS_BY_TIER.length, Math.ceil(t / 2)) - 1];
      const p = rng.pick(list);
      // نختار عددًا يجعل الناتج صحيحًا: n مضاعف لـ 100/gcd(p,100)
      const g = gcd(p, 100), step = 100 / g;
      const n = step * rng.int(1, Math.max(2, Math.floor((cfg.nMax || 40 * t) / step)));
      const x = (n * p) / 100;
      return { parts: [{ pct: p }, { word: 'of' }, N(n)], answer: x, sig: `pct:${p}:${n}`, dir: 'ui', op: 'percent',
        explain: { key: 'ex.pct', p: { e: [N(n), O('mul'), N(p), O('div'), N(100), EQ, N(x)] } } };
    }
    case 'power': {
      const mode = cfg.root ? 'root' : cfg.cube ? rng.pick(['sq', 'cube']) : t >= 5 ? rng.pick(['sq', 'sq', 'root', 'cube']) : t >= 3 ? rng.pick(['sq', 'root']) : 'sq';
      const maxN = cfg.max || (t <= 1 ? 5 : t <= 2 ? 10 : 12);
      if (mode === 'cube') {
        const n = rng.int(2, Math.min(cfg.max || 6, 6));
        return { parts: [{ pow: [n, 3] }], answer: n ** 3, sig: `cube:${n}`, op: 'power',
          explain: { key: 'ex.pow', p: { e: [N(n), O('mul'), N(n), O('mul'), N(n), EQ, N(n ** 3)] } } };
      }
      const n = rng.int(2, maxN);
      if (mode === 'root') {
        return { parts: [{ root: n * n }], answer: n, sig: `root:${n}`, op: 'power',
          explain: { key: 'ex.root', p: { e: [N(n), O('mul'), N(n), EQ, N(n * n)] } } };
      }
      return { parts: [{ pow: [n, 2] }], answer: n * n, sig: `sq:${n}`, op: 'power',
        explain: { key: 'ex.pow', p: { e: [N(n), O('mul'), N(n), EQ, N(n * n)] } } };
    }
    case 'order': {
      // (a op b) op2 c — الأقواس أولًا
      const innerOp = rng.pick(cfg.ops || ['add', 'sub', 'mul']);
      const inner = genBinary(rng, innerOp, Math.min(t, 4), cfg.range ? { range: cfg.range } : {});
      let op2, c, val;
      for (let i = 0; i < 12; i++) {
        op2 = rng.pick(cfg.ops2 || ['add', 'sub', 'mul', 'div']);
        if (op2 === 'add') { c = rng.int(1, 9 + t * 2); val = inner.c + c; break; }
        if (op2 === 'sub') { c = rng.int(1, 9 + t * 2); val = inner.c - c; if (val >= 0 || cfg.neg) break; }
        if (op2 === 'mul') { c = rng.int(2, t <= 2 ? 5 : 9); val = inner.c * c; break; }
        if (op2 === 'div' && inner.c > 0) {
          const ds = [2, 3, 4, 5, 6, 7, 8, 9].filter((k) => inner.c % k === 0);
          if (ds.length) { c = rng.pick(ds); val = inner.c / c; break; }
        }
        op2 = 'add'; c = rng.int(1, 9); val = inner.c + c;
      }
      return {
        parts: [{ lp: true }, N(inner.a), O(inner.op), N(inner.b), { rp: true }, O(op2), N(c)],
        answer: val, sig: `ord:${inner.op}${inner.a},${inner.b}${op2}${c}`, op: 'order',
        explain: { key: 'ex.order', p: { i: [N(inner.a), O(inner.op), N(inner.b), EQ, N(inner.c)], o: [N(inner.c), O(op2), N(c), EQ, N(val)] } },
        _neg: val < 0,
      };
    }
    default:
      throw new Error('unknown topic ' + topic);
  }
}

function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }

/** الصيغ المسموح بها لكل موضوع */
export function formatsFor(topic) {
  if (OPS.includes(topic)) return FORMATS;
  if (topic === 'order') return ['input', 'choice', 'compare'];
  return ['input', 'choice'];
}

/* =========================================================================
   الواجهة الرئيسية: generateQuestion
   opts: { rng, topic, tier, format, cfg }
   ========================================================================= */
export function generateQuestion({ rng, topic, tier = 1, format = 'input', cfg = {} }) {
  const t = clampTier(tier);
  if (!formatsFor(topic).includes(format)) format = 'input';
  let q;
  if (OPS.includes(topic) && format === 'compare') {
    const c = compareFrom(rng, topic, t, cfg);
    q = { kind: 'compare', left: c.left, right: c.right, answer: c.answer, sig: c.sig, explain: c.explain };
  } else if (topic === 'order' && format === 'compare') {
    const A = genSpecial(rng, 'order', t, cfg);
    let B = null;
    for (let i = 0; i < 25; i++) {
      const cand = genSpecial(rng, 'order', t, cfg);
      if (cand.sig !== A.sig && Math.abs(cand.answer - A.answer) <= Math.max(4, Math.abs(A.answer) * 0.3)) { B = cand; break; }
    }
    if (!B) { B = genSpecial(rng, 'order', t, cfg); if (B.sig === A.sig) B = genSpecial(rng, 'order', t, cfg); }
    const ans = A.answer > B.answer ? 'left' : A.answer < B.answer ? 'right' : 'equal';
    q = { kind: 'compare', left: { parts: A.parts, value: A.answer }, right: { parts: B.parts, value: B.answer }, answer: ans,
      sig: `cmp:${A.sig}|${B.sig}`, explain: { key: 'ex.compare', p: { l: A.parts.concat([EQ, N(A.answer)]), r: B.parts.concat([EQ, N(B.answer)]), rel: ans } } };
  } else if (OPS.includes(topic) && !cfg.forceNeg) {
    const bin = genBinary(rng, topic, t, cfg);
    if (format === 'missing') {
      const m = missingFrom(bin, rng);
      q = { kind: 'missing', parts: m.parts, answer: m.answer, explain: m.explain, sig: `mis:${bin.op}:${bin.a},${bin.b},${m.answer}` };
    } else {
      q = { kind: 'expr', parts: [N(bin.a), O(bin.op), N(bin.b), EQ, BLANK], answer: bin.c, explain: explainBinary(bin),
        sig: commSig(bin.op, bin.a, bin.b), _bin: bin };
    }
    q.allowNegative = bin.c < 0 || bin.a < 0 || bin.b < 0 || (topic === 'sub' && t >= 8) || (topic === 'add' && t >= 9);
  } else if (topic === 'sub' && cfg.forceNeg) {
    // دروس تأسيس السوالب: الناتج سالب فعلًا
    const hi = cfg.max || 10, b = rng.int(Math.max(2, (cfg.min || 1) + 1), hi), a = rng.int(cfg.min || 1, b - 1);
    const bin = { op: 'sub', a, b, c: a - b };
    q = { kind: 'expr', parts: [N(a), O('sub'), N(b), EQ, BLANK], answer: bin.c, explain: explainBinary(bin), sig: `sub:${a},${b}`, allowNegative: true, _bin: bin };
  } else {
    const s = genSpecial(rng, topic, t, cfg);
    q = { kind: 'expr', parts: s.parts.concat(s.dir === 'ui' || topic === 'count' ? [] : [EQ, BLANK]), answer: s.answer, explain: s.explain, sig: s.sig, dir: s.dir };
    q.allowNegative = !!s._neg;
  }
  q.topic = topic;
  q.op = statCategory(topic);
  q.tier = t;
  q.format = q.kind === 'compare' ? 'compare' : q.kind === 'missing' ? 'missing' : format === 'choice' ? 'choice' : 'input';
  q.dir = q.dir || 'ltr';
  q.parMs = parTime(topic, t, q.format);
  q.sig = q.format + '|' + q.sig;
  if (q.format === 'choice') {
    const bin = q._bin;
    q.choices = makeChoices(rng, q.answer, { ...(bin || {}), allowNeg: !!q.allowNegative });
  }
  delete q._bin;
  return q;
}

/** فئة الإحصاء التي يُحتسب فيها السؤال */
export function statCategory(topic) {
  if (topic === 'count' || topic === 'countAdd') return 'add';
  return topic;
}

/** يتحقق من إجابة اللاعب (عدد أو 'left'/'right'/'equal') */
export function checkAnswer(q, value) {
  if (value === null || value === undefined) return false;
  if (q.format === 'compare') return value === q.answer;
  return Number(value) === q.answer;
}

/* =========================================================================
   مصنع أسئلة بذاكرة قصيرة يمنع التكرار المزعج
   ========================================================================= */
export function createQuestionFactory(rng, { memory = 14 } = {}) {
  const recent = [];
  return {
    make(opts) {
      let q;
      for (let i = 0; i < 30; i++) {
        q = generateQuestion({ rng, ...opts });
        if (!recent.includes(q.sig)) break;
      }
      recent.push(q.sig);
      if (recent.length > memory) recent.shift();
      return q;
    },
    remember(sig) { recent.push(sig); if (recent.length > memory) recent.shift(); },
    get recent() { return recent.slice(); },
  };
}

/** يقيّم قيمة رموز تعبير بسيط (للتحقق في الاختبارات) */
export function evalParts(parts) {
  const toks = [];
  for (const p of parts) {
    if (p.eq || p.blank) break;
    if ('n' in p) toks.push(p.n);
    else if (p.op) toks.push({ '+': 'add', '−': 'sub', '×': 'mul', '÷': 'div' }[p.op]);
    else if (p.lp) toks.push('(');
    else if (p.rp) toks.push(')');
    else if (p.pow) toks.push(p.pow[0] ** p.pow[1]);
    else if (p.root) toks.push(Math.sqrt(p.root));
    else if (p.objs) toks.push(p.objs.n);
  }
  // تقييم بالأقواس ثم الأولوية
  const prec = { add: 1, sub: 1, mul: 2, div: 2 };
  const out = [], st = [];
  for (const tk of toks) {
    if (typeof tk === 'number') out.push(tk);
    else if (tk === '(') st.push(tk);
    else if (tk === ')') { while (st.length && st[st.length - 1] !== '(') out.push(st.pop()); st.pop(); }
    else { while (st.length && st[st.length - 1] !== '(' && prec[st[st.length - 1]] >= prec[tk]) out.push(st.pop()); st.push(tk); }
  }
  while (st.length) out.push(st.pop());
  const s = [];
  for (const tk of out) {
    if (typeof tk === 'number') s.push(tk);
    else { const b = s.pop(), a = s.pop(); s.push(applyOp(tk, a, b)); }
  }
  return s[0];
}
