/* =========================================================================
   لوحة إدارة Math Clash — للمالك فقط (رمز ADMIN_TOKEN من إعدادات الخادم).
   البطولات حسب المناسبات والمواسم، الإعلانات، المواسم، وإدارة اللاعبين.
   ========================================================================= */
import { h, clear } from '../ui/dom.js';
import { setLocale } from '../i18n.js';

setLocale('ar', 'western');
const root = document.getElementById('admin');
let token = sessionStorage.getItem('mc_admin') || '';
let tab = 'dash';
let OCC = {};

async function api(method, path, body) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'http_' + r.status), { status: r.status });
  return j;
}
const ERR = { bad_dates: 'تاريخ النهاية يجب أن يكون بعد البداية', name_required: 'الاسم مطلوب', text_required: 'النص مطلوب', admin_only: 'رمز الإدارة غير صحيح' };
const msg = (e) => ERR[e.message] || 'خطأ: ' + e.message;
const fmt = (ms) => new Date(ms).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
const toLocalInput = (ms) => { const d = new Date(ms - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const fromLocalInput = (v) => new Date(v).getTime();
const STATUS = { active: 'جارية', upcoming: 'قادمة', ended: 'منتهية', disabled: 'معطّلة' };
function flash(text, bad = false) {
  const el = h('div.toast.show' + (bad ? '.bad' : ''), { role: 'status' }, text);
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

/* ---------------- الدخول ---------------- */
function login(err = '') {
  clear(root);
  const inp = h('input.input', { type: 'password', placeholder: 'رمز الإدارة (ADMIN_TOKEN)', autocomplete: 'current-password', aria: { label: 'رمز الإدارة' } });
  const go = async () => {
    token = inp.value.trim();
    try { await api('GET', '/api/admin/stats'); sessionStorage.setItem('mc_admin', token); main(); }
    catch (e) { login(msg(e)); }
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.append(h('section.card', { style: { maxWidth: '420px', margin: '12vh auto 0' } },
    h('h1', { style: { fontFamily: 'var(--font-display)', marginTop: 0 } }, '🛠️ لوحة إدارة Math Clash'),
    h('p.note', 'أدخل رمز الإدارة المضبوط في متغير البيئة ADMIN_TOKEN على الخادم.'), inp,
    err ? h('p.note', { style: { color: 'var(--bad)' } }, err) : null,
    h('button.btn.primary.block', { style: { marginTop: '12px' }, on: { click: go } }, 'دخول')));
  inp.focus();
}

/* ---------------- الهيكل ---------------- */
async function main() {
  try { OCC = (await api('GET', '/api/admin/occasions')).occasions; } catch (e) { return login(msg(e)); }
  clear(root);
  const tabs = [['dash', '📊 نظرة عامة'], ['stats', '📈 الإحصاءات'], ['tour', '🏆 البطولات'], ['season', '🗓️ المواسم'], ['ann', '📢 الإعلانات'], ['players', '👥 اللاعبون']];
  const nav = h('nav.adm-tabs');
  const body = h('div');
  const paintNav = () => { clear(nav); for (const [k, l] of tabs) nav.append(h('button', { aria: { current: tab === k ? 'page' : null }, on: { click: () => { tab = k; paintNav(); show(); } } }, l)); };
  const show = () => ({ dash, stats, tour, season, ann, players })[tab](body);
  root.append(h('header.adm-head', h('h1', '🛠️ إدارة Math Clash'), h('a.btn.sm', { href: './' }, 'فتح اللعبة'),
    h('button.btn.sm.ghost', { on: { click: () => { sessionStorage.removeItem('mc_admin'); token = ''; login(); } } }, 'خروج')), nav, body);
  paintNav(); show();
}

/* ---------------- نظرة عامة ---------------- */
async function dash(box) {
  clear(box).append(h('p.note', 'جارٍ التحميل…'));
  const s = await api('GET', '/api/admin/stats');
  const kpi = (v, l) => h('div.stat', h('div.v', String(v)), h('div.l', l));
  clear(box).append(h('div.adm-grid', kpi(s.players, 'لاعب مسجّل'), kpi(s.active24h, 'نشط آخر 24 ساعة'), kpi(s.online, 'متصل الآن'), kpi(s.runsToday, 'جولة اليوم'), kpi(s.invalidToday, 'جولة مرفوضة اليوم')),
    h('section.card.section', h('h2.section-title', 'الموسم الحالي'), h('p', h('b', s.season.name_ar), ' — منذ ', fmt(s.season.starts))),
    h('section.card.section', h('h2.section-title', 'كيف تعمل البطولات؟'), h('ul.note',
      h('li', 'أنشئ بطولة لأي مناسبة واختر وقت البداية والنهاية — تظهر تلقائيًا للاعبين في الرئيسية والأونلاين عند موعدها.'),
      h('li', 'كل نتيجة يعيد الخادم حسابها من سجل اللعب، والجولات ذات السرعة غير البشرية تُستبعد.'),
      h('li', 'عند انتهاء البطولة تُمنح الجائزة تلقائيًا لأفضل اللاعبين وتظهر في «جوائزي».'))));
}

/* ---------------- الإحصاءات المجهولة ---------------- */
async function stats(box) {
  clear(box).append(h('p.note', 'جارٍ التحميل…'));
  const [a, pur] = await Promise.all([api('GET', '/api/admin/analytics?days=14'), api('GET', '/api/admin/purchases').catch(() => null)]);
  const pct = (v) => (v == null ? '—' : v + '%');
  const max = Math.max(1, ...a.days.map((d) => d.dau));
  const table = h('table.adm-table', h('thead', h('tr', h('th', 'اليوم'), h('th', 'نشطون'), h('th', 'جدد'), h('th', 'عادوا اليوم التالي'), h('th', 'عادوا بعد ٧ أيام'))),
    h('tbody', ...a.days.slice().reverse().map((d) => h('tr', h('td', d.day), h('td', h('span.adm-bar', { style: { '--w': (d.dau / max) * 100 + '%' } }, String(d.dau))), h('td', String(d.fresh)), h('td', pct(d.d1)), h('td', pct(d.d7))))));
  const list = (title, rows, label = (k) => k) => h('section.card.section', h('h2.section-title', title),
    rows.length ? h('table.adm-table', h('tbody', ...rows.map((r) => h('tr', h('td', label(r.k)), h('td', String(r.n)))))) : h('p.note', 'لا بيانات بعد'));
  const EV = { round: 'جولات منتهية', share_daily: 'مشاركة التحدي اليومي', share_challenge: 'تحدي صديق', challenge_play: 'لعب تحدٍّ من رابط', club_create: 'إنشاء نادٍ', club_join: 'انضمام لنادٍ', online_match: 'مباراة أونلاين', ad_rewarded: 'إعلان بمكافأة', ad_interstitial: 'إعلان بيني', purchase: 'عملية شراء', shop_open: 'فتح المتجر', app_banner: 'ضغط «حمّل التطبيق»' };
  clear(box).append(
    h('p.note', 'إحصاءات مجهولة: معرّف تثبيت عشوائي ويوم النشاط فقط. «عادوا اليوم التالي» = نسبة من ثبّتوا في ذلك اليوم ثم فتحوا اللعبة في اليوم التالي — أهم مؤشر لنجاح اللعبة (٣٥٪+ ممتاز للألعاب الخفيفة).'),
    h('section.card.section', h('h2.section-title', 'آخر ١٤ يومًا'), table),
    pur ? h('section.card.section', h('h2.section-title', 'المبيعات (المتحقق منها على الخادم)'),
      h('div.adm-grid', h('div.stat', h('div.v', String(pur.total)), h('div.l', 'عمليات شراء')), h('div.stat', h('div.v', String(pur.last30)), h('div.l', 'آخر ٣٠ يومًا')), h('div.stat', h('div.v', String(pur.test)), h('div.l', 'شراء تجريبي'))),
      pur.byProduct.length ? h('table.adm-table', h('tbody', ...pur.byProduct.map((r) => h('tr', h('td', r.k), h('td', String(r.n)))))) : h('p.note', 'لا مبيعات بعد. الإيرادات الفعلية تجدها في Play Console و AdMob.')) : null,
    h('div.adm-cols', list('مصادر اللاعبين الجدد (ref)', a.sources), list('المنصة', a.platforms, (k) => ({ app: 'تطبيق Android', web: 'متصفح' })[k] || k),
      list('اللغات', a.langs), list('الأحداث', a.events, (k) => EV[k] || k)));
}

/* ---------------- البطولات ---------------- */
async function tour(box) {
  clear(box).append(h('p.note', 'جارٍ التحميل…'));
  const { tournaments } = await api('GET', '/api/admin/tournaments');
  clear(box).append(h('button.btn.gold', { id: 'newTournament', on: { click: () => editTournament(box, null) } }, '➕ بطولة جديدة'));
  const list = h('section.card.section', h('h2.section-title', 'كل البطولات', h('small', String(tournaments.length))));
  if (!tournaments.length) list.append(h('p.note', 'لا توجد بطولات بعد.'));
  for (const t of tournaments) {
    list.append(h('div.adm-row', h('span', { style: { fontSize: '1.8rem' } }, t.icon),
      h('div.grow', h('div.t', t.name_ar, ' ', h('span.st-' + t.status, '• ' + STATUS[t.status])),
        h('div.d', `${fmt(t.starts)} ← ${fmt(t.ends)}`),
        h('div.d', `${t.rules.mode === 'survival' ? 'بقاء' : 'عاصفة ' + t.rules.seconds + ' ث'} · ${t.rules.diff} · محاولات: ${t.rules.attempts || 'غير محدودة'} · ${t.rules.fixedSeed ? 'نفس القطرات للجميع' : 'قطرات مختلفة'} · جائزة لأفضل ${t.prize.topN}`)),
      h('div.adm-actions',
        h('button.btn.sm', { on: { click: () => editTournament(box, t) } }, 'تعديل'),
        h('button.btn.sm', { on: { click: () => showBoard(t) } }, 'الترتيب'),
        t.status === 'active' ? h('button.btn.sm', { on: { click: async () => { if (confirm('إنهاء البطولة الآن ومنح الجوائز؟')) { await api('POST', `/api/admin/tournaments/${t.id}/end`); flash('أُنهيت البطولة'); tour(box); } } } }, 'إنهاء الآن') : null,
        t.status !== 'ended' ? h('button.btn.sm', { on: { click: async () => { await api('PUT', `/api/admin/tournaments/${t.id}`, { enabled: t.status === 'disabled' }); tour(box); } } }, t.status === 'disabled' ? 'تفعيل' : 'تعطيل') : null,
        h('button.btn.sm.danger', { on: { click: async () => { if (confirm('حذف البطولة نهائيًا؟')) { await api('DELETE', `/api/admin/tournaments/${t.id}`); tour(box); } } } }, 'حذف'))));
  }
  box.append(list);
}

async function showBoard(t) {
  const lb = await api('GET', `/api/admin/tournaments/${t.id}/leaderboard`);
  const back = h('div.modal-backdrop', { on: { click: (e) => { if (e.target === back) back.remove(); } } }, h('div.modal', h('h2', `${t.icon} ${t.name_ar}`),
    lb.list.length ? lb.list.map((r) => h('div.lb-row', h('span.rk', String(r.rank)), h('span'), h('span.nm', r.name), h('b', String(r.score)))) : h('p.note', 'لا نتائج بعد'),
    h('button.btn.block', { style: { marginTop: '12px' }, on: { click: () => back.remove() } }, 'إغلاق')));
  document.body.append(back);
}

function editTournament(box, t) {
  const now = Date.now();
  const v = t ? { ...t, rules: { ...t.rules }, prize: { ...t.prize } } : {
    occasion: 'custom', name_ar: '', name_en: '', desc_ar: '', desc_en: '', starts: now, ends: now + 3 * 864e5,
    rules: { mode: 'storm', diff: 'medium', seconds: 60, attempts: 3, fixedSeed: true, specials: true }, prize: { topN: 3, label_ar: 'بطل البطولة', label_en: 'Champion' }, enabled: true, icon: null, color: null };
  clear(box);
  const inp = (key, label, attrs = {}, obj = v) => {
    const el = h('input.input', { value: obj[key] ?? '', ...attrs, aria: { label }, on: { input: (e) => { obj[key] = attrs.type === 'number' ? +e.target.value : e.target.value; preview(); } } });
    return h('div.field', h('label', label), el);
  };
  const sel = (key, label, opts, obj) => h('div.field', h('label', label), h('select.input', { aria: { label }, on: { change: (e) => { obj[key] = opts.find((o) => String(o[0]) === e.target.value)[0]; preview(); } } },
    ...opts.map(([val, txt]) => h('option', { value: String(val), selected: obj[key] === val }, txt))));
  const chk = (key, label, obj) => h('label.row', h('div.grow.t', label), h('input', { type: 'checkbox', checked: !!obj[key], on: { change: (e) => { obj[key] = e.target.checked; preview(); } } }));

  const occBox = h('div.occ-pick', { role: 'group', aria: { label: 'المناسبة' } });
  const paintOcc = () => {
    clear(occBox);
    for (const [k, o] of Object.entries(OCC)) {
      occBox.append(h('button', { type: 'button', style: { '--oc': o.color }, aria: { pressed: String(v.occasion === k) }, on: { click: () => {
        v.occasion = k;
        if (!t && (!v.name_ar || Object.values(OCC).some((x) => v.name_ar === 'بطولة ' + x.ar))) { v.name_ar = 'بطولة ' + o.ar; v.name_en = o.en + ' Cup'; nameAr.querySelector('input').value = v.name_ar; nameEn.querySelector('input').value = v.name_en; }
        v.icon = null; v.color = null; paintOcc(); preview();
      } } }, h('span.oi', o.icon), o.ar));
    }
  };
  paintOcc();
  const nameAr = inp('name_ar', 'اسم البطولة (عربي)', { maxlength: 60 });
  const nameEn = inp('name_en', 'الاسم بالإنجليزية (اختياري)', { maxlength: 60 });
  const startsIn = h('input.input', { type: 'datetime-local', value: toLocalInput(v.starts), aria: { label: 'البداية' }, on: { change: (e) => { v.starts = fromLocalInput(e.target.value); preview(); } } });
  const endsIn = h('input.input', { type: 'datetime-local', value: toLocalInput(v.ends), aria: { label: 'النهاية' }, on: { change: (e) => { v.ends = fromLocalInput(e.target.value); preview(); } } });
  const quick = (label, startMs, durMs) => h('button.btn.sm', { type: 'button', on: { click: () => { v.starts = startMs; v.ends = startMs + durMs; startsIn.value = toLocalInput(v.starts); endsIn.value = toLocalInput(v.ends); preview(); } } }, label);
  const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
  const fri = new Date(); fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7 || 7)); fri.setHours(16, 0, 0, 0);

  const prev = h('div');
  function preview() {
    const o = OCC[v.occasion] || OCC.custom;
    clear(prev).append(h('div.event-card', { style: { '--ec': v.color || o.color } }, h('span.ei', v.icon || o.icon),
      h('div.grow', h('div.en', v.name_ar || '—'), h('div.ed', `${fmt(v.starts)} ← ${fmt(v.ends)}`)), h('span.chip', 'معاينة')));
  }
  preview();
  const err = h('p.note', { style: { color: 'var(--bad)' } });
  box.append(h('section.card',
    h('h2.section-title', t ? 'تعديل البطولة' : 'بطولة جديدة'),
    h('div.field', h('div.label', 'المناسبة'), occBox),
    h('div.adm-form', nameAr, nameEn, inp('desc_ar', 'الوصف (عربي)', { maxlength: 300 }), inp('desc_en', 'الوصف (إنجليزي)', { maxlength: 300 }),
      h('div.field', h('label', 'تبدأ'), startsIn), h('div.field', h('label', 'تنتهي'), endsIn),
      h('div.field.full', h('div.label', 'اختصارات المواعيد'), h('div.quick-dates', quick('الآن · 3 أيام', Date.now(), 3 * 864e5), quick('الآن · أسبوع', Date.now(), 7 * 864e5),
        quick('غدًا · 24 ساعة', tomorrow.getTime(), 864e5), quick('الجمعة · عطلة الأسبوع', fri.getTime(), 2 * 864e5), quick('شهر كامل', Date.now(), 30 * 864e5))),
      sel('mode', 'النمط', [['storm', 'عاصفة (أعلى نقاط في وقت محدد)'], ['survival', 'بقاء (حتى سقوط 3 قطرات)']], v.rules),
      sel('diff', 'الصعوبة', [['easy', 'سهل'], ['medium', 'متوسط'], ['hard', 'صعب'], ['expert', 'خبير']], v.rules),
      sel('seconds', 'مدة العاصفة', [[30, '30 ثانية'], [60, 'دقيقة'], [90, '90 ثانية'], [120, 'دقيقتان'], [180, '3 دقائق']], v.rules),
      sel('attempts', 'عدد المحاولات', [[1, 'محاولة واحدة'], [3, '3 محاولات'], [5, '5 محاولات'], [10, '10 محاولات'], [0, 'غير محدودة']], v.rules),
      inp('topN', 'عدد الفائزين بالجائزة', { type: 'number', min: 1, max: 100 }, v.prize), inp('label_ar', 'اسم الجائزة', { maxlength: 60 }, v.prize),
      h('div.full', chk('fixedSeed', 'نفس القطرات لكل اللاعبين (أعدل للمنافسة)', v.rules), chk('specials', 'قطرات خاصة ⭐❄️⚡', v.rules), chk('enabled', 'مفعّلة', v))),
    h('div.field', h('div.label', 'المعاينة'), prev), err,
    h('div.btn-row', h('button.btn.primary', { id: 'saveTournament', on: { click: async () => {
      try {
        if (t) await api('PUT', `/api/admin/tournaments/${t.id}`, v); else await api('POST', '/api/admin/tournaments', v);
        flash('تم الحفظ ✓'); tour(box);
      } catch (e) { err.textContent = msg(e); }
    } } }, '💾 حفظ'), h('button.btn.ghost', { on: { click: () => tour(box) } }, 'إلغاء'))));
}

/* ---------------- المواسم ---------------- */
async function season(box) {
  const { seasons, current } = await api('GET', '/api/admin/seasons');
  const v = { name_ar: '', name_en: '', color: '#38D6F5' };
  const err = h('p.note', { style: { color: 'var(--bad)' } });
  clear(box).append(h('section.card', h('h2.section-title', 'الموسم الحالي'), h('p', h('b', current.name_ar), ' — منذ ', fmt(current.starts)),
    h('p.note', 'بدء موسم جديد يُنهي الحالي ويبدأ تصنيف المباريات السريعة من جديد (1000) لكل اللاعبين. النتائج الأسبوعية والبطولات لا تتأثر.')),
  h('section.card.section', h('h2.section-title', 'بدء موسم جديد'),
    h('div.adm-form', h('div.field', h('label', 'اسم الموسم'), h('input.input', { placeholder: 'موسم الشتاء', on: { input: (e) => { v.name_ar = e.target.value; } } })),
      h('div.field', h('label', 'بالإنجليزية'), h('input.input', { placeholder: 'Winter Season', on: { input: (e) => { v.name_en = e.target.value; } } })),
      h('div.field', h('label', 'اللون'), h('input.input', { type: 'color', value: v.color, on: { input: (e) => { v.color = e.target.value; } } }))), err,
    h('button.btn.gold', { on: { click: async () => { if (!confirm('بدء موسم جديد الآن؟')) return; try { await api('POST', '/api/admin/seasons', v); flash('بدأ الموسم الجديد'); season(box); } catch (e) { err.textContent = msg(e); } } } }, '🚀 ابدأ الموسم')),
  h('section.card.section', h('h2.section-title', 'السجل'), ...seasons.map((s) => h('div.adm-row', h('span.dot.on', { style: { background: s.color } }), h('div.grow', h('div.t', s.name_ar), h('div.d', `${fmt(s.starts)}${s.ends ? ' ← ' + fmt(s.ends) : ' — جارٍ'}`))))));
}

/* ---------------- الإعلانات ---------------- */
async function ann(box) {
  const { announcements } = await api('GET', '/api/admin/announcements');
  const v = { text_ar: '', text_en: '' };
  const err = h('p.note', { style: { color: 'var(--bad)' } });
  clear(box).append(h('section.card', h('h2.section-title', 'إعلان جديد'), h('p.note', 'يظهر في أعلى الرئيسية وصفحة الأونلاين لكل اللاعبين.'),
    h('div.field', h('label', 'النص (عربي)'), h('input.input', { maxlength: 200, on: { input: (e) => { v.text_ar = e.target.value; } } })),
    h('div.field', h('label', 'النص (إنجليزي، اختياري)'), h('input.input', { maxlength: 200, on: { input: (e) => { v.text_en = e.target.value; } } })), err,
    h('button.btn.primary', { on: { click: async () => { try { await api('POST', '/api/admin/announcements', v); flash('نُشر الإعلان'); ann(box); } catch (e) { err.textContent = msg(e); } } } }, '📢 نشر')),
  h('section.card.section', h('h2.section-title', 'الإعلانات'), announcements.length ? announcements.map((a) => h('div.adm-row', h('div.grow', h('div.t', a.text_ar), h('div.d', `${fmt(a.created)} · ${a.active ? 'ظاهر' : 'مخفي'}`)),
    h('div.adm-actions', h('button.btn.sm', { on: { click: async () => { await api('PUT', `/api/admin/announcements/${a.id}`, { active: !a.active }); ann(box); } } }, a.active ? 'إخفاء' : 'إظهار'),
      h('button.btn.sm.danger', { on: { click: async () => { await api('DELETE', `/api/admin/announcements/${a.id}`); ann(box); } } }, 'حذف')))) : h('p.note', 'لا إعلانات')));
}

/* ---------------- اللاعبون ---------------- */
async function players(box) {
  const q = h('input.input', { placeholder: 'ابحث بالاسم أو رمز الصديق', aria: { label: 'بحث' } });
  const list = h('section.card.section');
  const load = async () => {
    const { players: ps } = await api('GET', '/api/admin/players?q=' + encodeURIComponent(q.value));
    clear(list).append(h('h2.section-title', 'اللاعبون', h('small', String(ps.length))));
    for (const p of ps) list.append(h('div.adm-row', h('div.grow', h('div.t', p.name, p.banned ? ' ⛔' : ''), h('div.d', `${p.code} · آخر ظهور ${fmt(p.last_seen)}`)),
      h('div.adm-actions', h('button.btn.sm', { on: { click: async () => { await api('POST', `/api/admin/players/${p.id}/reset-name`); load(); } } }, 'تغيير اسم مسيء'),
        h('button.btn.sm' + (p.banned ? '' : '.danger'), { on: { click: async () => { await api('POST', `/api/admin/players/${p.id}/ban`, { banned: !p.banned }); load(); } } }, p.banned ? 'رفع الإيقاف' : 'إيقاف'))));
  };
  q.addEventListener('input', () => { clearTimeout(q._t); q._t = setTimeout(load, 300); });
  clear(box).append(h('section.card', q), list);
  load();
}

if (token) main(); else login();
