/* =========================================================================
   تطبيق Math Clash — الحالة العامة، التنقل بين الشاشات، الحفظ، والنوافذ.
   ========================================================================= */
import { createBackend, createStore, verifyPass } from './core/storage.js';
import { ensureMissions, todayStr, levelFromXp } from './core/progression.js';
import { setLocale, t, LANGS, detectLang, isRtl } from './i18n.js';
import { h, clear, icon } from './ui/dom.js';
import { setLevels, setHaptics, sfx, unlockAudio, startMusic, pauseAll, resumeAll } from './ui/audio.js';
import { setMotion } from './ui/fx.js';
import { useIdentity } from './net/online.js';
import * as pgs from './net/playgames.js';
import * as analytics from './net/analytics.js';

export const VERSION = '2.0.0';

const screens = {};
export function registerScreen(name, factory) { screens[name] = factory; }

export const app = {
  store: null,
  pid: null,
  data: null,
  stack: [],
  current: null,
  root: null,
  nav: null,
  migrated: 0,

  get settings() { return this.data.settings; },
  get profile() { return this.store.currentProfile(); },
  get playerName() { const n = (this.profile?.name || '').trim(); return n; },
  get level() { return levelFromXp(this.data.xp); },

  /** حفظ بيانات اللاعب فورًا */
  save() {
    if (!this.pid || !this.data) return;
    const ok = this.store.save(this.pid, this.data);
    if (!ok) console.warn('save failed (storage full or blocked)');
    pgs.scheduleSync(this);
  },

  loadProfile(id) {
    this.pid = id;
    this.data = this.store.load(id);
    useIdentity(this.data);
    if (ensureMissions(this.data, todayStr(), id)) this.save();
    this.applyLook();
  },

  /** يطبّق اللغة والسمة وسهولة الاستخدام على المستند */
  applyLook() {
    const s = this.data.settings;
    if (!LANGS[s.lang]) s.lang = 'ar';
    if (s.lang !== 'ar' && s.digits === 'arabic') s.digits = 'western';
    setLocale(s.lang, s.digits);
    const de = document.documentElement;
    de.lang = s.lang;
    de.dir = isRtl() ? 'rtl' : 'ltr';
    de.dataset.theme = this.data.cosmetics.theme || 'rain';
    de.dataset.contrast = s.contrast ? '1' : '0';
    de.dataset.bigtext = s.bigText ? '1' : '0';
    setMotion(s.motion || 'system');
    setLevels({ sfx: s.sfx, music: s.music });
    setHaptics(s.haptics);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(de).getPropertyValue('--bg').trim() || '#0A1230';
  },

  /* ---------------- التنقل ---------------- */
  go(name, params = {}, { replace = false, root = false } = {}) {
    if (!screens[name]) throw new Error('screen ' + name);
    if (root) this.stack = [];
    else if (replace) this.stack.pop();
    this.stack.push({ name, params });
    this.render();
    try { history.pushState({ mc: this.stack.length }, ''); } catch { /* ignore */ }
  },
  back() {
    if (this.stack.length <= 1) { if (this.current?.name !== 'home') this.go('home', {}, { root: true }); return false; }
    this.stack.pop();
    this.render();
    return true;
  },
  /** يعيد رسم الشاشة الحالية (مثلًا بعد تغيير اللغة) */
  refresh() { this.render(true); },

  render(keepScroll = false) {
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    if (this.current?.destroy) { try { this.current.destroy(); } catch (e) { console.error(e); } }
    const y = keepScroll ? window.scrollY : 0;
    const scr = screens[top.name](this, top.params || {});
    scr.name = top.name;
    this.current = scr;
    clear(this.root);
    scr.el.classList.add('view');
    if (!keepScroll) scr.el.classList.add('enter');
    if (!scr.nav) scr.el.classList.add('no-nav');
    this.root.appendChild(scr.el);
    this.renderNav(scr.nav);
    window.scrollTo(0, y);
    if (!keepScroll) {
      const focusTarget = scr.el.querySelector('[data-autofocus]') || scr.el.querySelector('h1');
      if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
    }
    if (scr.afterMount) scr.afterMount();
  },

  renderNav(active) {
    clear(this.nav);
    if (!active) { this.nav.hidden = true; return; }
    this.nav.hidden = false;
    const items = [['home', 'home', 'nav.home'], ['journey', 'map', 'nav.journey'], ['online', 'users', 'nav.online'], ['progress', 'chart', 'nav.progress'], ['locker', 'trophy', 'nav.locker']];
    const inner = h('div.inner');
    for (const [name, ic, key] of items) {
      inner.appendChild(h('button', {
        aria: { current: active === name ? 'page' : null }, 'data-nav': name,
        on: { click: () => { sfx.tap(); if (active !== name || this.stack.length > 1) this.go(name, {}, { root: true }); } },
      }, icon(ic), h('span', t(key))));
    }
    this.nav.appendChild(inner);
  },

  /* ---------------- النوافذ ---------------- */
  modal(build, { onClose, dismissible = true } = {}) {
    const back = h('div.modal-backdrop', { role: 'presentation' });
    const box = h('div.modal', { role: 'dialog', aria: { modal: 'true' } });
    back.appendChild(box);
    const prevFocus = document.activeElement;
    const close = (v) => {
      if (!back.isConnected) return;
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      if (onClose) onClose(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); close(null); }
      if (e.key === 'Tab') {
        const f = [...box.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    if (dismissible) back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    document.addEventListener('keydown', onKey, true);
    build(box, close);
    document.body.appendChild(back);
    const f = box.querySelector('[data-autofocus]') || box.querySelector('input, button');
    if (f) f.focus({ preventScroll: true });
    app._modalClose = close;
    return close;
  },
  confirm({ title, body, ok, cancel, danger = false }) {
    return new Promise((resolve) => {
      this.modal((box, close) => {
        box.append(
          h('h2', title),
          body ? h('p.note', body) : null,
          h('div.stack',
            h('button.btn.block' + (danger ? '.danger' : '.primary'), { 'data-autofocus': true, on: { click: () => { sfx.tap(); close(true); } } }, ok || t('common.confirm')),
            h('button.btn.block.ghost', { on: { click: () => { sfx.tap(); close(false); } } }, cancel || t('common.cancel'))),
        );
      }, { onClose: (v) => resolve(!!v) });
    });
  },

  /** فتح ملف شخصي (قد يطلب كلمة المرور) */
  async switchProfile(id) {
    if (this.store.needsUnlock(id)) {
      const ok = await this.askPassword(id);
      if (!ok) return false;
    } else this.store.setCurrent(id);
    this.loadProfile(id);
    this.go('home', {}, { root: true });
    return true;
  },
  askPassword(id) {
    const p = this.store.profiles().find((x) => x.id === id);
    return new Promise((resolve) => {
      this.modal((box, close) => {
        const inp = h('input.input', { type: 'password', autocomplete: 'current-password', 'data-autofocus': true, aria: { label: t('prof.pass') } });
        const rem = h('button.switch', { role: 'switch', aria: { checked: 'true', label: t('prof.remember') }, on: { click: () => rem.setAttribute('aria-checked', rem.getAttribute('aria-checked') === 'true' ? 'false' : 'true') } });
        const err = h('p.note', { role: 'alert', style: { color: 'var(--bad)', minHeight: '1.5em' } });
        const go = async () => {
          if (await verifyPass(inp.value, p)) {
            this.store.setCurrent(id, { remember: rem.getAttribute('aria-checked') === 'true' });
            close(true);
          } else { err.textContent = t('prof.wrongPass'); sfx.wrong(); inp.select(); }
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        box.append(h('h2', t('prof.unlockTitle')), h('p.note', t('prof.enterPass', { name: p.name || t('prof.player') })), inp,
          h('div.row', h('div.grow', h('div.t', t('prof.remember'))), rem), err,
          h('div.stack', h('button.btn.primary.block', { on: { click: go } }, t('prof.unlock')), h('button.btn.ghost.block', { on: { click: () => close(false) } }, t('common.cancel'))));
      }, { onClose: (v) => resolve(!!v) });
    });
  },
};

/* ---------------- الإقلاع ---------------- */
export async function boot() {
  app.root = document.getElementById('app');
  app.nav = document.getElementById('nav');
  const be = createBackend();
  app.store = createStore(be, { lang: detectLang() });
  const res = app.store.init();
  app.migrated = res.migrated;
  let id = app.store.currentId();
  if (app.store.needsUnlock(id)) {
    // ملف محمي: نعرض شاشة اختيار/فتح الملف
    app.loadProfile(id);
    app.go('profiles', { gate: true }, { root: true });
  } else {
    app.loadProfile(id);
    app.go('home', {}, { root: true });
  }
  // إحصاءات مجهولة: يوم نشاط + مصدر الزيارة (يمكن إيقافها من الإعدادات)
  analytics.configure(app);
  if (navigator.onLine !== false) analytics.flush();
  document.addEventListener('visibilitychange', () => { if (document.hidden) analytics.flush(); });
  // تطبيق Android: الإعلانات (بعد الموافقة) واسترجاع المشتريات من Google Play
  import('./net/ads.js').then((m) => m.init()).catch(() => {});
  import('./net/billing.js').then((m) => m.available() && m.restore(app)).catch(() => {});
  // تطبيق Android: Google Play Games (دخول صامت، ربط الحساب، الإنجازات ولوحات الصدارة)
  pgs.init(app).catch(() => {});

  // أول لمسة تفتح الصوت (سياسة المتصفحات)
  const unlock = () => { unlockAudio(); if (app.settings.music > 0) startMusic(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // زر الرجوع في المتصفح/أندرويد
  window.addEventListener('popstate', () => {
    if (document.querySelector('.modal-backdrop')) { app._modalClose && app._modalClose(null); history.pushState({ mc: 1 }, ''); return; }
    const handled = app.current?.onBack ? app.current.onBack() : false;
    if (!handled) {
      if (app.stack.length > 1 || app.current?.name !== 'home') app.back();
      else return; // في الرئيسية: نسمح بالخروج
    }
    try { history.pushState({ mc: app.stack.length }, ''); } catch { /* ignore */ }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseAll(); app.current?.onHide?.(); }
    else { resumeAll(); app.current?.onShow?.(); }
  });
  window.addEventListener('pagehide', () => { app.current?.onHide?.(); app.save(); });

  // تحديث اليوم (المهام والتحدي اليومي) إن بقي التطبيق مفتوحًا بعد منتصف الليل
  setInterval(() => {
    if (ensureMissions(app.data, todayStr(), app.pid)) { app.save(); if (app.current?.name === 'home') app.refresh(); }
  }, 60000);
}
