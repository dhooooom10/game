/* =========================================================================
   تحدّي الأصدقاء: قائمة أصدقائي (بالرمز)، صندوق التحديات، تحدٍّ مخصص أو تحدي
   مرحلة لصديق بعينه، سباق الرحلة بين الأصدقاء، والحصيلة بيني وبين كل صديق.
   كل تحدٍّ = جولة حقيقية يعيد الخادم تشغيلها للتحقق، وصديقك يلعب نفس القطرات.
   ========================================================================= */
import { app, registerScreen } from '../app.js';
import { h, icon, num, clear } from '../ui/dom.js';
import { sfx } from '../ui/audio.js';
import { toast } from '../ui/fx.js';
import { t } from '../i18n.js';
import * as net from '../net/online.js';
import { shareUrl } from '../ui/share.js';
import { track } from '../net/analytics.js';
import { topbar, seg, customFields } from './setup.js';
import { guard, errText, drop, share, playOnline } from './online.js';
import { TOTAL_LEVELS } from '../core/modes.js';

const totalStars = (d) => Object.values(d.journey.stars).reduce((a, b) => a + b, 0);

/** يرسل تقدّم الرحلة للخادم (لسباق الأصدقاء) — مرة كل تغيير */
export async function syncProgress(app) {
  const d = app.data;
  if (!d.online?.token) return;
  const p = { stars: totalStars(d), level: Math.min(TOTAL_LEVELS, d.journey.unlocked), xp: d.xp };
  const key = `${p.stars}:${p.level}:${p.xp}`;
  if (d.online.synced === key) return;
  try { await net.api('POST', '/api/me/progress', p); d.online.synced = key; app.save(); } catch { /* لاحقًا */ }
}

const metaLabel = (m) => (m?.kind === 'level' ? t('fh.levelN', { n: num(m.level) }) : t('fh.customLabel') + (m?.label ? ' · ' + m.label : ''));

registerScreen('friendsHub', (app) => {
  const el = h('main', topbar(t('fh.title'), t('fh.sub')));
  const box = h('div'); el.append(box);
  const load = () => guard(box, async () => {
    await syncProgress(app);
    const [fr, ib] = await Promise.all([net.api('GET', '/api/friends'), net.api('GET', '/api/inbox')]);
    paint(fr.friends, ib);
  });

  function paint(friends, ib) {
    clear(box);
    const me = net.me();
    // ١) رمزي وإضافة صديق
    const code = h('input.input.codein', { maxlength: 6, dir: 'ltr', placeholder: 'ABC123', aria: { label: t('net.friendCode') } });
    const err = h('p.note', { style: { color: 'var(--bad)' } });
    box.append(h('section.card.fh-code',
      h('div.fh-mine', h('div.faint', t('net.myCode')), h('div.pin', { dir: 'ltr', id: 'myCode' }, me.code),
        h('button.btn.sm', { type: 'button', on: { click: () => { track('share_challenge'); share(t('net.addMe', { code: me.code }), shareUrl({ ref: 'friend' })); } } }, icon('upload'), t('fh.sendCode'))),
      h('div.fh-add', code, h('button.btn.primary', { id: 'addFriend', type: 'button', on: { click: async () => {
        try { await net.api('POST', '/api/friends', { code: code.value.trim() }); sfx.correct(); toast(t('fh.added')); load(); }
        catch (e) { err.textContent = errText(e); }
      } } }, icon('plus'), t('net.add'))), err));

    // ٢) تحديات وصلتني
    const pend = ib.received.filter((c) => c.mine == null);
    const done = ib.received.filter((c) => c.mine != null).slice(0, 5);
    if (pend.length || done.length) {
      const sec = h('section.section', h('h2.section-title', '📥 ', t('fh.inbox'), pend.length ? h('span.badge-count', num(pend.length)) : null));
      for (const c of pend) sec.append(h('div.ch-card.pending',
        h('span.ch-ic', c.meta?.kind === 'level' ? '🗺️' : '⚔️'),
        h('div.grow', h('div.t', t('fh.fromX', { name: c.from })), h('div.d', metaLabel(c.meta), ' · ', t('fh.beat', { n: num(c.target) }))),
        h('button.btn.gold.sm', { type: 'button', 'data-ch': c.id, on: { click: () => playChallenge(c) } }, icon('play'), t('fh.play'))));
      for (const c of done) sec.append(resultRow(t('fh.fromX', { name: c.from }), c.meta, c.mine, c.target));
      box.append(sec);
    }

    // ٣) أصدقائي
    const list = h('section.section', h('h2.section-title', '🤝 ', t('net.friends'), h('small', num(friends.length))));
    if (!friends.length) list.append(h('section.card.empty-state', h('div', { style: { fontSize: '2.4rem' } }, '🤝'), h('p.note', t('fh.empty'))));
    for (const f of friends) {
      const hh = f.h2h || { w: 0, l: 0, d: 0 };
      list.append(h('div.friend-row', { 'data-friend': f.id },
        drop(f.skin, 36),
        h('div.grow',
          h('div.t', f.name, ' ', h('span.dot' + (f.online ? '.on' : ''), { aria: { label: f.online ? t('net.onlineNow') : '' } })),
          h('div.d', '★ ', num(f.jstars), ' · ', t('fh.levelN', { n: num(f.jlevel) }), (hh.w + hh.l + hh.d) ? h('span.h2h', ' · ', t('fh.h2h', { w: num(hh.w), l: num(hh.l) })) : null)),
        h('button.btn.sm.primary', { type: 'button', 'data-challenge': f.id, on: { click: () => { sfx.tap(); app.go('friendChallenge', { friend: { id: f.id, name: f.name, jlevel: f.jlevel } }); } } }, '⚔️ ', t('fh.challenge')),
        h('button.icon-btn', { aria: { label: t('prof.delete') + ' ' + f.name }, on: { click: async () => { if (await app.confirm({ title: t('net.removeFriend'), body: f.name, danger: true })) { await net.api('DELETE', `/api/friends/${f.id}`); load(); } } } }, icon('close'))));
    }
    box.append(list);

    // ٤) سباق الرحلة بين الأصدقاء
    if (friends.length) {
      const mine = { id: me.id, name: me.name + ` (${t('net.you')})`, jstars: totalStars(app.data), jlevel: app.data.journey.unlocked, me: true };
      const race = [...friends, mine].sort((a, b) => b.jstars - a.jstars || b.jlevel - a.jlevel);
      box.append(h('section.card.section', h('h2.section-title', '🏁 ', t('fh.race')),
        ...race.map((r, i) => h('div.race-row' + (r.me ? '.me' : ''), h('b.rk', num(i + 1)), h('span.grow', r.name), h('span.chip.gold', '★ ' + num(r.jstars)), h('span.faint', t('fh.levelN', { n: num(r.jlevel) }))))));
    }

    // ٥) تحدياتي المرسلة
    if (ib.sent.length) {
      const sec = h('section.section', h('h2.section-title', '📤 ', t('fh.sent')));
      for (const c of ib.sent.slice(0, 8)) {
        if (c.theirs == null) sec.append(h('div.ch-card', h('span.ch-ic', '⏳'), h('div.grow', h('div.t', t('fh.toX', { name: c.to })), h('div.d', metaLabel(c.meta), ' · ', t('fh.yourScore', { n: num(c.score) }))), h('span.chip', t('fh.waiting'))));
        else sec.append(resultRow(t('fh.toX', { name: c.to }), c.meta, c.score, c.theirs));
      }
      box.append(sec);
    }

    box.append(h('div.stack.section',
      h('button.btn.block', { id: 'localFriend', type: 'button', on: { click: () => app.go('friendSetup') } }, '📱 ', t('fh.local')),
      h('button.btn.block.ghost', { type: 'button', on: { click: () => app.go('leaderboards', { board: 'friends' }) } }, '📊 ', t('net.lb.friends'))));
  }

  function resultRow(title, meta, mine, theirs) {
    const res = mine > theirs ? 'win' : mine < theirs ? 'lose' : 'draw';
    return h('div.ch-card.' + res, h('span.ch-ic', res === 'win' ? '🏆' : res === 'lose' ? '💧' : '🤝'),
      h('div.grow', h('div.t', title), h('div.d', metaLabel(meta), ' · ', num(mine), ' – ', num(theirs))),
      h('span.chip' + (res === 'win' ? '.ok' : ''), t('fh.res.' + res)));
  }

  async function playChallenge(c) {
    sfx.tap();
    try {
      track('challenge_play');
      const r = await net.api('POST', `/api/challenges/${c.id}/run`);
      playOnline({ cfg: r.cfg, seed: r.seed, runId: r.runId, kind: 'challenge', label: '⚔️ ' + c.from, extra: { target: c.target, creator: c.from } });
    } catch (e) { toast(errText(e)); }
  }

  load();
  return { el, afterMount: () => {} };
});

/* ---------------- تحدٍّ جديد لصديق: مخصص (نفس خانات «تحدّيك الخاص») أو مرحلة ---------------- */
registerScreen('friendChallenge', (app, { friend }) => {
  const data = app.data;
  const pref = (data.prefs.friendChallenge ||= { tab: 'custom', ops: ['add', 'sub'], level: 'easy', speed: 'fast', end: 't60', accel: true, jlevel: 1 });
  const el = h('main', topbar(t('fh.newTitle', { name: friend.name }), t('fh.newSub')));
  const body = h('div', { style: { marginTop: '12px' } });
  el.append(seg([['custom', '⚔️ ' + t('fh.tabCustom')], ['level', '🗺️ ' + t('fh.tabLevel')]], pref.tab, (v) => { pref.tab = v; app.save(); paint(); }, t('fh.newSub')), body);
  const sendTo = { id: friend.id, name: friend.name };
  function paint() {
    clear(body);
    if (pref.tab === 'custom') {
      body.append(h('section.card', ...customFields(pref, () => app.save())),
        h('p.note', t('fh.howCustom', { name: friend.name })),
        h('button.btn.gold.block.lg', { id: 'startFriendChallenge', type: 'button', on: { click: () => {
          sfx.tap();
          const args = { ops: [...pref.ops], level: pref.level, speed: pref.speed, end: pref.end, accel: pref.accel, sendTo };
          app.go('rainPlay', { kind: 'custom', args });
        } } }, icon('play'), t('fh.playSend')));
    } else {
      const max = Math.min(TOTAL_LEVELS, data.journey.unlocked);
      if (pref.jlevel > max) pref.jlevel = max;
      const grid = h('div.level-pick', { role: 'radiogroup', aria: { label: t('fh.tabLevel') } });
      for (let L = 1; L <= max; L++) {
        const st = data.journey.stars[L] || 0;
        grid.append(h('button.lp' + (L === pref.jlevel ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': String(L === pref.jlevel), 'data-level': L, on: { click: () => { sfx.tap(); pref.jlevel = L; app.save(); paint(); } } },
          num(L), st ? h('small', '★'.repeat(st)) : null));
      }
      body.append(h('section.card', h('div.label', t('fh.pickLevel')), grid),
        h('p.note', t('fh.howLevel', { name: friend.name, n: num(pref.jlevel) })),
        h('button.btn.gold.block.lg', { id: 'startLevelChallenge', type: 'button', on: { click: () => { sfx.tap(); app.go('rainPlay', { kind: 'journey', args: { level: pref.jlevel, sendTo } }); } } }, icon('play'), t('fh.playSend')));
    }
  }
  paint();
  return { el };
});
