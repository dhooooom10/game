/* إعداد الأنماط: تحدي الوقت، البقاء، التدريب الحر، ودروس المنهج. */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { sfx } from '../ui/audio.js';
import { toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import { PRACTICE_TOPICS } from '../core/modes.js';
import { tierPolicy } from '../core/questions.js';
import { tierFromSkill } from '../core/adaptive.js';
import { STAGES, PATHS, lessonKey, pathOpen, lessonUnlocked, findPath } from '../core/curriculum.js';
import { pick } from '../runs.js';
import { CH_MODES, CH_DIFFS, TIME_DURATIONS, CUSTOM_OPS, CUSTOM_LEVELS, CUSTOM_SPEEDS, CUSTOM_DURS, CUSTOM_LIVES, SURVIVAL_LIVES, COMPLETE_MIN_CORRECT,
  BADGE_RULES, badgeEligibility, normalizeChallenge, challengeRecordKey } from '../core/challenge.js';

export const topbar = (title, sub) => h('header.topbar',
  h('button.icon-btn.back', { aria: { label: t('common.back') }, on: { click: () => { sfx.tap(); app.back(); } } }, icon('back')),
  h('h1', title, sub ? h('span.sub', sub) : null));

/** مجموعة أزرار اختيار واحد */
export function seg(options, value, onChange, label) {
  const box = h('div.seg', { role: 'radiogroup', aria: { label } });
  const paint = (v) => [...box.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(v))));
  for (const [v, text] of options) {
    box.appendChild(h('button', { type: 'button', role: 'radio', data: { v: String(v) }, on: { click: () => { sfx.tap(); paint(v); onChange(v); } } }, text));
  }
  paint(value);
  return box;
}
export const field = (label, control, hint) => h('div.field', h('div.label', label), control, hint ? h('div.hint', hint) : null);

/* =========================================================================
   «تحدّيك الخاص»: ثلاثة خيارات واضحة على محرّك واحد (قواعدها في core/challenge.js)
   • تحدّي الوقت  • البقاء  • تخصيص
   ========================================================================= */
const CH_ICON = { time: '⏱️', survival: '❤️', custom: '🎛️' };

/**
 * خانات «تخصيص» (تُستخدم أيضًا في تحدّي الصديق). تمنع الإعدادات المتعارضة:
 * بلا حد زمني + محاولات غير محدودة = جولة لا تنتهي ← لا يُسمح بها.
 */
export function customFields(pref, save) {
  const wrap = h('div.custom-fields');
  const build = () => {
    clear(wrap);
    const opsBox = h('div.chips', { role: 'group', aria: { label: t('cus.ops') } });
    for (const o of CUSTOM_OPS) {
      const b = h('button.chip-toggle', { type: 'button', aria: { pressed: String(pref.ops.includes(o)) } }, t('op.' + o));
      b.addEventListener('click', () => {
        sfx.tap();
        const on = pref.ops.includes(o);
        if (on && pref.ops.length === 1) return toast(t('cus.oneOp'));
        pref.ops = on ? pref.ops.filter((x) => x !== o) : [...pref.ops, o];
        b.setAttribute('aria-pressed', String(!on)); save();
      });
      opsBox.appendChild(b);
    }
    // مدى الأرقام لكل مستوى (السهل = أرقام آحاد ١–٩)
    const rangeHint = h('span', { id: 'rangeHint' }, t('cus.range.' + pref.level));
    const accelSw = h('button.switch', { type: 'button', role: 'switch', aria: { checked: String(!!pref.accel), label: t('cus.accel') } });
    accelSw.addEventListener('click', () => { sfx.tap(); pref.accel = !pref.accel; accelSw.setAttribute('aria-checked', String(pref.accel)); save(); });
    const durLabel = (d) => (d ? t('common.sec', { n: d }) : t('ch.noLimit'));
    const livesLabel = (n) => (n ? t('ch.livesN', { n }) : t('ch.unlimited'));
    const durSeg = seg(CUSTOM_DURS.map((d) => [d, durLabel(d)]), pref.dur, (v) => {
      pref.dur = +v;
      if (!pref.dur && !pref.lives) { pref.lives = 3; toast(t('ch.conflictFixed')); }
      save(); build();
    }, t('ch.duration'));
    const livesSeg = seg(CUSTOM_LIVES.map((n) => [n, livesLabel(n)]), pref.lives, (v) => {
      pref.lives = +v;
      if (!pref.dur && !pref.lives) { pref.dur = 60; toast(t('ch.conflictFixed')); }
      save(); build();
    }, t('ch.lives'));
    // الخيار الذي يصنع جولة بلا نهاية معطّل (بلا مدة + محاولات غير محدودة)
    if (!pref.dur) livesSeg.querySelector('[data-v="0"]')?.setAttribute('disabled', '');
    if (!pref.lives) durSeg.querySelector('[data-v="0"]')?.setAttribute('disabled', '');
    wrap.append(
      field(t('cus.ops'), opsBox),
      field(t('cus.level'), seg(CUSTOM_LEVELS.map((d) => [d, t('diff.' + d)]), pref.level, (v) => { pref.level = v; save(); rangeHint.textContent = t('cus.range.' + v); }, t('cus.level')), rangeHint),
      field(t('cus.speedLabel'), seg(Object.keys(CUSTOM_SPEEDS).map((x) => [x, t('cus.speed.' + x)]), pref.speed, (v) => { pref.speed = v; save(); }, t('cus.speedLabel')), t('ch.speedHint')),
      field(t('ch.duration'), durSeg, t('ch.durationHint')),
      field(t('ch.lives'), livesSeg, t('ch.livesHint')),
      h('div.row', { style: { marginTop: '8px' } }, h('div.grow', h('div.t', t('cus.accel')), h('div.d', t('cus.accelSub'))), accelSw));
  };
  build();
  return [wrap];
}

registerScreen('setupCustom', (app, params = {}) => {
  const data = app.data;
  const P = data.prefs.challenge;
  if (params.preset) { const a = normalizeChallenge(params.preset); P.mode = a.mode; P[a.mode] = a; app.save(); }
  else if (params.mode && P[params.mode]) { P.mode = params.mode; app.save(); }
  const el = h('main', topbar(t('mode.custom'), t('mode.customSub')));
  const tiles = h('div.ch-tiles', { role: 'radiogroup', aria: { label: t('mode.custom') } });
  const body = h('div');
  el.append(tiles, body);

  const paintTiles = () => {
    clear(tiles);
    for (const m of CH_MODES) {
      tiles.append(h('button.ch-tile' + (P.mode === m ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': String(P.mode === m), id: 'ch-' + m,
        on: { click: () => { sfx.tap(); P.mode = m; app.save(); paintTiles(); paint(); } } },
      h('span.ct-ic', CH_ICON[m]), h('span.ct-t', t('ch.' + m)), h('span.ct-d', t('ch.' + m + 'Sub'))));
    }
  };

  function badgeLine(id, a) {
    const why = badgeEligibility(id, a);
    const r = BADGE_RULES[id];
    const rule = id === 'speed20' ? t('ch.rule.speed20', { n: r.minAnswered, acc: Math.round(r.minAccuracy * 100), s: (r.maxAvgMs / 1000).toFixed(1) }) : t('ch.rule.survive25', { n: r.minCorrect });
    const owned = !!data.badges[id];
    return h('div.ch-badge' + (why ? '.no' : '.ok'), h('span', id === 'speed20' ? '⚡' : '🛡️'),
      h('div.grow', h('b', t('badge.' + id)), ' — ', rule, h('div.d', owned ? t('ch.badgeOwned') : why ? t('ch.notEligible.' + why) : t('ch.eligible'))));
  }

  function paint() {
    clear(body);
    const mode = P.mode;
    const a = P[mode];
    const save = () => { Object.assign(a, normalizeChallenge({ ...a, mode })); P[mode] = a; app.save(); paintInfo(); };
    const card = h('section.card');
    if (mode === 'time') {
      card.append(field(t('setup.duration'), seg(TIME_DURATIONS.map((d) => [d, t('common.sec', { n: d })]), a.dur, (v) => { a.dur = +v; save(); }, t('setup.duration'))),
        field(t('setup.difficulty'), seg(CH_DIFFS.map((d) => [d, t('diff.' + d)]), a.diff, (v) => { a.diff = v; save(); }, t('setup.difficulty'))));
    } else if (mode === 'survival') {
      card.append(field(t('setup.difficulty'), seg(CH_DIFFS.map((d) => [d, t('diff.' + d)]), a.diff, (v) => { a.diff = v; save(); }, t('setup.difficulty'))));
    } else {
      card.append(...customFields(a, save));
    }
    const info = h('div');
    const paintInfo = () => {
      const n = normalizeChallenge({ ...a, mode });
      const r = data.records[challengeRecordKey(n)];
      clear(info).append(
        h('p.note.ch-rules', '📜 ', t('ch.rules.' + mode, { s: n.dur || 0, n: n.lives || SURVIVAL_LIVES })),
        h('p.note', t('rain.specials')),
        h('div.ch-rec', h('span.chip.gold', { id: 'chRecord' }, r ? '🏆 ' + t('setup.record', { n: num(r.value) }) : t('setup.noRecord')), h('span.faint', t('ch.recordRule'))),
        h('div.ch-rewards', h('div.label', '🎯 ', t('ch.rewardsTitle')), h('p.note', t('ch.missionRule', { n: COMPLETE_MIN_CORRECT })),
          mode !== 'survival' ? badgeLine('speed20', n) : null, mode !== 'time' ? badgeLine('survive25', n) : null));
    };
    paintInfo();
    body.append(card, info,
      h('details.ch-help', h('summary', '❔ ', t('ch.helpTitle')), h('ul', ...t('ch.help').split('|').map((x) => h('li', x)))),
      h('button.btn.primary.block.lg', { id: 'startChallenge', type: 'button', style: { marginTop: '12px' }, on: { click: () => {
        sfx.tap();
        app.go('rainPlay', { kind: 'custom', args: normalizeChallenge({ ...a, mode }) });
      } } }, icon('play'), t('ch.start', { m: t('ch.' + mode) })));
  }
  paintTiles(); paint();
  // التدريب الحر والدروس (هادئة، بلا إعلانات) — رابط واحد صغير بدل بطاقة في الرئيسية
  el.append(h('button.btn.ghost.block', { id: 'openPractice', type: 'button', style: { marginTop: '14px' }, on: { click: () => { sfx.tap(); app.go('practice'); } } }, '📚 ', t('mode.practice')));
  return { el };
});

/* ---------------- التدريب الحر + دروس المنهج ---------------- */
registerScreen('practice', (app, params) => {
  const data = app.data;
  const pref = data.prefs.practice;
  let tab = params.tab || 'custom';
  const el = h('main', topbar(t('mode.practice'), t('mode.practiceSub')));
  const tabs = seg([['custom', t('pr.custom')], ['lessons', t('pr.lessons')]], tab, (v) => { tab = v; app.stack[app.stack.length - 1].params = { tab: v }; paint(); }, t('mode.practice'));
  const body = h('div', { style: { marginTop: '14px' } });
  el.append(tabs, body);

  function paint() {
    clear(body);
    if (tab === 'lessons') return paintLessons(body);
    // العمليات (اختيار متعدد)
    const topics = h('div.toggles', { role: 'group', aria: { label: t('pr.topics') } });
    for (const tp of PRACTICE_TOPICS) {
      const b = h('button.toggle-chip', { type: 'button', aria: { pressed: String(pref.topics.includes(tp)) }, on: { click: () => {
        sfx.tap();
        const on = pref.topics.includes(tp);
        if (on && pref.topics.length === 1) return toast(t('pr.noTopic'));
        pref.topics = on ? pref.topics.filter((x) => x !== tp) : [...pref.topics, tp];
        b.setAttribute('aria-pressed', String(!on)); app.save(); paintPolicy();
      } } }, t('op.' + tp));
      topics.appendChild(b);
    }
    const levels = [['auto', t('pr.auto')], ...Array.from({ length: 10 }, (_, i) => [i + 1, num(i + 1)])];
    const policy = h('div.note', { style: { marginTop: '4px' } });
    function paintPolicy() {
      clear(policy);
      const lvl = pref.level === 'auto' ? Math.min(...pref.topics.map((x) => tierFromSkill(data.skill[x]))) : +pref.level;
      const P = tierPolicy(lvl);
      policy.append(h('strong', pref.level === 'auto' ? `${t('pr.auto')}: ${pref.topics.map((x) => `${t('op.' + x)} ${num(tierFromSkill(data.skill[x]))}`).join('، ')}` : t('pr.policyTitle', { n: lvl })),
        h('ul', { style: { margin: '6px 0 0', paddingInlineStart: '18px' } },
          h('li', t('pol.add', { a: num(P.addRange[0]), b: num(P.addRange[1]) })),
          h('li', t('pol.mul', { a: num(P.mulFactors[0][1]), b: num(P.mulFactors[1][1]) })),
          h('li', t('pol.div', { a: num(P.divisor[0]), b: num(P.divisor[1]) })),
          h('li', t('pol.neg.' + P.negatives)),
          h('li', t('pol.int')),
          pref.topics.some((x) => ['frac', 'percent'].includes(x)) ? h('li', t('pol.special')) : null));
    }
    paintPolicy();
    const lengthSeg = seg([[10, num(10)], [20, num(20)], ['null', t('pr.endless')]], pref.length == null ? 'null' : pref.length, (v) => { pref.length = v === 'null' ? null : +v; app.save(); }, t('pr.length'));
    const timerSw = h('button.switch', { role: 'switch', aria: { checked: String(!!pref.timer), label: t('pr.timer') }, on: { click: () => { sfx.tap(); pref.timer = !pref.timer; timerSw.setAttribute('aria-checked', String(pref.timer)); app.save(); } } });
    body.append(h('section.card',
      field(t('pr.topics'), topics),
      field(t('pr.level'), seg(levels, pref.level, (v) => { pref.level = v === 'auto' ? 'auto' : +v; app.save(); paintPolicy(); }, t('pr.level')), t('pr.autoSub')),
      policy),
    h('section.card',
      field(t('pr.format'), seg([['mixed', t('fmtName.mixed')], ['input', t('fmtName.input')], ['choice', t('fmtName.choice')], ['missing', t('fmtName.missing')], ['compare', t('fmtName.compare')]], pref.format, (v) => { pref.format = v; app.save(); }, t('pr.format'))),
      field(t('pr.length'), lengthSeg),
      h('div.row', h('div.grow', h('div.t', t('pr.timer'))), timerSw)),
    h('button.btn.primary.block.lg', { id: 'startPractice', style: { marginTop: '14px' }, on: { click: () => {
      sfx.tap();
      app.go('play', { kind: 'practice', args: { opts: { topics: pref.topics.slice(), level: pref.level, format: pref.format, timer: !!pref.timer, length: pref.length } } });
    } } }, icon('play'), t('common.start')));
  }

  function paintLessons(box) {
    let total = 0, got = 0;
    for (const p of PATHS) p.lessons.forEach((_, i) => { total += 3; got += data.lessons.done[lessonKey(p.id, i)] || 0; });
    box.append(h('div.chip.gold', `★ ${num(got)}/${num(total)}`), h('p.note', t('les.rule')));
    for (const st of STAGES) {
      box.appendChild(h('div.stage-head', h('span.si', st.icon), h('div.sn', pick(st.name, data), h('small', pick(st.age, data)))));
      for (const p of st.paths) {
        const idx = PATHS.findIndex((x) => x.id === p.id);
        const open = pathOpen(data.lessons, idx);
        let g = 0, done = 0;
        p.lessons.forEach((_, i) => { const v = data.lessons.done[lessonKey(p.id, i)] || 0; g += v; if (v) done++; });
        const prev = idx > 0 ? PATHS[idx - 1] : null;
        box.appendChild(h('button.list-btn' + (open ? '' : '.locked'), { style: { '--pc': p.color }, 'aria-disabled': open ? null : 'true',
          on: { click: () => { sfx.tap(); if (!open) return toast(t('les.lockedPath', { name: pick(prev.name, data) })); app.go('lessonPath', { pid: p.id }); } } },
        h('span.li', open ? p.icon : '🔒'),
        h('span.lt', h('div.ln', pick(p.name, data)), h('div.ls', open ? `${pick(p.desc, data)} · ${t('les.count', { n: p.lessons.length })}` : t('les.lockedPath', { name: pick(prev.name, data) })),
          h('div.bar', h('i', { style: { width: (done / p.lessons.length) * 100 + '%' } }))),
        h('span.lr', `★ ${num(g)}/${num(p.lessons.length * 3)}`)));
      }
    }
  }
  paint();
  return { el };
});

registerScreen('lessonPath', (app, { pid }) => {
  const data = app.data;
  const p = findPath(pid);
  const el = h('main', topbar(`${p.icon} ${pick(p.name, data)}`, `${pick(p.stage.name, data)} · ${pick(p.desc, data)}`));
  el.appendChild(h('p.note', t('les.rule')));
  const unl = lessonUnlocked(data.lessons, pid);
  p.lessons.forEach((L, i) => {
    const locked = i + 1 > unl;
    const st = data.lessons.done[lessonKey(pid, i)] || 0;
    el.appendChild(h('button.list-btn' + (locked ? '.locked' : ''), { style: { '--pc': p.color }, 'aria-disabled': locked ? 'true' : null,
      on: { click: () => { sfx.tap(); if (locked) return toast(t('les.locked')); app.go('play', { kind: 'lesson', args: { pid, li: i } }); } } },
    h('span.li', locked ? '🔒' : num(i + 1)),
    h('span.lt', h('div.ln', pick(L.n, data)), h('div.ls', pick(L.s, data))),
    h('span.lr', { aria: { label: t('a11y.stars', { n: st }) } }, st ? '★'.repeat(st) + '☆'.repeat(3 - st) : '')));
  });
  return { el };
});
