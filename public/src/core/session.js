/* =========================================================================
   محرّك الجولة — منطق خالص بلا واجهة، والوقت يُمرَّر من الخارج (now)
   ليكون قابلًا للاختبار بدقة (الإجابة في اللحظة الأخيرة، الإيقاف، الاستئناف…).
   -------------------------------------------------------------------------
   الحالات: idle → asking ⇄ feedback → … → ended ، و paused من asking/feedback.
   • لا تُقبل إلا إجابة واحدة لكل سؤال (يمنع النقر المزدوج).
   • الوقت الفعّال لا يحتسب فترات الإيقاف.
   • سياسة الاستئناف:
       'swap' يُستبدل السؤال المعروض بسؤال مكافئ (حتى لا يُستغل الإيقاف للتفكير)
       'skip' يُحتسب السؤال المعروض «متخطّى» (التحدي اليومي: أسئلته ثابتة)
       'keep' يبقى السؤال نفسه (التدريب الحر بلا مؤقت)
   ========================================================================= */
import { checkAnswer } from './questions.js';
import { answerPoints } from './scoring.js';

export function createSession(spec, snap = null) {
  const S = snap ? structuredCloneSafe(snap.state) : {
    id: spec.id,
    phase: 'idle',
    index: -1,          // رقم السؤال الحالي
    swaps: 0,           // عدد مرات استبدال السؤال الحالي
    q: null,
    askedAt: 0,         // الوقت الفعّال عند عرض السؤال
    activeMs: 0,        // الوقت الفعّال المتراكم حتى runningSince
    runningSince: null, // لحظة بدء العدّ (null إذا كان متوقفًا)
    pausedFrom: null,   // الحالة قبل الإيقاف
    score: 0, streak: 0, bestStreak: 0,
    correct: 0, wrong: 0, timeouts: 0, skipped: 0,
    lives: spec.lives ?? null,
    answers: [],
    endReason: null,
    lastResult: null,
    interrupted: false,
  };
  if (snap) {
    // جولة مستعادة بعد تحديث الصفحة: تبدأ متوقفة
    if (S.phase === 'asking' || S.phase === 'feedback') { S.pausedFrom = S.phase; S.phase = 'paused'; }
    S.runningSince = null;
    S.interrupted = true;
  }

  const policy = spec.resumePolicy || 'swap';

  const active = (now) => S.activeMs + (S.runningSince != null ? Math.max(0, now - S.runningSince) : 0);
  const timeUp = (now) => spec.timeLimitMs != null && active(now) > spec.timeLimitMs;
  const perQ = () => typeof spec.perQuestionMs === 'function' ? spec.perQuestionMs(S) : spec.perQuestionMs;

  function ask(now) {
    S.index += 1;
    S.swaps = 0;
    S.q = spec.source(S.index, ctx());
    S.askedAt = active(now);
    S.phase = 'asking';
    S.lastResult = null;
  }
  const ctx = () => ({ correct: S.correct, streak: S.streak, answered: S.answers.length, swaps: S.swaps, lives: S.lives });

  function finish(reason, now) {
    if (S.phase === 'ended') return;
    if (S.runningSince != null) { S.activeMs = active(now); S.runningSince = null; }
    S.phase = 'ended';
    S.endReason = reason;
  }

  function record(entry) {
    S.answers.push(entry);
  }

  function shouldEnd(now) {
    if (S.lives != null && S.lives <= 0) return 'lives';
    if (spec.goalCorrect != null && S.correct >= spec.goalCorrect) return 'goal';
    if (timeUp(now) || (spec.timeLimitMs != null && active(now) >= spec.timeLimitMs)) return 'time';
    if (spec.totalQuestions != null && S.index + 1 >= spec.totalQuestions) return 'done';
    return null;
  }

  function resolve(value, now, { timeout = false } = {}) {
    const q = S.q;
    const ms = timeout ? null : Math.max(0, Math.round(active(now) - S.askedAt));
    const correct = !timeout && checkAnswer(q, value);
    if (correct) { S.correct++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); }
    else { timeout ? S.timeouts++ : S.wrong++; S.streak = 0; if (S.lives != null) S.lives--; }
    const pts = answerPoints({ correct, tier: q.tier, streak: S.streak, ms, parMs: q.parMs, useSpeed: !!spec.useSpeed });
    S.score += pts.total;
    const entry = { i: S.index, op: q.op, topic: q.topic, tier: q.tier, format: q.format, correct, ms, timeout,
      given: timeout ? null : value, answer: q.answer, points: pts.total, sig: q.sig };
    record(entry);
    S.phase = 'feedback';
    const ends = !!shouldEnd(now);
    S.lastResult = { accepted: true, correct, timeout, points: pts, q, entry, endsRound: ends, streak: S.streak, lives: S.lives };
    return S.lastResult;
  }

  const api = {
    spec,
    get state() { return S; },
    get phase() { return S.phase; },
    get question() { return S.q; },
    get index() { return S.index; },

    start(now) {
      if (S.phase !== 'idle') return false;
      S.runningSince = now;
      ask(now);
      return true;
    },

    /** إجابة اللاعب. تعيد {accepted:false} إن لم تُقبل (نقر مكرر، انتهى الوقت…) */
    answer(value, now) {
      if (S.phase !== 'asking') return { accepted: false, reason: S.phase };
      if (timeUp(now)) { finish('time', now); return { accepted: false, reason: 'time' }; }
      const pq = perQ();
      if (pq && active(now) - S.askedAt > pq) {
        const r = resolve(null, now, { timeout: true });
        return { accepted: false, reason: 'question-timeout', result: r };
      }
      return resolve(value, now);
    },

    /** يُستدعى دوريًا من الواجهة. يعيد حدثًا إن حدث شيء. */
    tick(now) {
      if (S.phase === 'asking' || S.phase === 'feedback') {
        if (timeUp(now)) {
          // انتهى الوقت: السؤال المعروض لا يُحتسب خطأً
          finish('time', now);
          return { type: 'ended', reason: 'time' };
        }
      }
      if (S.phase === 'asking') {
        const pq = perQ();
        if (pq && active(now) - S.askedAt > pq) {
          return { type: 'timeout', result: resolve(null, now, { timeout: true }) };
        }
      }
      return null;
    },

    /** الانتقال للسؤال التالي بعد عرض التغذية الراجعة */
    next(now) {
      if (S.phase !== 'feedback') return false;
      const reason = shouldEnd(now);
      if (reason) { finish(reason, now); return 'ended'; }
      ask(now);
      return true;
    },

    pause(now) {
      if (S.phase !== 'asking' && S.phase !== 'feedback') return false;
      S.activeMs = active(now);
      S.runningSince = null;
      S.pausedFrom = S.phase;
      S.phase = 'paused';
      return true;
    },

    resume(now) {
      if (S.phase !== 'paused') return false;
      S.runningSince = now;
      const from = S.pausedFrom;
      S.pausedFrom = null;
      S.interrupted = false;
      if (from === 'feedback') {
        S.phase = 'feedback';
        return api.next(now) === 'ended' ? 'ended' : 'next';
      }
      S.phase = 'asking';
      if (policy === 'swap') {
        S.swaps += 1;
        S.q = spec.source(S.index, ctx());
        S.askedAt = active(now);
        return 'swapped';
      }
      if (policy === 'skip') {
        S.skipped++;
        S.streak = 0;
        record({ i: S.index, op: S.q.op, topic: S.q.topic, tier: S.q.tier, format: S.q.format, correct: false, ms: null,
          timeout: false, skipped: true, given: null, answer: S.q.answer, points: 0, sig: S.q.sig });
        S.phase = 'feedback';
        S.lastResult = { accepted: true, skipped: true, correct: false, q: S.q, points: { total: 0 }, endsRound: !!shouldEnd(now) };
        return 'skipped';
      }
      S.askedAt = active(now) - 0; // 'keep': يبقى السؤال
      return 'kept';
    },

    /** إنهاء الجولة يدويًا (خروج اللاعب أو إنهاء التدريب المفتوح) */
    end(reason, now) { finish(reason || 'quit', now); },

    activeMs: (now) => active(now),
    remainingMs(now) {
      if (spec.timeLimitMs == null) return null;
      return Math.max(0, spec.timeLimitMs - active(now));
    },
    questionRemainingMs(now) {
      const pq = perQ();
      if (!pq || S.phase !== 'asking') return null;
      return Math.max(0, pq - (active(now) - S.askedAt));
    },
    questionLimitMs: () => perQ() || null,

    summary(now = null) {
      const answered = S.answers.filter((a) => !a.skipped);
      const timed = answered.filter((a) => a.ms != null);
      const counted = S.correct + S.wrong + S.timeouts;
      const perOp = {};
      for (const a of answered) {
        const o = (perOp[a.op] ||= { q: 0, c: 0 });
        o.q++; if (a.correct) o.c++;
      }
      return {
        id: S.id, mode: spec.mode,
        score: S.score, correct: S.correct, wrong: S.wrong, timeouts: S.timeouts, skipped: S.skipped,
        answered: counted,
        accuracy: counted ? S.correct / counted : 0,
        avgMs: timed.length ? Math.round(timed.reduce((s, a) => s + a.ms, 0) / timed.length) : null,
        bestStreak: S.bestStreak,
        livesLeft: S.lives,
        activeMs: Math.round(now == null ? S.activeMs : active(now)),
        timeLeftMs: spec.timeLimitMs != null ? Math.max(0, spec.timeLimitMs - (now == null ? S.activeMs : active(now))) : null,
        endReason: S.endReason,
        perOp,
        answers: S.answers.slice(),
      };
    },

    /** صورة قابلة للحفظ لاستئناف الجولة بعد تحديث الصفحة */
    snapshot(now) {
      const st = structuredCloneSafe(S);
      st.activeMs = active(now);
      st.runningSince = null;
      return { v: 1, state: st };
    },
  };
  return api;
}

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}
