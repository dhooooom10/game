/* =========================================================================
   الأونلاين: المركز، المباراة السريعة، الغرف، البطولات، لوحات الصدارة،
   الأصدقاء، تحدي الرابط، والنتائج. التفاعل الاجتماعي آمن للأطفال:
   رموز تعبيرية محددة مسبقًا فقط، بلا دردشة نصية مفتوحة.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, buzz } from '../ui/audio.js';
import { toast, confetti, reducedMotion } from '../ui/fx.js';
import { t, locale } from '../i18n.js';
import { commitRound } from '../core/progression.js';
import * as pgs from '../net/playgames.js';
import * as net from '../net/online.js';
import { shareText, shareUrl } from '../ui/share.js';
import { COUNTRIES, flag, countryName, detectCountry } from '../core/country.js';
import { topbar, seg, field } from './setup.js';

const EMOTES = ['👏', '🔥', '😮', '😂', '💪', '🎉', '👋', '❤️'];
const L = (o, k) => (locale().lang === 'ar' ? o[k + '_ar'] : (o[k + '_en'] || o[k + '_ar']));
const errText = (e) => t('net.err.' + (e?.code || 'offline')) === 'net.err.' + (e?.code || 'offline') ? t('net.err.generic') : t('net.err.' + e.code);
const drop = (skin, size = 28) => h('span.lb-av', { html: mascotSVG({ skin: skin || 'sky', size, label: '' }) });
/** مدة مقروءة بصيغ الجمع العربية الصحيحة */
const arCount = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : `${n} ${n >= 3 && n <= 10 ? few : many}`;
const fmtDur = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.max(1, Math.floor((s % 3600) / 60));
  if (locale().lang === 'ar') {
    const txt = d ? arCount(d, 'يوم واحد', 'يومان', 'أيام', 'يومًا') + (hh ? '، ' + arCount(hh, 'ساعة', 'ساعتان', 'ساعات', 'ساعة') : '')
      : hh ? arCount(hh, 'ساعة', 'ساعتان', 'ساعات', 'ساعة') : arCount(m, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة');
    return num(txt);
  }
  return d ? t('net.dur.dh', { d, h: hh }) : hh ? t('net.dur.hm', { h: hh, m }) : t('net.dur.m', { m });
};

/** شاشة «تحميل/غير متصل» قياسية */
function offlineCard(e, retry) {
  return h('section.card.empty-state',
    h('div', { html: mascotSVG({ skin: app.data.cosmetics.skin, mood: 'sad', size: 80, label: '' }) }),
    h('h2', t('net.offlineTitle')), h('p.note', errText(e)), h('p.note', t('net.offlineHint')),
    h('button.btn.primary', { on: { click: retry } }, icon('refresh'), t('net.retry')));
}
async function guard(box, fn) {
  clear(box).append(h('div.loading', h('span.spinner'), t('net.loading')));
  try { await net.ensureIdentity(app); net.connect(); await fn(); }
  catch (e) { clear(box).append(offlineCard(e, () => guard(box, fn))); }
}

/* ---------------- تشغيل جولة أونلاين على شاشة المطر ---------------- */
export function playOnline({ cfg, seed, label, kind, runId = null, matchId = null, startAt = null, players = [], ghosts = [], extra = {} }) {
  const myId = net.me()?.id;
  const opponents = players.filter((p) => p.id !== myId);
  const online = {
    cfg, seed, startAt, now: net.serverNow, opponents, ghosts: ghosts.length ? ghosts : null,
    meta: { label, realtime: true, stats: true, persist: false },
    report(p) { if (matchId) net.send({ t: 'progress', id: matchId, ...p }); },
    finish(res) {
      off();
      if (matchId) {
        net.send({ t: 'finish', id: matchId, log: res.log, endTick: res.endTick });
        app.go('onlineResult', { kind, matchId, runId, local: res.summary, players, extra }, { replace: true });
      } else {
        app.go('onlineResult', { kind, runId, local: res.summary, submit: { log: res.log, endTick: res.endTick }, extra }, { replace: true });
      }
    },
  };
  const off = net.on((m) => {
    if (m.t === 'progress' && m.id === matchId) online.onProgress?.(m.pid, m.name, m.score, !!m.done, m.color);
    if (m.t === 'emote') showEmote(m);
  });
  app.go('rainPlay', { online }, { replace: !!extra.replace });
}

function showEmote(m) {
  const el = h('div.emote-pop', { aria: { live: 'polite' } }, h('span.e', m.e), h('span.n', m.name));
  document.body.appendChild(el);
  setTimeout(() => el.remove(), reducedMotion() ? 1200 : 2200);
}
function emoteBar() {
  return h('div.emote-bar', { role: 'group', aria: { label: t('net.emotes') } },
    ...EMOTES.map((e) => h('button', { type: 'button', aria: { label: e }, on: { click: () => { sfx.tap(); buzz(8); net.send({ t: 'emote', e }); } } }, e)));
}

/* =========================================================================
   المركز
   ========================================================================= */
registerScreen('online', (app) => {
  const el = h('main', h('header.topbar', h('h1', t('online.title'), h('span.sub', t('online.sub')))));
  const box = h('div'); el.append(box);
  guard(box, async () => {
    const [cfg, meRes] = await Promise.all([net.loadConfig(), net.api('GET', '/api/me')]);
    net.api('POST', '/api/me/skin', { skin: app.data.cosmetics.skin }).catch(() => {});
    clear(box);
    const id = net.me();
    // بطاقة اللاعب
    const nameEl = h('span', meRes.player.name);
    box.append(h('section.card.online-me',
      drop(app.data.cosmetics.skin, 40),
      h('div.grow', h('div.t', nameEl), h('div.d', `${t('net.season')}: ${L(cfg.season, 'name')} · ${t('net.rating')} ${num(meRes.rating.rating)}`),
        h('div.d', t('net.myCode'), ' ', h('b.code', { dir: 'ltr' }, id.code))),
      h('button.icon-btn', { aria: { label: t('net.rename') }, on: { click: () => rename(nameEl) } }, icon('user'))));
    // الإعلانات والمناسبة
    for (const a of cfg.announcements) box.append(h('div.announce', '📢 ', L(a, 'text')));
    for (const ev of cfg.events) box.append(eventCard(ev));
    // الأزرار
    box.append(h('div.mode-grid.section',
      bigBtn('qmBtn', '⚡', '#38D6F5', t('net.quick'), t('net.quickSub'), () => app.go('matchmaking'), true),
      bigBtn('roomBtn', '🔑', '#9B8CFF', t('net.rooms'), t('net.roomsSub'), () => app.go('rooms')),
      bigBtn('tourBtn', '🏆', '#FFC94A', t('net.tournaments'), t('net.tournamentsSub'), () => app.go('tournaments')),
      bigBtn('weeklyBtn', '🌧️', '#3DDC97', t('net.weekly'), t('net.weeklySub'), () => startWeekly()),
      bigBtn('lbBtn', '📊', '#FF9F5A', t('net.leaderboards'), t('net.leaderboardsSub'), () => app.go('leaderboards')),
      bigBtn('friendsBtn', '🤝', '#FF7BB0', t('net.friends'), t('net.friendsSub'), () => app.go('friends')),
      bigBtn('nationsBtn', '🌍', '#5AD1A0', t('nat.title'), t('nat.sub'), () => app.go('nations')),
      bigBtn('clubsBtn', '🏫', '#38D6F5', t('club.title'), t('club.sub'), () => app.go('clubs'))));
    if (pgs.available() && pgs.signedIn()) {
      const row = h('div.row-btns.section');
      if (pgs.hasAchievements()) row.append(h('button.btn.ghost', { type: 'button', on: { click: () => pgs.showAchievements() } }, '🏅 ' + t('net.pgsAch')));
      if (pgs.hasLeaderboards()) row.append(h('button.btn.ghost', { type: 'button', on: { click: () => pgs.showLeaderboards() } }, '📈 ' + t('net.pgsLb')));
      if (app.data.online?.pgs) box.append(h('p.note', t('net.pgsLinked')));
      if (row.children.length) box.append(row);
    }
    if (meRes.rewards.length) {
      box.append(h('section.card.section', h('h2.section-title', '🏅 ' + t('net.myRewards')),
        ...meRes.rewards.map((r) => h('div.row', h('span', { style: { fontSize: '1.6rem' } }, r.icon), h('div.grow', h('div.t', L(r, 'label')), h('div.d', t('net.rank', { n: r.rank })))))));
    }
    box.append(h('p.note', t('net.safety')),
      h('p', { style: { textAlign: 'center' } }, h('a.link', { href: './privacy.html', target: '_blank', rel: 'noopener' }, t('net.privacy')), ' · ',
        h('button.link', { id: 'deleteAccount', on: { click: async () => {
          if (!(await app.confirm({ title: t('net.deleteTitle'), body: t('net.deleteBody'), ok: t('prof.delete'), danger: true }))) return;
          try { await net.api('DELETE', '/api/me'); net.disconnect(); delete app.data.online; app.save(); net.useIdentity(app.data); toast(t('net.deleted')); app.go('home', {}, { root: true }); }
          catch (e) { toast(errText(e)); }
        } } }, t('net.deleteAccount'))));
  });
  return { el, nav: 'online' };
});

const bigBtn = (id, emoji, color, title, sub, fn, wide = false) => h('button.mode-card' + (wide ? '.wide' : ''), { id, style: { '--mc': color }, on: { click: () => { sfx.tap(); fn(); } } },
  h('span.mi', { style: { fontSize: '1.5rem' } }, emoji), h('div', { style: { flex: wide ? '1' : null } }, h('div.mn', title), h('div.md', sub)));

export function eventCard(ev) {
  const live = ev.status === 'active';
  return h('button.event-card', { style: { '--ec': ev.color }, on: { click: () => { sfx.tap(); app.go('tournament', { id: ev.id }); } } },
    h('span.ei', ev.icon), h('div.grow', h('div.en', L(ev, 'name')),
      h('div.ed', live ? t('net.endsIn', { d: fmtDur(ev.ends - net.serverNow()) }) : t('net.startsIn', { d: fmtDur(ev.starts - net.serverNow()) }))),
    h('span.chip' + (live ? '.ok' : ''), live ? t('net.live') : t('net.soon')));
}

async function rename(nameEl) {
  app.modal((box, close) => {
    const inp = h('input.input', { value: net.me().name, maxlength: 16, 'data-autofocus': true, aria: { label: t('net.rename') } });
    const err = h('p.note', { style: { color: 'var(--bad)' } });
    box.append(h('h2', t('net.rename')), h('p.note', t('net.nameRules')), inp, err,
      h('div.stack', h('button.btn.primary.block', { on: { click: async () => {
        try { const r = await net.api('POST', '/api/me/name', { name: inp.value }); app.data.online.name = r.name; app.save(); nameEl.textContent = r.name; close(); }
        catch (e) { err.textContent = errText(e); }
      } } }, t('common.save')), h('button.btn.ghost.block', { on: { click: () => close() } }, t('common.cancel'))));
  });
}

async function startWeekly() {
  try {
    const r = await net.api('POST', '/api/weekly/run');
    playOnline({ cfg: r.cfg, seed: r.seed, runId: r.runId, kind: 'weekly', label: t('net.weekly') });
  } catch (e) { toast(errText(e)); }
}

/* =========================================================================
   المباراة السريعة
   ========================================================================= */
registerScreen('matchmaking', (app) => {
  const status = h('p.note', t('net.searching'));
  const el = h('main.handoff', h('div.search-anim', { html: mascotSVG({ skin: app.data.cosmetics.skin, mood: 'think', size: 90, label: '' }) }),
    h('div.big', t('net.quick')), status, h('p.faint', t('net.ghostNote')),
    h('button.btn.ghost.block', { style: { marginTop: '20px' }, on: { click: () => { net.send({ t: 'queue.leave' }); app.back(); } } }, t('common.cancel')));
  let off = null, alive = true;
  (async () => {
    try {
      await net.ensureIdentity(app); await net.ready();
      off = net.on((m) => {
        if (!alive) return;
        if (m.t === 'match') { alive = false; off(); sfx.go(); buzz([20, 40, 20]); startMatch(m, { replace: true }); }
        if (m.t === 'queue.empty') { status.textContent = t('net.noPlayers'); }
      });
      net.send({ t: 'queue' });
    } catch (e) { status.textContent = errText(e); }
  })();
  return { el, destroy: () => { alive = false; off?.(); net.send({ t: 'queue.leave' }); } };
});

function startMatch(m, extra = {}) {
  const label = m.kind === 'room' ? t('net.roomMatch') : m.kind === 'ghost' ? t('net.vsGhost', { name: m.ghosts[0]?.name || '' }) : t('net.quick');
  playOnline({ cfg: m.cfg, seed: m.seed, kind: m.kind, matchId: m.id, runId: m.runId, startAt: m.startAt, players: m.players, ghosts: m.ghosts.map((g) => ({ ...g, name: '👻 ' + g.name })), label, extra });
}

/* =========================================================================
   الغرف
   ========================================================================= */
registerScreen('rooms', (app) => {
  const el = h('main', topbar(t('net.rooms'), t('net.roomsSub')));
  const code = h('input.input.codein', { inputmode: 'numeric', maxlength: 6, placeholder: '••••••', dir: 'ltr', aria: { label: t('net.roomCode') } });
  const err = h('p.note', { style: { color: 'var(--bad)' } });
  el.append(
    h('section.card', h('h2.section-title', '➕ ' + t('net.createRoom')), h('p.note', t('net.createRoomSub')),
      h('button.btn.primary.block.lg', { id: 'createRoom', on: { click: () => { sfx.tap(); app.go('room', { create: true }); } } }, t('net.createRoom'))),
    h('section.card', h('h2.section-title', '🔗 ' + t('net.joinRoom')), field(t('net.roomCode'), code), err,
      h('button.btn.block', { id: 'joinRoom', on: { click: () => {
        const c = code.value.replace(/\D/g, '');
        if (c.length !== 6) { err.textContent = t('net.codeLen'); return; }
        app.go('room', { code: c });
      } } }, t('net.join'))));
  return { el };
});

registerScreen('room', (app, params) => {
  const el = h('main', topbar(t('net.room')));
  const box = h('div'); el.append(box);
  let room = null, off = null, myId = null;
  const render = () => {
    clear(box);
    if (!room) return;
    const host = room.host === myId;
    const s = room.settings;
    box.append(h('section.card.room-code', h('div.faint', t('net.shareCode')), h('div.pin', { dir: 'ltr', id: 'roomPin' }, room.code),
      h('button.btn.sm', { on: { click: () => share(t('net.roomInvite', { code: room.code }), shareUrl()) } }, icon('upload'), t('net.share'))));
    const list = h('section.card.section', h('h2.section-title', t('net.players'), h('small', `${num(room.members.length)}/${num(8)}`)));
    for (const m of room.members) {
      list.append(h('div.row', drop('sky', 24),
        h('div.grow', h('div.t', { style: { color: m.color } }, m.name, m.id === room.host ? ' 👑' : '', m.id === myId ? ` (${t('net.you')})` : ''),
          s.mode === 'teams' ? h('div.d', m.team ? t('net.teamRed') : t('net.teamBlue')) : null),
        host && s.mode === 'teams' ? h('button.btn.sm', { on: { click: () => net.send({ t: 'room.team', id: m.id }) } }, '⇄') : null));
    }
    box.append(list);
    if (host) {
      const set = (k, v) => { net.send({ t: 'room.settings', settings: { ...s, [k]: v } }); };
      box.append(h('section.card',
        field(t('setup.difficulty'), seg(['easy', 'medium', 'hard', 'expert'].map((d) => [d, t('diff.' + d)]), s.diff, (v) => set('diff', v), t('setup.difficulty'))),
        field(t('setup.duration'), seg([30, 60, 90, 120].map((d) => [d, t('common.sec', { n: d })]), s.seconds, (v) => set('seconds', +v), t('setup.duration'))),
        field(t('net.roomMode'), seg([['race', t('net.race')], ['teams', t('net.teams')]], s.mode, (v) => set('mode', v), t('net.roomMode'))),
        h('div.row', h('div.grow.t', t('net.specials')), h('button.switch', { role: 'switch', aria: { checked: String(s.specials), label: t('net.specials') }, on: { click: () => set('specials', !s.specials) } }))),
      h('button.btn.gold.block.lg', { id: 'startRoom', disabled: room.members.length < 2, on: { click: () => { sfx.tap(); net.send({ t: 'room.start' }); } } }, icon('play'), t('net.startRoom')),
      room.members.length < 2 ? h('p.note', { style: { textAlign: 'center' } }, t('net.needTwo')) : null);
    } else {
      box.append(h('section.card', h('p.note', `${t('setup.difficulty')}: ${t('diff.' + s.diff)} · ${t('common.sec', { n: s.seconds })} · ${s.mode === 'teams' ? t('net.teams') : t('net.race')}`),
        h('p', { style: { fontWeight: 800, textAlign: 'center' } }, '⏳ ' + t('net.waitHost'))));
    }
    box.append(emoteBar());
  };
  (async () => {
    try {
      await net.ensureIdentity(app); await net.ready(); myId = net.me().id;
      off = net.on((m) => {
        if (m.t === 'room') { room = m.room; if (!room) return; render(); }
        if (m.t === 'match' && m.kind === 'room') startMatch(m);
        if (m.t === 'emote') showEmote(m);
        if (m.t === 'error') { toast(errText({ code: m.code })); if (m.code === 'room_not_found' || m.code === 'room_full' || m.code === 'room_busy') app.back(); }
      });
      if (params.create) net.send({ t: 'room.create', settings: { diff: 'medium', seconds: 60, mode: 'race', specials: true } });
      else net.send({ t: 'room.join', code: params.code });
      params.create = false; // عند العودة من المباراة لا نُنشئ غرفة جديدة
    } catch (e) { clear(box).append(offlineCard(e, () => app.refresh())); }
  })();
  return {
    el,
    destroy: () => { off?.(); },
    onBack: () => { net.send({ t: 'room.leave' }); app.back(); return true; },
  };
});

const share = (text, url) => shareText(text, url);

/* =========================================================================
   البطولات
   ========================================================================= */
registerScreen('tournaments', (app) => {
  const el = h('main', topbar(t('net.tournaments'), t('net.tournamentsSub')));
  const box = h('div'); el.append(box);
  guard(box, async () => {
    const { tournaments } = await net.api('GET', '/api/tournaments');
    clear(box);
    if (!tournaments.length) box.append(h('section.card.empty-state', h('div', { style: { fontSize: '3rem' } }, '🏆'), h('h2', t('net.noTournaments')), h('p.note', t('net.noTournamentsSub'))));
    for (const tr of tournaments) box.append(eventCard(tr));
  });
  return { el };
});

registerScreen('tournament', (app, { id }) => {
  const el = h('main', topbar(t('net.tournament')));
  const box = h('div'); el.append(box);
  guard(box, async () => {
    const { tournament: tr, leaderboard } = await net.api('GET', `/api/tournaments/${id}`);
    clear(box);
    const r = tr.rules;
    const live = tr.status === 'active';
    const left = r.attempts ? r.attempts - (tr.attemptsUsed || 0) : null;
    box.append(h('section.event-hero', { style: { '--ec': tr.color } }, h('div.ei', tr.icon), h('h2', L(tr, 'name')), L(tr, 'desc') ? h('p', L(tr, 'desc')) : null,
      h('div.chip' + (live ? '.ok' : ''), live ? t('net.endsIn', { d: fmtDur(tr.ends - net.serverNow()) }) : tr.status === 'upcoming' ? t('net.startsIn', { d: fmtDur(tr.starts - net.serverNow()) }) : t('net.ended'))),
    h('section.card',
      h('div.row', h('div.grow.t', t('net.rules')), h('div.d', r.mode === 'survival' ? t('mode.survival') : t('net.stormSecs', { n: r.seconds }), ' · ', t('diff.' + r.diff))),
      h('div.row', h('div.grow.t', t('net.attempts')), h('div.d', r.attempts ? t('net.attemptsLeft', { n: Math.max(0, left), m: r.attempts }) : t('net.unlimited'))),
      h('div.row', h('div.grow.t', t('net.sameStorm')), h('div.d', r.fixedSeed ? t('net.yesSame') : t('net.noSame'))),
      h('div.row', h('div.grow.t', t('net.prize')), h('div.d', `🏅 ${L(tr.prize, 'label')} · ${t('net.topN', { n: tr.prize.topN })}`)),
      tr.best != null ? h('div.row', h('div.grow.t', t('net.myBest')), h('b', num(tr.best))) : null),
    live && (left == null || left > 0) ? h('button.btn.gold.block.lg', { id: 'playTournament', style: { marginTop: '12px' }, on: { click: async () => {
      sfx.tap();
      try { const run = await net.api('POST', `/api/tournaments/${id}/run`); playOnline({ cfg: run.cfg, seed: run.seed, runId: run.runId, kind: 'tournament', label: `${tr.icon} ${L(tr, 'name')}`, extra: { tid: id } }); }
      catch (e) { toast(errText(e)); }
    } } }, icon('play'), t('net.playTournament')) : null,
    lbList(leaderboard, t('net.tLeaderboard')));
  });
  return { el };
});

function lbList(lb, title) {
  const sec = h('section.card.section', h('h2.section-title', title));
  if (!lb.list.length) sec.append(h('p.note', t('net.lbEmpty')));
  const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : num(r);
  for (const r of lb.list) sec.append(h('div.lb-row' + (r.me ? '.me' : ''), h('span.rk', medal(r.rank)), drop(r.skin), h('span.nm', r.name + (r.me ? ` (${t('net.you')})` : '')), h('b', num(r.score))));
  if (lb.mine && !lb.list.some((x) => x.me)) sec.append(h('div.lb-row.me', h('span.rk', num(lb.mine.rank)), drop(app.data.cosmetics.skin), h('span.nm', `${lb.mine.name} (${t('net.you')})`), h('b', num(lb.mine.score))));
  return sec;
}

/* =========================================================================
   لوحات الصدارة
   ========================================================================= */
registerScreen('leaderboards', (app, params) => {
  let board = params.board || 'weekly';
  const el = h('main', topbar(t('net.leaderboards'), t('net.lbReal')));
  const box = h('div');
  el.append(seg([['weekly', t('net.lb.weekly')], ['season', t('net.lb.season')], ['daily', t('net.lb.daily')], ['friends', t('net.lb.friends')], ['alltime', t('net.lb.alltime')]], board,
    (v) => { board = v; app.stack[app.stack.length - 1].params = { board: v }; load(); }, t('net.leaderboards')), box);
  const load = () => guard(box, async () => {
    const lb = await net.api('GET', `/api/leaderboard/${board}`);
    clear(box).append(h('p.note', t('net.lbDesc.' + board)), lbList(lb, t('net.lb.' + board)));
  });
  load();
  return { el };
});

/* =========================================================================
   دوري الدول
   ========================================================================= */
function countrySelect(value) {
  const lang = locale().lang;
  const opts = COUNTRIES.map((c) => [c, countryName(c, lang)]).sort((a, b) => a[1].localeCompare(b[1], lang));
  return h('select.input', { aria: { label: t('nat.myCountry') } }, ...opts.map(([c, n]) => h('option', { value: c, selected: c === value }, `${flag(c)} ${n}`)));
}
registerScreen('nations', (app) => {
  const el = h('main', topbar(t('nat.title'), t('nat.sub')));
  const box = h('div'); el.append(box);
  const load = () => guard(box, async () => {
    const [me, nat] = await Promise.all([net.api('GET', '/api/me'), net.api('GET', '/api/nations')]);
    const lang = locale().lang;
    clear(box);
    const cur = me.player.country;
    if (!cur) {
      // أول مرة: اختيار الدولة (مقترحة من إعدادات الجهاز)
      const sel = countrySelect(detectCountry() || 'SA');
      box.append(h('section.card', h('h2', t('nat.pick')), h('p.note', t('nat.pickNote')), sel,
        h('button.btn.primary.block', { id: 'saveCountry', style: { marginTop: '10px' }, on: { click: async () => {
          try { await net.api('POST', '/api/me/country', { country: sel.value }); sfx.correct(); load(); } catch (e) { toast(errText(e)); }
        } } }, t('nat.join'))));
    } else {
      const m = nat.mine || { country: cur, rank: null, points: 0, myPoints: 0 };
      box.append(h('section.card.nat-me', h('div.nat-flag', flag(cur)),
        h('div.grow', h('div.t', countryName(cur, lang)),
          h('div.d', m.rank ? t('nat.rank', { n: num(m.rank) }) : t('nat.noRank')),
          h('div.d', t('nat.myPoints', { n: num(m.myPoints) }) + (m.myRank ? ' · ' + t('nat.myRank', { n: num(m.myRank) }) : ''))),
        h('b.nat-pts', num(m.points))));
      box.append(h('p.note', t('nat.how')));
      box.append(h('button.btn.block.primary', { on: { click: () => { sfx.tap(); app.go('home', {}, { root: true }); } } }, '💧 ', t('nat.play')));
    }
    const list = h('section.card.section', h('h2.section-title', t('nat.board'), h('small', nat.week)));
    if (!nat.list.length) list.append(h('p.note', t('nat.empty')));
    const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : num(r);
    for (const r of nat.list) list.append(h('div.lb-row' + (r.country === cur ? '.me' : ''), h('span.rk', medal(r.rank)), h('span.nat-f', flag(r.country)),
      h('span.nm', countryName(r.country, lang), h('small', ' · ' + t('nat.players', { n: num(r.players) }))), h('b', num(r.points))));
    box.append(list);
    if (cur) {
      const sel = countrySelect(cur);
      box.append(h('details.card', h('summary', t('nat.change')), h('p.note', t('nat.changeNote')), sel,
        h('button.btn.block', { style: { marginTop: '8px' }, on: { click: async () => {
          try { await net.api('POST', '/api/me/country', { country: sel.value }); load(); } catch (e) { toast(e.code === 'country_locked' ? t('nat.locked') : errText(e)); }
        } } }, t('common.save'))));
    }
  });
  load();
  return { el, nav: 'online' };
});

/* =========================================================================
   النوادي: مجموعة لها رمز انضمام (معلم وطلابه، مدرّب، أصدقاء، فريق عمل)
   ========================================================================= */
const clubLink = (code) => shareUrl({ club: code, ref: 'club' });
registerScreen('clubs', (app) => {
  const el = h('main', topbar(t('club.title'), t('club.sub')));
  const box = h('div'); el.append(box);
  const load = () => guard(box, async () => {
    const [{ clubs }, { league }] = await Promise.all([net.api('GET', '/api/clubs'), net.api('GET', '/api/clubs/league')]);
    clear(box);
    const mine = h('section.card.section', h('h2.section-title', t('club.mine'), h('small', num(clubs.length))));
    if (!clubs.length) mine.append(h('p.note', t('club.none')));
    for (const c of clubs) mine.append(h('button.row.row-btn', { on: { click: () => { sfx.tap(); app.go('club', { id: c.id }); } } },
      h('span', { style: { fontSize: '1.5rem' } }, c.mine ? '👑' : '🏫'), h('div.grow', h('div.t', c.name), h('div.d', t('club.members', { n: num(c.members) }))), h('span.faint', '›')));
    const name = h('input.input', { maxlength: 24, placeholder: t('club.namePh'), aria: { label: t('club.name') } });
    const code = h('input.input.codein', { maxlength: 6, dir: 'ltr', placeholder: 'ABC123', aria: { label: t('club.code') } });
    const err = h('p.note', { style: { color: 'var(--bad)' } });
    box.append(mine,
      h('section.card', field(t('club.create'), name, t('club.createHint')), h('button.btn.primary.block', { id: 'createClub', on: { click: async () => {
        try { const r = await net.api('POST', '/api/clubs', { name: name.value }); sfx.correct(); app.go('club', { id: r.id }); } catch (e) { err.textContent = errText(e); }
      } } }, icon('plus'), t('club.createBtn'))),
      h('section.card', field(t('club.join'), code, t('club.privacy')), h('button.btn.block', { id: 'joinClub', on: { click: async () => {
        try { const r = await net.api('POST', '/api/clubs/join', { code: code.value }); sfx.correct(); app.go('club', { id: r.id }); } catch (e) { err.textContent = errText(e); }
      } } }, t('club.joinBtn'))), err);
    const lg = h('section.card.section', h('h2.section-title', '🏆 ' + t('club.league')), h('p.note', t('club.leagueHow')));
    if (!league.length) lg.append(h('p.note', t('club.leagueEmpty')));
    const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : num(r);
    for (const c of league) lg.append(h('div.lb-row' + (c.mine ? '.me' : ''), h('span.rk', medal(c.rank)), h('span.nm', c.name, h('small', ' · ' + t('club.members', { n: num(c.members) }))), h('b', num(c.points))));
    box.append(lg);
  });
  load();
  return { el, nav: 'online' };
});

registerScreen('club', (app, { id }) => {
  const el = h('main', topbar(t('club.title')));
  const box = h('div'); el.append(box);
  const load = () => guard(box, async () => {
    const { club: c } = await net.api('GET', `/api/clubs/${id}`);
    clear(box);
    box.append(h('section.card.club-head', h('h1', c.name), h('div.faint', t('club.members', { n: num(c.members.length) }) + ' · ' + t('club.weekPts', { n: num(c.points) })),
      h('div.faint', t('club.code'), ' ', h('b.code', { dir: 'ltr', id: 'clubCode' }, c.code)),
      h('button.btn.sm.primary', { on: { click: () => shareText(t('club.invite', { name: c.name, code: c.code }), clubLink(c.code)) } }, icon('upload'), t('club.inviteBtn'))));
    if (c.owner) box.append(h('p.note', t('club.ownerNote')));
    const list = h('section.card.section', h('h2.section-title', t('club.week')));
    const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : num(r);
    const ago = (ms) => { const d = Math.floor((Date.now() - ms) / 864e5); return d <= 0 ? t('club.today') : t('club.daysAgo', { n: num(d) }); };
    for (const m of c.members) {
      const extra = c.owner && !m.me ? h('div.d', t('club.stats', { runs: num(m.runs), acc: m.accuracy == null ? '—' : num(m.accuracy), days: num(m.days) }) + ' · ' + ago(m.lastSeen)) : null;
      const rm = c.owner && !m.owner ? h('button.icon-btn', { aria: { label: t('club.remove') + ' ' + m.name }, on: { click: async () => {
        if (await app.confirm({ title: t('club.remove'), body: m.name, danger: true })) { await net.api('DELETE', `/api/clubs/${c.id}/members/${m.id}`); load(); }
      } } }, icon('close')) : null;
      list.append(h('div.lb-row' + (m.me ? '.me' : ''), h('span.rk', medal(m.rank)), drop(m.skin), h('span.nm', h('span', (m.owner ? '👑 ' : '') + m.name), extra), h('b', num(m.points)), rm));
    }
    box.append(list, h('button.btn.block.primary', { on: { click: () => { sfx.tap(); app.go('home', {}, { root: true }); } } }, '💧 ', t('club.play')));
    if (c.owner) box.append(h('button.btn.block.ghost.danger', { on: { click: async () => {
      if (await app.confirm({ title: t('club.delete'), body: c.name, danger: true })) { await net.api('DELETE', `/api/clubs/${c.id}`); app.go('clubs', {}, { replace: true }); }
    } } }, t('club.delete')));
    else box.append(h('button.btn.block.ghost', { on: { click: async () => {
      if (await app.confirm({ title: t('club.leave'), body: c.name })) { await net.api('DELETE', `/api/clubs/${c.id}/members/me`); app.go('clubs', {}, { replace: true }); }
    } } }, t('club.leave')));
  });
  load();
  return { el, nav: 'online' };
});

/** رابط انضمام ?club=CODE */
registerScreen('clubJoin', (app, { code }) => {
  const el = h('main', topbar(t('club.title')));
  const box = h('div'); el.append(box);
  box.append(h('section.event-hero', { style: { '--ec': '#38D6F5' } }, h('div.ei', '🏫'), h('h2', t('club.joinTitle')), h('p', h('b.code', { dir: 'ltr' }, code))),
    h('p.note', t('club.privacy')),
    h('button.btn.gold.block.lg', { id: 'confirmJoin', on: { click: () => guard(box, async () => {
      const r = await net.api('POST', '/api/clubs/join', { code }); sfx.correct(); app.go('club', { id: r.id }, { replace: true });
    }) } }, t('club.joinBtn')));
  return { el };
});

/* =========================================================================
   الأصدقاء
   ========================================================================= */
registerScreen('friends', (app) => {
  const el = h('main', topbar(t('net.friends'), t('net.friendsSub')));
  const box = h('div'); el.append(box);
  const paint = (friends) => {
    clear(box);
    const code = h('input.input.codein', { maxlength: 6, dir: 'ltr', placeholder: 'ABC123', aria: { label: t('net.friendCode') } });
    const err = h('p.note', { style: { color: 'var(--bad)' } });
    box.append(h('section.card', h('div.faint', t('net.myCode')), h('div.pin', { dir: 'ltr' }, net.me().code),
      h('button.btn.sm', { on: { click: () => share(t('net.addMe', { code: net.me().code }), shareUrl()) } }, icon('upload'), t('net.share'))),
    h('section.card', field(t('net.addFriend'), code), err, h('button.btn.primary.block', { id: 'addFriend', on: { click: async () => {
      try { const r = await net.api('POST', '/api/friends', { code: code.value.trim() }); sfx.correct(); paint(r.friends); }
      catch (e) { err.textContent = errText(e); }
    } } }, icon('plus'), t('net.add'))));
    const list = h('section.card.section', h('h2.section-title', t('net.friends'), h('small', num(friends.length))));
    if (!friends.length) list.append(h('p.note', t('net.noFriends')));
    for (const f of friends) list.append(h('div.row', drop(f.skin), h('div.grow', h('div.t', f.name, ' ', h('span.dot' + (f.online ? '.on' : ''), { aria: { label: f.online ? t('net.onlineNow') : '' } })),
      h('div.d', f.weekly != null ? t('net.weeklyBest', { n: num(f.weekly) }) : t('net.noWeekly'))),
      h('button.icon-btn', { aria: { label: t('prof.delete') + ' ' + f.name }, on: { click: async () => { if (await app.confirm({ title: t('net.removeFriend'), body: f.name, danger: true })) { await net.api('DELETE', `/api/friends/${f.id}`); load(); } } } }, icon('close'))));
    box.append(list, h('button.btn.block', { on: { click: () => app.go('leaderboards', { board: 'friends' }) } }, '📊 ', t('net.lb.friends')));
  };
  const load = () => guard(box, async () => { const r = await net.api('GET', '/api/friends'); paint(r.friends); });
  load();
  return { el };
});

/* =========================================================================
   تحدي الرابط
   ========================================================================= */
registerScreen('challenge', (app, { id }) => {
  const el = h('main', topbar(t('net.challenge')));
  const box = h('div'); el.append(box);
  guard(box, async () => {
    const { challenge: c } = await net.api('GET', `/api/challenges/${id}`);
    clear(box).append(h('section.event-hero', { style: { '--ec': '#FF7BB0' } }, h('div.ei', '⚔️'), h('h2', t('net.challengeFrom', { name: c.creator })), h('p', t('net.challengeBeat', { n: num(c.score) }))),
      h('p.note', t('net.challengeNote')),
      h('button.btn.gold.block.lg', { id: 'playChallenge', on: { click: async () => {
        try { const r = await net.api('POST', `/api/challenges/${id}/run`); playOnline({ cfg: r.cfg, seed: r.seed, runId: r.runId, kind: 'challenge', label: t('net.challenge'), extra: { target: c.score, creator: c.creator } }); }
        catch (e) { toast(errText(e)); }
      } } }, icon('play'), t('net.acceptChallenge')),
      h('button.btn.block', { id: 'reshareChallenge', on: { click: () => shareText(t('share.challengeText', { n: num(c.score) }), shareUrl({ c: id })) } }, icon('upload'), t('share.reshare')),
      c.takers.length ? lbList({ list: c.takers.map((x, i) => ({ ...x, rank: i + 1 })) }, t('net.takers')) : null);
  });
  return { el };
});

/* =========================================================================
   نتيجة أونلاين (تنتظر تحقق الخادم)
   ========================================================================= */
registerScreen('onlineResult', (app, params) => {
  const el = h('main');
  const box = h('div'); el.append(box);
  const local = params.local;
  let off = null;
  const head = (title, mood = 'happy') => h('section.result-hero', h('div', { html: mascotSVG({ skin: app.data.cosmetics.skin, acc: app.data.cosmetics.acc, mood, size: 90, label: '' }) }), h('h1', { 'data-autofocus': true }, title));
  const reward = (score, valid) => {
    if (!valid || params._committed) return null;
    params._committed = true;
    const rw = commitRound(app.data, { id: 'online-' + (params.runId || params.matchId), mode: 'online', score, correct: local.correct, answered: local.answered, bestStreak: local.bestStreak, perOp: local.perOp });
    app.save();
    return rw;
  };
  const buttons = (runId) => h('div.stack', { style: { marginTop: '16px' } },
    params.kind === 'duel' || params.kind === 'ghost' ? h('button.btn.primary.block.lg', { id: 'againBtn', on: { click: () => app.go('matchmaking', {}, { replace: true }) } }, icon('refresh'), t('net.playAgain')) : null,
    params.kind === 'room' ? h('button.btn.primary.block.lg', { on: { click: () => app.back() } }, icon('users'), t('net.backToRoom')) : null,
    params.kind === 'tournament' ? h('button.btn.primary.block.lg', { on: { click: () => app.go('tournament', { id: params.extra.tid }, { replace: true }) } }, '🏆 ', t('net.tournament')) : null,
    params.kind === 'weekly' ? h('button.btn.primary.block.lg', { on: { click: () => { app.back(); setTimeout(() => document.getElementById('weeklyBtn')?.click(), 60); } } }, icon('refresh'), t('net.playAgain')) : null,
    runId && ['weekly', 'duel', 'ghost', 'tournament'].includes(params.kind) ? h('button.btn.block', { id: 'challengeBtn', on: { click: async () => {
      try { const r = await net.api('POST', '/api/challenges', { runId }); share(t('net.challengeShare', { n: num(local.score) }), shareUrl({ c: r.id })); }
      catch (e) { toast(errText(e)); }
    } } }, '⚔️ ', t('net.makeChallenge')) : null,
    h('button.btn.ghost.block', { on: { click: () => app.go('online', {}, { root: true }) } }, t('online.title')));
  const statLine = () => h('div.stat-grid.four', ...[[num(local.popped), t('net.popped')], [num(Math.round(local.accuracy * 100)) + '%', t('res.accuracy')], [num(local.bestStreak), t('res.bestStreak')], [num(local.missed), t('net.missed')]].map(([v, l]) => h('div.stat', h('div.v', v), h('div.l', l))));

  if (params.matchId) {
    clear(box).append(head(t('net.waitingResults'), 'think'), h('div.big-score', { style: { textAlign: 'center' } }, num(local.score)), statLine(), h('p.note', { style: { textAlign: 'center' } }, t('net.waitingOthers')));
    off = net.on((m) => {
      if (m.t !== 'result' || m.id !== params.matchId) return;
      off();
      const myId = net.me().id;
      const mine = m.standings.find((s) => s.id === myId);
      const won = mine && mine.rank === 1;
      const myTeam = params.players.find((p) => p.id === myId)?.team;
      const teamWon = m.teams ? m.teams[myTeam]?.score >= Math.max(...m.teams.map((x) => x.score)) : null;
      const title = m.teams ? (teamWon ? t('net.teamWon') : t('net.teamLost')) : won ? t('net.youWon') : t('net.rankN', { n: mine?.rank || '-' });
      const rw = reward(mine?.score || 0, mine?.valid);
      clear(box).append(head(title, won || teamWon ? 'cheer' : 'happy'), h('div.big-score', { style: { textAlign: 'center' } }, num(mine?.score || 0)),
        m.rating ? h('div.chip.gold', { style: { margin: '6px auto', display: 'flex', width: 'max-content' } }, `${t('net.rating')} ${num(m.rating.before)} → ${num(m.rating.after)}`) : null,
        mine && !mine.valid ? h('p.note.warn', t('net.invalid')) : null,
        m.teams ? h('div.vs-table', ...m.teams.map((tm, i) => [i === 1 ? h('strong', t('fr.vs')) : null, h('div.pl' + (tm.score === Math.max(...m.teams.map((x) => x.score)) ? '.win' : ''), h('div.pn', tm.team ? t('net.teamRed') : t('net.teamBlue')), h('div.ps', num(tm.score)))]).flat()) : null,
        lbList({ list: m.standings.map((s) => ({ ...s, me: s.id === myId, name: (s.ghost ? '👻 ' : '') + s.name + (s.dnf ? ' — ' + t('net.dnf') : '') })) }, t('net.standings')),
        rw?.xp ? h('div.chip.ok', { style: { margin: '10px auto', display: 'flex', width: 'max-content' } }, t('res.xp', { n: rw.xp })) : null,
        emoteBar(), buttons(mine?.valid ? params.runId : null));
      if (won || teamWon) { sfx.fanfare(); confetti(); } else sfx.win();
    });
    // إن تأخرت النتيجة: يعرضها الخادم بعد انتهاء مهلة المباراة
  } else {
    clear(box).append(head(t('net.checking'), 'think'), h('div.big-score', { style: { textAlign: 'center' } }, num(local.score)), statLine());
    net.submitRun(params.runId, params.submit).then((r) => {
      const rw = reward(r.score, r.valid);
      let title = t('net.scoreSaved');
      if (params.kind === 'challenge') title = r.score > params.extra.target ? t('net.beatChallenge', { name: params.extra.creator }) : t('net.lostChallenge', { name: params.extra.creator });
      clear(box).append(head(title, r.valid ? 'cheer' : 'sad'), h('div.big-score', { style: { textAlign: 'center' } }, num(r.score)), statLine(),
        !r.valid ? h('p.note.warn', t('net.invalid')) : null,
        r.board ? h('div.chip.gold', { style: { margin: '8px auto', display: 'flex', width: 'max-content' } }, t('net.yourRank', { n: num(r.board.rank) })) : null,
        rw?.xp ? h('div.chip.ok', { style: { margin: '8px auto', display: 'flex', width: 'max-content' } }, t('res.xp', { n: rw.xp })) : null,
        buttons(params.runId));
      if (r.valid) { sfx.win(); if (params.kind === 'challenge' && r.score > params.extra.target) confetti(); }
    }).catch((e) => {
      clear(box).append(head(t('net.notSaved'), 'sad'), h('p.note', errText(e)), statLine(), buttons(null));
    });
  }
  return { el, destroy: () => off?.() };
});

/** بعد التحدي اليومي الرسمي: ترفع النتيجة للوحة اليوم إن وُجد اتصال (بصمت) */
export async function uploadDaily(app, date, log, endTick) {
  if (!app.data.online?.token) return;
  try { net.useIdentity(app.data); await net.api('POST', '/api/daily/submit', { date, log, endTick }); } catch { /* بلا اتصال: تبقى النتيجة المحلية */ }
}
