/* مفتاح «التيربو ⚡» المشترك: يحفظ اختيار اللاعب في prefs.turbo.on ويظهر في الرئيسية
   وبطاقة المرحلة وإعداد الوقت والبقاء. التيربو = تسارع مرعب بأرقام سهلة. */
import { h } from './dom.js';
import { sfx, buzz } from './audio.js';
import { t } from '../i18n.js';

export const turboOn = (data) => !!data.prefs?.turbo?.on;

export function turboRow(app, { compact = false, onChange } = {}) {
  const pref = (app.data.prefs.turbo ||= { on: false });
  const sw = h('button.switch', { type: 'button', role: 'switch', aria: { checked: String(!!pref.on), label: t('turbo.title') } });
  const row = h('div.turbo-row' + (compact ? '.compact' : ''), { 'data-on': String(!!pref.on) },
    h('span.turbo-ic', { aria: { hidden: 'true' } }, '⚡'),
    h('div.grow', h('div.t', t('turbo.title')), compact ? null : h('div.d', t('turbo.sub'))), sw);
  const toggle = () => {
    pref.on = !pref.on; app.save();
    sw.setAttribute('aria-checked', String(pref.on)); row.dataset.on = String(pref.on);
    if (pref.on) { sfx.combo(); buzz([10, 30, 10]); } else sfx.tap();
    onChange?.(pref.on);
  };
  row.addEventListener('click', toggle);
  return row;
}
