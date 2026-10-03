/* صفحة «تقدّمي»: مؤشرات حقيقية من لعب هذا الجهاز فقط، مع تعريف واضح لطريقة الحساب. */
import { app, registerScreen } from '../app.js';
import { h, icon, num } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx } from '../ui/audio.js';
import { t, isRtl } from '../i18n.js';
import { metrics, recommendation, STAT_OPS } from '../core/progression.js';
import { DIFFICULTIES, TIME_DURATIONS, timeRecordKey, survivalRecordKey } from '../core/modes.js';

registerScreen('progress', (app) => {
  const data = app.data;
  const m = metrics(data);
  const el = h('main', h('header.topbar', h('h1', t('prog.title'), h('span.sub', t('prog.local')))));
  const pct = (x) => x == null ? '—' : num(Math.round(x * 100)) + (app.settings.digits === 'arabic' ? '٪' : '%');
  const sec = (ms) => ms == null ? '—' : t('common.sec', { n: (ms / 1000).toFixed(1) }).replace('.', app.settings.digits === 'arabic' ? '٫' : '.');

  if (m.empty) {
    el.appendChild(h('section.card.empty-state',
      h('div', { html: mascotSVG({ skin: data.cosmetics.skin, acc: data.cosmetics.acc, mood: 'wow', size: 90, label: t('mascot.name') }) }),
      h('h2', t('prog.empty')), h('p.note', t('prog.emptySub')),
      h('button.btn.primary', { on: { click: () => { sfx.tap(); app.go('home', {}, { root: true }); setTimeout(() => document.getElementById('playNow')?.click(), 50); } } }, icon('play'), t('home.play'))));
    if (data.legacy && data.legacy.games) el.appendChild(h('p.note', t('prog.legacy', { g: num(data.legacy.games), p: num(data.legacy.popped) })));
    el.appendChild(howBox());
    return { el, nav: 'progress' };
  }

  // المؤشرات الرئيسية
  el.appendChild(h('section.kpis',
    kpi(num(m.rounds), t('prog.rounds')), kpi(num(m.questions), t('prog.questions')),
    kpi(pct(m.accuracy), t('prog.accuracy')), kpi(sec(m.avgMs), t('prog.avgTime'))));

  // التوصية
  const rec = recommendation(data);
  const recText = t(rec.key, { n: rec.need, op: rec.op ? t('op.' + rec.op) : '', acc: rec.acc != null ? Math.round(rec.acc * 100) : '', s: rec.ms ? (rec.ms / 1000).toFixed(1) : '' });
  const recCard = h('section.card.section.tip', h('span.ti', icon('sparkle')), h('div', h('div', { style: { fontWeight: 800 } }, t('prog.rec')), h('div.note', recText)));
  if (rec.op) recCard.lastChild.appendChild(h('button.btn.sm.primary', { style: { marginTop: '8px' }, on: { click: () => {
    sfx.tap();
    if (rec.key === 'rec.speed') app.go('setupTime');
    else app.go('play', { kind: 'practice', args: { opts: { topics: [rec.op], level: rec.key === 'rec.levelUp' ? Math.min(10, Math.floor(data.skill[rec.op]?.r || 1) + 1) : 'auto', format: 'mixed', timer: false, length: 10 } } });
  } } }, icon('target'), t('prog.practiceBtn')));
  el.appendChild(recCard);

  // الأداء في كل عملية
  const opsBox = h('section.card.section', h('h2.section-title', t('prog.perOp')));
  for (const op of STAT_OPS) {
    const o = m.perOp[op];
    if (!o || !o.q) continue;
    const lvl = Math.floor(o.rating);
    opsBox.appendChild(h('div.op-row',
      h('span.on', t('op.' + op), h('small', t('prog.levelOf', { n: lvl }))),
      h('div.bar', { role: 'progressbar', aria: { valuenow: lvl, valuemin: 1, valuemax: 10, label: t('prog.levelOf', { n: lvl }) } }, h('i', { style: { width: (o.rating / 10) * 100 + '%' } })),
      h('span.ov', `${t('prog.accuracy')} ${pct(o.acc)} · ${sec(o.avgMs)} · ${num(o.c)}/${num(o.q)}${o.q < 10 ? ' · ' + t('prog.fewData') : ''}`)));
  }
  el.appendChild(opsBox);

  // التطوّر خلال ١٤ يومًا
  el.appendChild(h('section.card.section', h('h2.section-title', t('prog.trend')), chart(m.days),
    h('div.legend', h('span', h('i', { style: { background: 'var(--primary)' } }), t('prog.trendQ')), h('span', h('i', { style: { background: 'var(--accent)' } }), t('prog.trendAcc')))));

  // أفضل نتيجة لكل نمط
  const bests = h('section.card.section', h('h2.section-title', t('prog.bests')));
  const row = (label, value) => bests.appendChild(h('div.row', h('div.grow.t', label), h('span.chip.gold', value)));
  const stars = Object.values(data.journey.stars).reduce((a, b) => a + b, 0);
  row(t('prog.journeyStars'), `★ ${num(stars)}/${num(300)}`);
  for (const d of TIME_DURATIONS) for (const df of DIFFICULTIES) {
    const r = data.records[timeRecordKey(d, df)];
    if (r) row(t('prog.recordTime', { d, diff: t('diff.' + df) }), `${t('prog.correctUnit', { n: num(r.value) })} · ${t('prog.scoreUnit', { n: num(r.score) })}`);
  }
  for (const df of DIFFICULTIES) { const r = data.records[survivalRecordKey(df)]; if (r) row(t('prog.recordSurv', { diff: t('diff.' + df) }), t('prog.correctUnit', { n: num(r.value) })); }
  for (const df of ['easy', 'medium', 'hard', 'expert']) { const r = data.records['rain:' + df]; if (r) row(t('prog.recordRain', { diff: t('diff.' + df) }), t('prog.scoreUnit', { n: num(r.value) })); }
  if (data.daily.best) row(t('prog.recordDaily'), t('prog.scoreUnit', { n: num(data.daily.best) }));
  row(t('prog.bestStreak'), num(m.bestStreak));
  el.appendChild(bests);

  if (data.legacy && data.legacy.games) el.appendChild(h('p.note', t('prog.legacy', { g: num(data.legacy.games), p: num(data.legacy.popped) })));
  el.appendChild(howBox());
  return { el, nav: 'progress' };
});

const kpi = (v, l) => h('div.stat', h('div.v', v), h('div.l', l));

function howBox() {
  return h('details.how.card.section', h('summary', icon('info'), ' ', t('prog.how')), h('ul', ...t('prog.def').split('|').map((x) => h('li', x))));
}

/** رسم بياني بسيط: أعمدة لعدد الأسئلة + خط للدقة */
function chart(days) {
  const W = 340, H = 150, P = { l: 8, r: 8, t: 12, b: 26 };
  const n = days.length, bw = (W - P.l - P.r) / n;
  const maxQ = Math.max(5, ...days.map((d) => d.q));
  const rtl = isRtl();
  const x = (i) => P.l + (rtl ? (n - 1 - i) : i) * bw;
  const yQ = (q) => H - P.b - (q / maxQ) * (H - P.t - P.b);
  const yA = (a) => H - P.b - a * (H - P.t - P.b);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  const summary = days.filter((d) => d.q).map((d) => `${d.date}: ${d.q} / ${d.acc != null ? Math.round(d.acc * 100) + '%' : '-'}`).join('; ');
  svg.setAttribute('aria-label', `${t('prog.trend')}. ${summary || t('prog.noPlayDay')}`);
  const add = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; svg.appendChild(e); return e; };
  add('line', { x1: P.l, x2: W - P.r, y1: H - P.b, y2: H - P.b, class: 'grid' });
  add('line', { x1: P.l, x2: W - P.r, y1: yA(1), y2: yA(1), class: 'grid', 'stroke-dasharray': '3 4' });
  days.forEach((d, i) => {
    if (d.q) add('rect', { x: x(i) + bw * 0.18, y: yQ(d.q), width: bw * 0.64, height: H - P.b - yQ(d.q), rx: 3, class: 'bar-q' + (i === n - 1 ? ' today' : '') });
    if (i % 2 === (n - 1) % 2) add('text', { x: x(i) + bw / 2, y: H - 8, 'text-anchor': 'middle' }, i === n - 1 ? t('prog.today') : num(+d.date.slice(8)));
  });
  const pts = days.map((d, i) => d.acc != null ? [x(i) + bw / 2, yA(d.acc)] : null).filter(Boolean);
  if (pts.length > 1) add('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'acc-line' });
  pts.forEach(([px, py]) => add('circle', { cx: px, cy: py, r: 3.2, class: 'acc-dot' }));
  return svg;
}
