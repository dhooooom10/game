/* إعداد الأنماط: تحدي الوقت، البقاء، التدريب الحر، ودروس المنهج. */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { sfx } from '../ui/audio.js';
import { toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import { TIME_DURATIONS, DIFFICULTIES, timeRecordKey, survivalRecordKey, PRACTICE_TOPICS, survivalPerQuestionMs } from '../core/modes.js';
import { tierPolicy } from '../core/questions.js';
import { tierFromSkill } from '../core/adaptive.js';
import { STAGES, PATHS, lessonKey, pathOpen, lessonUnlocked, findPath } from '../core/curriculum.js';
import { pick } from '../runs.js';

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

/* ---------------- تحدي الوقت ---------------- */
registerScreen('setupTime', (app) => {
  const pref = app.data.prefs.time;
  const el = h('main', topbar(t('mode.time'), t('mode.timeSub')));
  const recBox = h('div.chip.gold');
  const paintRec = () => {
    const r = app.data.records[timeRecordKey(pref.dur, pref.diff)];
    recBox.textContent = r ? '🏆 ' + t('setup.record', { n: num(r.value) }) + ' · ' + t('prog.scoreUnit', { n: num(r.score) }) : t('setup.noRecord');
  };
  el.append(h('section.card',
    field(t('setup.duration'), seg(TIME_DURATIONS.map((d) => [d, t('common.sec', { n: d })]), pref.dur, (v) => { pref.dur = +v; app.save(); paintRec(); }, t('setup.duration'))),
    field(t('setup.difficulty'), seg(DIFFICULTIES.map((d) => [d, t('diff.' + d)]), pref.diff, (v) => { pref.diff = v; app.save(); paintRec(); }, t('setup.difficulty'))),
    recBox),
  h('p.note', { style: { marginTop: '12px' } }, t('setup.timeRules')),
  h('p.note', t('setup.pauseRule')),
  h('button.btn.primary.block.lg', { id: 'startTime', style: { marginTop: '10px' }, on: { click: () => { sfx.tap(); app.go('play', { kind: 'time', args: { dur: pref.dur, diff: pref.diff } }); } } }, icon('play'), t('common.start')));
  paintRec();
  return { el };
});

/* ---------------- البقاء ---------------- */
registerScreen('setupSurvival', (app) => {
  const pref = app.data.prefs.survival;
  const el = h('main', topbar(t('mode.survival'), t('mode.survivalSub')));
  const recBox = h('div.chip.gold');
  const rules = h('p.note');
  const paint = () => {
    const r = app.data.records[survivalRecordKey(pref.diff)];
    recBox.textContent = r ? '🏆 ' + t('setup.record', { n: num(r.value) }) : t('setup.noRecord');
    rules.textContent = t('setup.survRules', { s: survivalPerQuestionMs(pref.diff, 0) / 1000 });
  };
  el.append(h('section.card',
    field(t('setup.difficulty'), seg(DIFFICULTIES.map((d) => [d, t('diff.' + d)]), pref.diff, (v) => { pref.diff = v; app.save(); paint(); }, t('setup.difficulty'))),
    recBox),
  h('div', { style: { marginTop: '12px' } }, rules),
  h('p.note', t('setup.pauseRule')),
  h('button.btn.primary.block.lg', { id: 'startSurvival', style: { marginTop: '10px' }, on: { click: () => { sfx.tap(); app.go('play', { kind: 'survival', args: { diff: pref.diff } }); } } }, icon('play'), t('common.start')));
  paint();
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
