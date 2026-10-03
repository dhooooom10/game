/* =========================================================================
   «مطر المعادلات» — النمط الكلاسيكي من النسخة الأصلية، مبني الآن على محرّك
   الأسئلة المشترك. منطق خالص (بلا DOM) قابل للاختبار.
   قاعدتا العدالة من النسخة الأصلية محفوظتان:
     زمن سقوط القطرة ≥ زمن حلّها × هامش، والفاصل بين القطرات ≥ زمن الحل.
   ========================================================================= */
import { createRng } from './rng.js';
import { createQuestionFactory, parTime } from './questions.js';
import { answerPoints } from './scoring.js';

export const RAIN_DIFFS = {
  easy: { tiers: { add: 2, sub: 2 }, travel: 10, spawn: 3.4, maxDrops: 2, target: 15 },
  medium: { tiers: { add: 3, sub: 3, mul: 2 }, travel: 9, spawn: 2.9, maxDrops: 3, target: 20 },
  hard: { tiers: { add: 4, sub: 4, mul: 3, div: 3 }, travel: 8.5, spawn: 2.6, maxDrops: 3, target: 25 },
  expert: { tiers: { add: 5, sub: 5, mul: 4, div: 4 }, travel: 8, spawn: 2.3, maxDrops: 4, target: 30 },
};
export const RAIN_LIVES = 3;

export function createRain(diff = 'medium', seed = 1) {
  const cfg = RAIN_DIFFS[diff] || RAIN_DIFFS.medium;
  const rng = createRng(seed);
  const fac = createQuestionFactory(rng, { memory: 20 });
  const topics = Object.keys(cfg.tiers);
  // أرضية الأمان: لا تسقط القطرة أسرع من (زمن الحل المتوقع × 1.6)
  const S = {
    diff, cfg, drops: [], nextId: 1, spawnT: 0.4, lives: RAIN_LIVES, popped: 0, missed: 0, wrong: 0,
    score: 0, streak: 0, bestStreak: 0, over: false, won: false, typed: '',
  };

  function spawn() {
    let q;
    for (let i = 0; i < 20; i++) {
      const topic = rng.pick(topics);
      q = fac.make({ topic, tier: cfg.tiers[topic], format: 'input' });
      // لا تظهر قطرتان بالإجابة نفسها في الوقت نفسه
      if (!S.drops.some((d) => !d.dead && d.q.answer === q.answer)) break;
    }
    const minTravel = (q.parMs / 1000) * 1.6;
    const travel = Math.max(cfg.travel, minTravel);
    const d = { id: S.nextId++, q, y: 0, speed: 1 / travel, x: rng.next(), dead: false, born: 0 };
    S.drops.push(d);
    return d;
  }

  const live = () => S.drops.filter((d) => !d.dead);

  const api = {
    state: S,
    /** يتقدّم الزمن dt ثانية. y من 0 (أعلى) إلى 1 (الأرض). يعيد أحداثًا. */
    update(dt) {
      const events = [];
      if (S.over) return events;
      S.spawnT -= dt;
      const alive = live().length;
      if (S.spawnT <= 0 && alive < cfg.maxDrops && S.popped + alive < cfg.target) {
        events.push({ type: 'spawn', drop: spawn() });
        S.spawnT = cfg.spawn;
      }
      for (const d of S.drops) {
        if (d.dead) continue;
        d.y += d.speed * dt;
        if (d.y >= 1) {
          d.dead = true; S.missed++; S.lives--; S.streak = 0;
          events.push({ type: 'miss', drop: d });
          if (S.lives <= 0) { S.over = true; S.won = false; events.push({ type: 'over', won: false }); return events; }
        }
      }
      S.drops = S.drops.filter((d) => !d.dead || d.y < 1.2);
      if (S.popped >= cfg.target && !live().length) { S.over = true; S.won = true; events.push({ type: 'over', won: true }); }
      return events;
    },
    /** كتابة رقم/سالب/حذف. يعيد حدث الانفجار إن طابقت الإجابة قطرة بلا التباس. */
    type(k) {
      if (S.over) return null;
      if (k === 'back') S.typed = S.typed.slice(0, -1);
      else if (k === '-') S.typed = S.typed.startsWith('-') ? S.typed.slice(1) : '-' + S.typed;
      else if (/^\d$/.test(k) && S.typed.replace('-', '').length < 6) S.typed += k;
      return api.submit(false);
    },
    /** forced=true عند الضغط على ✓ */
    submit(forced) {
      if (S.over || !S.typed || S.typed === '-') return null;
      const val = Number(S.typed);
      const ds = live();
      const hit = ds.filter((d) => d.q.answer === val).sort((a, b) => b.y - a.y)[0];
      const amb = ds.some((d) => d.q.answer !== val && String(d.q.answer).startsWith(S.typed));
      const pre = ds.some((d) => String(d.q.answer).startsWith(S.typed));
      if (hit && (forced || !amb)) {
        hit.dead = true; S.popped++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
        const height = Math.max(0, 1 - hit.y);
        const p = answerPoints({ correct: true, tier: hit.q.tier, streak: S.streak });
        const pts = p.total + Math.round(50 * height);
        S.score += pts; S.typed = '';
        return { type: 'pop', drop: hit, points: pts };
      }
      if (forced || !pre) { S.wrong++; S.streak = 0; S.typed = ''; return { type: 'wrong' }; }
      return null;
    },
    summary() {
      const answered = S.popped + S.missed + S.wrong;
      return { score: S.score, correct: S.popped, answered, accuracy: answered ? S.popped / answered : 0, bestStreak: S.bestStreak, won: S.won, lives: S.lives, target: cfg.target, popped: S.popped, missed: S.missed, wrong: S.wrong };
    },
  };
  return api;
}
export { parTime };
