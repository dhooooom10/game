/* مولّد أعداد شبه عشوائية قابل للتكرار (mulberry32) — يضمن أن التحدي اليومي
   وأسئلة تحدّي الصديق تُولَّد بنفس الطريقة على أي جهاز. */

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** عدد صحيح بين lo و hi شاملًا الطرفين */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
    /** اختيار موزون: items = [[value, weight], ...] */
    weighted: (items) => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of items) {
        if ((r -= w) < 0) return v;
      }
      return items[items.length - 1][0];
    },
    /** يشتق مولّدًا مستقلًا (لتوليد احتياطي بنفس البذرة) */
    fork: (salt) => createRng(hashString(String(a) + ':' + salt)),
  };
  return rng;
}

export function randomSeed() {
  try {
    const u = new Uint32Array(1);
    crypto.getRandomValues(u);
    return u[0];
  } catch {
    return (Math.random() * 2 ** 32) >>> 0;
  }
}
