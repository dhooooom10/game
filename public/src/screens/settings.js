/* الإعدادات والملفات الشخصية. */
import * as analytics from '../net/analytics.js';
import * as ads from '../net/ads.js';
import { app, registerScreen, VERSION } from '../app.js';
import { h, icon, clear } from '../ui/dom.js';
import { mascotSVG } from '../ui/mascot.js';
import { sfx, setLevels, hapticsSupported, buzz, startMusic, stopMusic } from '../ui/audio.js';
import { toast } from '../ui/fx.js';
import { t, tRaw, LANGS, loadLang } from '../i18n.js';
import { hashPass } from '../core/storage.js';
import { newProfileData, todayStr, levelFromXp } from '../core/progression.js';
import { topbar, seg } from './setup.js';

function sw(on, label, onChange) {
  const b = h('button.switch', { role: 'switch', aria: { checked: String(!!on), label }, on: { click: () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); sfx.tap(); onChange(v); } } });
  return b;
}
const row = (title, desc, control) => h('div.row', h('div.grow', h('div.t', title), desc ? h('div.d', desc) : null), control);

registerScreen('settings', (app) => {
  const s = app.data.settings;
  const el = h('main', topbar(t('set.title')));
  const profile = app.profile;

  // الاسم
  const nameIn = h('input.input', { value: profile?.name || '', maxlength: 20, placeholder: t('set.namePh'), aria: { label: t('set.name') }, autocomplete: 'nickname',
    on: { change: () => { app.store.updateProfile(app.pid, { name: nameIn.value.trim().slice(0, 20) }); toast('✓'); } } });
  el.append(h('section.card',
    h('h2.section-title', t('set.general')),
    h('div.field', h('label', t('set.name')), nameIn),
    h('div.field', h('div.label', t('set.language')),
      h('select.input', { aria: { label: t('set.language') }, on: { change: async (e) => { s.lang = e.target.value; if (s.lang === 'ar' && !s._digitsSet) s.digits = 'arabic'; app.save(); await loadLang(s.lang); app.applyLook(); app.refresh(); } } },
        ...Object.entries(LANGS).map(([k, v]) => h('option', { value: k, selected: k === s.lang }, v.n)))),
    s.lang === 'ar' ? h('div.field', h('div.label', t('set.digits')), seg([['arabic', '٠١٢٣'], ['western', '0123']], s.digits, (v) => { s.digits = v; s._digitsSet = true; app.save(); app.applyLook(); app.refresh(); }, t('set.digits'))) : null,
  ));

  // الصوت
  const sfxRange = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.sfx, aria: { label: t('set.sfx') }, on: { input: (e) => { s.sfx = +e.target.value; setLevels({ sfx: s.sfx }); }, change: () => { app.save(); sfx.correct(); } } });
  const musRange = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.music, aria: { label: t('set.music') }, on: { input: (e) => { s.music = +e.target.value; setLevels({ music: s.music }); }, change: () => { app.save(); if (s.music > 0) startMusic(); else stopMusic(); } } });
  el.append(h('section.card',
    h('h2.section-title', t('set.sound')),
    h('div.field', h('div.label', h('span', icon('volume'), ' ', t('set.sfx'))), sfxRange),
    h('div.field', h('div.label', h('span', icon('music'), ' ', t('set.music'))), musRange),
    row(t('set.haptics'), hapticsSupported() ? null : t('set.hapticsNA'), hapticsSupported() ? sw(s.haptics, t('set.haptics'), (v) => { s.haptics = v; app.save(); app.applyLook(); buzz(30); }) : h('span.faint', '—'))));

  // سهولة الاستخدام
  el.append(h('section.card',
    h('h2.section-title', t('set.accessibility')),
    h('div.field', h('div.label', t('set.motion')), seg([['system', t('set.motionSystem')], ['reduce', t('set.motionReduce')], ['full', t('set.motionFull')]], s.motion || 'system', (v) => { s.motion = v; app.save(); app.applyLook(); }, t('set.motion'))),
    row(t('set.contrast'), null, sw(s.contrast, t('set.contrast'), (v) => { s.contrast = v; app.save(); app.applyLook(); })),
    row(t('set.bigText'), null, sw(s.bigText, t('set.bigText'), (v) => { s.bigText = v; app.save(); app.applyLook(); })),
    row(t('set.autoSubmit'), t('set.autoSubmitSub'), sw(s.autoSubmit !== false, t('set.autoSubmit'), (v) => { s.autoSubmit = v; app.save(); })),
    row(t('set.analytics'), t('set.analyticsSub'), sw(s.analytics !== false, t('set.analytics'), (v) => { analytics.setEnabled(app, v); })),
    h('button.btn.block', { id: 'settingsShop', style: { marginTop: '10px' }, on: { click: () => { sfx.tap(); app.go('shop'); } } }, '🛍️ ', t('shop.title') + ' · ' + t('shop.restore')),
    ads.privacyOptionsRequired() ? h('button.btn.block', { style: { marginTop: '10px' }, on: { click: () => ads.showPrivacyOptions() } }, t('ads.privacy')) : null,
    h('button.btn.block', { style: { marginTop: '10px' }, on: { click: () => { sfx.tap(); app.go('rainPlay', { kind: 'tutorial', args: {} }); } } }, icon('book'), t('set.tutorial'))));

  // الملفات الشخصية
  el.append(h('section.card',
    h('h2.section-title', t('set.profiles'), h('small', profile?.name || t('prof.player'))),
    h('button.btn.block', { id: 'openProfiles', on: { click: () => { sfx.tap(); app.go('profiles'); } } }, icon('users'), t('prof.title'))));

  // البيانات
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, on: { change: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!(await app.confirm({ title: t('set.import'), body: t('set.importConfirm'), danger: true }))) return;
    try { const txt = await f.text(); app.data = app.store.importData(app.pid, txt); app.applyLook(); toast(t('set.importOk')); app.refresh(); }
    catch { toast(t('set.importBad'), { kind: 'bad' }); }
  } } });
  el.append(h('section.card',
    h('h2.section-title', t('set.data')),
    h('p.note', t('set.dataNote')),
    app.store.persistent ? null : h('p.note.warn', t('set.dataNoPersist')),
    h('div.btn-row',
      h('button.btn', { on: { click: () => {
        sfx.tap();
        const blob = new Blob([JSON.stringify(app.store.exportData(app.pid))], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `qatra-${todayStr()}.json` });
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      } } }, icon('download'), t('set.export')),
      h('button.btn', { on: { click: () => fileIn.click() } }, icon('upload'), t('set.import'))),
    fileIn,
    h('button.btn.danger.block', { style: { marginTop: '10px' }, on: { click: async () => {
      if (!(await app.confirm({ title: t('set.reset'), body: t('set.resetConfirm'), danger: true }))) return;
      const keep = { ...app.data.settings };
      app.data = newProfileData(keep.lang); app.data.settings = { ...app.data.settings, ...keep, tutorialDone: true };
      app.store.clearActive(app.pid); app.save(); app.applyLook(); toast(t('set.resetDone')); app.refresh();
    } } }, t('set.reset'))));

  el.append(h('section.card', h('h2.section-title', t('set.about')),
    h('p.note', t('app.name') + ' — ', t('app.tagline')), h('p.note', tRaw('set.credits')), h('p.faint', t('set.version', { v: VERSION }))));
  return { el };
});

/* ---------------- الملفات الشخصية ---------------- */
registerScreen('profiles', (app, params) => {
  const gate = !!params.gate;
  const el = h('main', gate ? h('header.topbar', h('h1', t('prof.title'))) : topbar(t('prof.title')));
  const list = h('section.card');
  el.append(list);
  function paint() {
    clear(list);
    const cur = app.store.currentId();
    for (const p of app.store.profiles()) {
      const d = app.store.load(p.id);
      const lv = levelFromXp(d.xp).level;
      const isCur = p.id === cur && !gate;
      list.appendChild(h('div.row',
        h('span.avatar', { html: mascotSVG({ skin: d.cosmetics.skin, acc: d.cosmetics.acc, size: 40, label: '' }) }),
        h('div.grow', h('div.t', p.name || t('prof.player')), h('div.d', `${t('home.level', { n: lv })}${p.hash ? ' · 🔒 ' + t('prof.protected') : ''}${isCur ? ' · ' + t('prof.current') : ''}`)),
        isCur ? null : h('button.btn.sm.primary', { on: { click: async () => { sfx.tap(); await app.switchProfile(p.id); } } }, t('prof.switch')),
        gate ? null : h('button.icon-btn', { aria: { label: t('prof.delete') + ' ' + (p.name || '') }, on: { click: () => del(p) } }, icon('close'))));
    }
  }
  async function del(p) {
    if (!(await app.confirm({ title: t('prof.delete'), body: t('prof.deleteConfirm', { name: p.name || t('prof.player') }), danger: true, ok: t('prof.delete') }))) return;
    if (p.hash && !(await app.askPassword(p.id))) return;
    const wasCurrent = p.id === app.pid;
    app.store.deleteProfile(p.id);
    if (wasCurrent) { app.loadProfile(app.store.currentId()); }
    paint();
  }
  paint();
  const nameIn = h('input.input', { maxlength: 20, placeholder: t('prof.name'), aria: { label: t('prof.name') } });
  const passIn = h('input.input', { type: 'password', autocomplete: 'new-password', placeholder: t('prof.pass'), aria: { label: t('prof.pass') } });
  const err = h('p.note', { role: 'alert', style: { color: 'var(--bad)' } });
  el.append(h('section.card.section', h('h2.section-title', t('prof.add')),
    h('div.field', nameIn), h('div.field', passIn, h('div.hint', t('prof.passHint'))), err,
    h('button.btn.primary.block', { on: { click: async () => {
      const name = nameIn.value.trim();
      if (!name) { err.textContent = t('prof.needName'); return; }
      if (passIn.value && passIn.value.length < 4) { err.textContent = t('prof.tooShort'); return; }
      const extra = { lang: app.data.settings.lang, settings: { digits: app.data.settings.digits } };
      if (passIn.value) Object.assign(extra, await hashPass(passIn.value));
      const id = app.store.createProfile(name, extra);
      app.store.setCurrent(id, { remember: true });
      app.loadProfile(id);
      sfx.correct();
      app.go('home', {}, { root: true });
    } } }, icon('plus'), t('prof.create'))));
  if (!gate && app.profile?.hash) {
    el.append(h('button.btn.block.ghost', { style: { marginTop: '12px' }, on: { click: () => { app.store.lock(app.pid); toast('🔒'); app.go('profiles', { gate: true }, { root: true }); } } }, icon('lock'), t('prof.lock')));
  }
  return { el, onBack: gate ? () => true : undefined };
});
