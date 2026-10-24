/* =========================================================================
   الأصدقاء — كل شيء بلا خادم:
   • تحدٍّ برمز: العب جولة ← شارك رمزها في واتساب ← صديقك يلعب نفس القطرات بالضبط
     ← يرد عليك برمز نتيجته ← تعرف من فاز. (core/social.js)
   • غرفة على نفس الجوال: ٢–٦ لاعبين بالتناوب على نفس القطرات، مع شبح من سبقك.
   • وجهًا لوجه: شاشة مقسومة (screens/friend.js).
   • Google Play Games: لوحات الصدارة والإنجازات (في تطبيق Android).
   ========================================================================= */
import { registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, buzz } from '../ui/audio.js';
import { toast, confetti } from '../ui/fx.js';
import { t } from '../i18n.js';
import { shareText, shareUrl } from '../ui/share.js';
import * as pgs from '../net/playgames.js';
import { topbar, seg, customFields } from './setup.js';
import { TOTAL_LEVELS } from '../core/modes.js';
import { normalizeChallenge } from '../core/challenge.js';
import { randomSeed } from '../core/rng.js';
import { commitRound } from '../core/progression.js';
import { challengeLabel } from '../runs.js';
import { decodeCode, ensureSocial, addReceived, applyResult, friendsRecord, outcome, makeChallengeCode } from '../core/social.js';

const COLORS = ['#38D6F5', '#FF7BB0', '#FFC94A', '#7CE38B', '#B78CFF', '#FF9F5A'];
const RES_IC = { win: '🏆', lose: '💧', draw: '🤝' };

/** وصف قصير للتحدي (مرحلة أو إعدادات مخصصة) */
export const codeLabel = (kind, args) => (kind === 'level'
  ? (args.turbo ? '⚡ ' : '') + t('jr.levelN', { n: num(args.level) })
  : challengeLabel(normalizeChallenge(args)));

/** نص المشاركة: سطر دعوة + الرمز + رابط التحميل */
export function shareCode(text, code) {
  return shareText(`${text}\n${code}\n${t('code.howTo')}`, shareUrl());
}

/** بطاقة رمز قابلة للنسخ والمشاركة */
export function codeCard({ title, text, code, id }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast(t('share.copied')); } catch { toast(t('share.failed')); }
  };
  return h('section.card.code-card', { id },
    h('div.t', title),
    h('div.code-box', { dir: 'ltr', 'data-code': code }, code),
    h('div.btn-row',
      h('button.btn.gold.grow', { type: 'button', 'data-share': '1', on: { click: () => { sfx.tap(); shareCode(text, code); } } }, icon('upload'), t('code.share')),
      h('button.btn', { type: 'button', on: { click: () => { sfx.tap(); copy(); } } }, t('code.copy'))));
}

/* =========================================================================
   مركز الأصدقاء
   ========================================================================= */
registerScreen('friends', (app, params) => {
  const data = app.data;
  const s = ensureSocial(data);
  const el = h('main', topbar(t('fr2.title'), t('fr2.sub')));

  // ١) طريقتان فقط للعب مع أصدقائك
  el.append(h('section.fr2-actions',
    action('friendCompose', '⚔️', t('fr2.challenge'), t('fr2.challengeSub'), 'gold'),
    action('party', '👥', t('party.title'), t('party.sub'))));

  // ٢) إدخال رمز وصلك
  const input = h('input.input.code-in', { id: 'codeIn', dir: 'auto', placeholder: t('code.enter'), aria: { label: t('code.enter') }, on: { keydown: (e) => { if (e.key === 'Enter') open(); } } });
  const out = h('div', { id: 'codeOut' });
  const pasteBtn = navigator.clipboard?.readText ? h('button.btn', { type: 'button', on: { click: async () => {
    try { input.value = await navigator.clipboard.readText(); open(); } catch { toast(t('code.pasteFail')); }
  } } }, t('code.paste')) : null;
  el.append(h('section.section.code-entry',
    h('div.btn-row', input, h('button.btn.primary', { id: 'openCode', type: 'button', on: { click: () => { sfx.tap(); open(); } } }, t('code.open')), pasteBtn),
    out));

  const lists = h('div'); el.append(lists);

  function open(text = input.value) {
    clear(out);
    let c;
    try { c = decodeCode(text); } catch { sfx.wrong(); out.append(h('p.note.bad', t('code.bad'))); return; }
    if (c.type === 'challenge') {
      const r = addReceived(data, c); app.save();
      if (r.own) { out.append(h('p.note', t('code.own'))); return; }
      const ch = r.challenge;
      out.append(h('div.ch-card.pending', { id: 'codeChallenge' },
        h('span.ch-ic', c.kind === 'level' ? '🗺️' : '⚔️'),
        h('div.grow', h('div.t', t('code.fromX', { name: ch.friendName || '?' })),
          h('div.d', codeLabel(ch.kind, ch.args), ' · ', t('code.beat', { n: num(ch.theirs) }))),
        h('button.btn.gold.sm', { id: 'playCode', type: 'button', on: { click: () => playReceived(ch) } }, icon('play'), t('code.play'))));
    } else {
      const r = applyResult(data, c);
      if (!r.ok) { out.append(h('p.note.bad', t('code.unknown'))); return; }
      app.save();
      const o = r.outcome;
      if (o === 'win') { sfx.fanfare(); confetti({ count: 60 }); } else if (o === 'lose') sfx.lose(); else sfx.win();
      out.append(h('div.ch-card.' + o, { id: 'codeResult', 'data-outcome': o },
        h('span.ch-ic', RES_IC[o]),
        h('div.grow', h('div.t', t('code.res.' + o, { name: c.name || '?' })),
          h('div.d', codeLabel(r.challenge.kind, r.challenge.args), ' · ', num(r.challenge.mine), ' – ', num(c.score)))));
    }
    input.value = '';
    paintLists();
  }

  function paintLists() {
    clear(lists);
    const recv = s.list.filter((c) => c.dir === 'recv').reverse();
    const sent = s.list.filter((c) => c.dir === 'sent').reverse();

    // تحديات وصلتني
    if (recv.length) {
      const pend = recv.filter((c) => c.mine == null);
      const sec = h('section.section', h('h2.section-title', '⚔️ ', t('code.received'), pend.length ? h('span.badge-count', num(pend.length)) : null));
      for (const c of recv.slice(0, 5)) {
        const o = outcome(c.mine, c.theirs);
        sec.append(h('div.ch-card' + (o ? '.' + o : '.pending'),
          h('span.ch-ic', o ? RES_IC[o] : c.kind === 'level' ? '🗺️' : '⚔️'),
          h('div.grow', h('div.t', t('code.fromX', { name: c.friendName || '?' })),
            h('div.d', codeLabel(c.kind, c.args), ' · ', o ? `${num(c.mine)} – ${num(c.theirs)}` : t('code.beat', { n: num(c.theirs) }))),
          h('button.btn.sm' + (o ? '' : '.gold'), { type: 'button', on: { click: () => playReceived(c) } }, icon(o ? 'refresh' : 'play'), o ? t('code.again') : t('code.play'))));
      }
      lists.append(sec);
    }

    // تحدياتي المرسلة: الردود ونتيجتي، وإعادة مشاركة الرمز
    if (sent.length) {
      const sec = h('section.section', h('h2.section-title', '📤 ', t('code.sent')));
      for (const c of sent.slice(0, 5)) {
        const reps = (c.replies || []).map((r) => {
          const o = outcome(c.mine, r.score);
          return h('span.chip' + (o === 'win' ? '.ok' : ''), RES_IC[o], ' ', r.name || '?', ' ', num(r.score));
        });
        sec.append(h('div.ch-card',
          h('span.ch-ic', reps.length ? '🏁' : '⏳'),
          h('div.grow', h('div.t', codeLabel(c.kind, c.args), ' · ', t('code.yourScore', { n: num(c.mine) })),
            h('div.d', reps.length ? h('span.chips', ...reps) : t('code.waiting'))),
          h('button.btn.sm', { type: 'button', aria: { label: t('code.share') }, on: { click: () => {
            sfx.tap();
            const code = makeChallengeCode({ uid: s.uid, name: app.playerName, kind: c.kind, args: c.args, seed: c.seed, score: c.mine, popped: c.minePopped });
            shareCode(t('code.inviteText', { n: num(c.mine), label: codeLabel(c.kind, c.args) }), code);
          } } }, icon('upload'))));
      }
      lists.append(sec);
    }

    // الحصيلة مع كل صديق
    const rec = friendsRecord(data);
    if (!rec.length && !recv.length && !sent.length) { lists.append(h('p.note.center', t('fr2.empty'))); }
    const fr = h('section.section', h('h2.section-title', '🤝 ', t('fr2.record'), h('small', num(rec.length))));
    for (const f of rec) fr.append(h('div.friend-row', { 'data-friend': f.uid },
      h('span.ch-ic', '🙂'), h('div.grow', h('div.t', f.name || '?'), h('div.d', t('fr2.wld', { w: num(f.w), l: num(f.l), d: num(f.d) }))),
      h('span.chip' + (f.w > f.l ? '.ok' : ''), f.w > f.l ? '👑' : f.w < f.l ? '💪' : '🤝')));
    if (rec.length) lists.append(fr);

    // Google Play Games: لوحات صدارة عالمية وبين الأصدقاء، وإنجازات (بلا خادم)
    if (pgs.available()) {
      const row = h('div.btn-row');
      if (pgs.hasLeaderboards()) row.append(h('button.btn.ghost.grow', { type: 'button', on: { click: async () => { if (await pgs.signIn({ interactive: true })) pgs.showLeaderboards(); } } }, '📈 ', t('pgs.lb')));
      if (pgs.hasAchievements()) row.append(h('button.btn.ghost.grow', { type: 'button', on: { click: async () => { if (await pgs.signIn({ interactive: true })) pgs.showAchievements(); } } }, '🏅 ', t('pgs.ach')));
      if (row.children.length) lists.append(h('section.section', row));
    }
  }

  function playReceived(c) {
    sfx.tap();
    app.go('rainPlay', { kind: c.kind === 'level' ? 'levelDuel' : 'custom', seed: c.seed,
      args: { ...c.args, answer: { id: c.id, from: c.friendName || '?', score: c.theirs } } });
  }

  function action(to, ic, title, sub, cls = '') {
    return h('button.fr2-act' + (cls ? '.' + cls : ''), { type: 'button', 'data-go': to, on: { click: () => { sfx.tap(); app.go(to); } } },
      h('span.ic', ic), h('span.grow', h('b', title), h('small', sub)));
  }

  paintLists();
  return { el, nav: 'friends', afterMount: () => { if (params.code) { input.value = params.code; open(params.code); params.code = null; } } };
});

/* =========================================================================
   تحدٍّ جديد: تخصيص (نفس خانات «تحدّيك الخاص») أو مرحلة من الرحلة.
   تلعب أولًا، ثم تحصل على رمز تشاركه.
   ========================================================================= */
registerScreen('friendCompose', (app) => {
  const data = app.data;
  const fc = (data.prefs.friendChallenge ||= {});
  const pref = Object.assign(fc, normalizeChallenge({ mode: 'custom', ...fc }), { tab: fc.tab === 'level' ? 'level' : 'custom', jlevel: fc.jlevel || 1 });
  const el = h('main', topbar(t('fr2.challenge'), t('fr2.composeSub')));
  const body = h('div', { style: { marginTop: '12px' } });
  el.append(seg([['custom', '⚔️ ' + t('fr2.tabCustom')], ['level', '🗺️ ' + t('fr2.tabLevel')]], pref.tab, (v) => { pref.tab = v; app.save(); paint(); }, t('fr2.composeSub')), body);
  function paint() {
    clear(body);
    if (pref.tab === 'custom') {
      body.append(h('section.card', ...customFields(pref, () => app.save())),
        h('p.note', t('fr2.how')),
        h('button.btn.gold.block.lg', { id: 'startCompose', type: 'button', on: { click: () => {
          sfx.tap();
          app.go('rainPlay', { kind: 'custom', seed: randomSeed(), args: { ...normalizeChallenge({ ...pref, mode: 'custom' }), makeCode: true } });
        } } }, icon('play'), t('fr2.playFirst')));
    } else {
      const max = Math.min(TOTAL_LEVELS, data.journey.unlocked);
      if (pref.jlevel > max) pref.jlevel = max;
      const grid = h('div.level-pick', { role: 'radiogroup', aria: { label: t('fr2.tabLevel') } });
      for (let L = 1; L <= max; L++) {
        const st = data.journey.stars[L] || 0;
        grid.append(h('button.lp' + (L === pref.jlevel ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': String(L === pref.jlevel), 'data-level': L, on: { click: () => { sfx.tap(); pref.jlevel = L; app.save(); paint(); } } },
          num(L), st ? h('small', '★'.repeat(st)) : null));
      }
      body.append(h('section.card', h('div.label', t('fr2.pickLevel')), grid),
        h('p.note', t('fr2.how')),
        h('button.btn.gold.block.lg', { id: 'startCompose', type: 'button', on: { click: () => {
          sfx.tap();
          app.go('rainPlay', { kind: 'journey', seed: randomSeed(), args: { level: pref.jlevel, makeCode: true } });
        } } }, icon('play'), t('fr2.playFirst')));
    }
  }
  paint();
  return { el };
});

/* =========================================================================
   غرفة على نفس الجوال: ٢–٦ لاعبين بالتناوب على نفس القطرات
   ========================================================================= */
registerScreen('party', (app) => {
  const data = app.data;
  const pp = (data.prefs.party ||= {});
  const pref = Object.assign(pp, normalizeChallenge({ mode: 'custom', ops: ['add', 'sub'], level: 'easy', speed: 'normal', dur: 60, lives: 0, ...pp }));
  pref.names = Array.isArray(pp.names) && pp.names.length >= 2 ? pp.names.slice(0, 6) : ['', ''];
  const el = h('main', topbar(t('party.title'), t('party.sub')));
  const namesBox = h('div.party-names');
  const paintNames = () => {
    clear(namesBox);
    pref.names.forEach((n, i) => namesBox.append(h('div.party-name',
      h('span.dot', { style: { background: COLORS[i] } }),
      h('input.input', { maxlength: 12, value: n, placeholder: t('party.pN', { n: num(i + 1) }), aria: { label: t('party.pN', { n: num(i + 1) }) },
        on: { change: (e) => { pref.names[i] = e.target.value.trim().slice(0, 12); app.save(); } } }),
      pref.names.length > 2 ? h('button.icon-btn', { type: 'button', aria: { label: t('party.remove') }, on: { click: () => { sfx.tap(); pref.names.splice(i, 1); app.save(); paintNames(); } } }, icon('close')) : null)));
    if (pref.names.length < 6) namesBox.append(h('button.btn.ghost.block', { id: 'addPlayer', type: 'button', on: { click: () => { sfx.tap(); pref.names.push(''); app.save(); paintNames(); } } }, icon('plus'), t('party.add')));
  };
  paintNames();
  el.append(h('section.card', h('h2.section-title', '👥 ', t('party.players')), namesBox),
    h('section.card', h('h2.section-title', '🎛️ ', t('party.rules')), ...customFields(pref, () => app.save())),
    h('p.note', t('party.how')),
    h('button.btn.primary.block.lg', { id: 'startParty', type: 'button', on: { click: () => {
      sfx.tap();
      const names = pref.names.map((n, i) => n || t('party.pN', { n: num(i + 1) }));
      const party = { id: Date.now().toString(36), seed: randomSeed(), args: normalizeChallenge({ ...pref, mode: 'custom' }), names, results: [] };
      app.go('partyTurn', { party }, { replace: false });
    } } }, icon('play'), t('common.start')));
  return { el };
});

/** بين الأدوار: يسجّل نتيجة اللاعب السابق، ثم يسلّم الجوال للتالي أو يعرض الترتيب */
registerScreen('partyTurn', (app, params) => {
  const { party } = params;
  if (params.result) { party.results.push(params.result); params.result = null; }
  const n = party.results.length;
  if (n >= party.names.length) return partyEnd(app, party);
  const best = party.results.reduce((m, r) => Math.max(m, r.score), 0);
  const el = h('main.handoff',
    h('div', { html: mascotSVG({ skin: 'sky', acc: 'none', mood: 'happy', size: 90, label: t('mascot.name') }) }),
    n ? h('p.note', t('party.prev', { name: party.names[n - 1], n: num(party.results[n - 1].score) })) : null,
    h('p.note', t('fr.handTo', { name: party.names[n] })),
    h('div.big', { id: 'partyWho', style: { color: COLORS[n] } }, t('fr.turnOf', { name: party.names[n] })),
    best ? h('p.chip.gold', t('fr.scoreToBeat', { n: num(best) })) : null,
    h('p.note', challengeLabel(party.args), ' · ', t('party.turnN', { a: num(n + 1), b: num(party.names.length) })),
    h('button.btn.primary.block.lg', { id: 'partyReady', 'data-autofocus': true, style: { marginTop: '18px' }, on: { click: () => {
      sfx.tap();
      const ghosts = party.results.map((r, i) => ({ id: 'p' + i, name: party.names[i], color: COLORS[i], timeline: r.timeline.length ? r.timeline : [[0, 0]] }));
      app.go('rainPlay', { kind: 'custom', args: party.args, seed: party.seed, party, rivals: { ghosts } }, { replace: true });
    } } }, icon('play'), t('fr.ready')),
    h('button.btn.ghost.block', { on: { click: async () => {
      sfx.tap();
      if (await app.confirm({ title: t('party.endTitle'), body: t('party.endBody'), danger: true })) app.go('friends', {}, { replace: true });
    } } }, t('party.end')));
  return { el };
});

function partyEnd(app, party) {
  const rows = party.results.map((r, i) => ({ ...r, name: party.names[i], i })).sort((a, b) => b.score - a.score || b.popped - a.popped);
  const top = rows[0];
  const tie = rows.length > 1 && rows[1].score === top.score && rows[1].popped === top.popped;
  if (!party.committed) {
    party.committed = true;
    commitRound(app.data, { id: 'party-' + party.id, mode: 'friend', score: 0, correct: 0, answered: 0, bestStreak: 0, perOp: {} });
    app.save();
  }
  const medal = ['🥇', '🥈', '🥉'];
  const el = h('main',
    h('section.result-hero',
      h('div', { html: mascotSVG({ skin: app.data.cosmetics.skin, acc: app.data.cosmetics.acc, mood: 'cheer', size: 90, label: t('mascot.name') }) }),
      h('h1', { id: 'partyWinner', 'data-autofocus': true }, tie ? t('res.draw') : t('res.winner', { name: top.name }))),
    h('section.card.party-board', ...rows.map((r, k) => h('div.race-row' + (k === 0 ? '.me' : ''),
      h('b.rk', medal[k] || num(k + 1)), h('span.dot', { style: { background: COLORS[r.i] } }), h('span.grow', r.name),
      h('span.chip.gold', num(r.score)), h('span.faint', '💧 ' + num(r.popped))))),
    h('p.note', { style: { textAlign: 'center' } }, t('party.tiebreak')),
    h('div.stack', { style: { marginTop: '18px' } },
      h('button.btn.primary.block.lg', { id: 'partyAgain', on: { click: () => {
        sfx.tap();
        app.go('partyTurn', { party: { ...party, id: Date.now().toString(36), seed: randomSeed(), results: [], committed: false } }, { replace: true });
      } } }, icon('refresh'), t('party.again')),
      h('button.btn.ghost.block', { on: { click: () => { sfx.tap(); app.go('friends', {}, { replace: true }); } } }, '👥 ', t('fr2.title')),
      h('button.btn.ghost.block', { on: { click: () => { sfx.tap(); app.go('home', {}, { root: true }); } } }, icon('home'), t('res.home'))));
  return { el, afterMount: () => { sfx.fanfare(); buzz([20, 60, 20]); confetti(); } };
}
