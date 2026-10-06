/* =========================================================================
   الحفظ المحلي (localStorage) — لا توجد مزامنة سحابية.
   -------------------------------------------------------------------------
   المفاتيح:
     mc2:profiles        قائمة الملفات الشخصية على هذا الجهاز والملف الحالي
     mc2:p:<id>          بيانات اللاعب (الإعدادات، التقدّم، الإحصاءات…)
     mc2:active:<id>     لقطة الجولة الجارية (للاستئناف بعد تحديث الصفحة)
     mc2:migrated        علامة اكتمال الترحيل من النسخة السابقة
   مفاتيح النسخة السابقة (mc_users, mc_prog:<uid> …) لا تُحذف أبدًا،
   فالترحيل غير هدّام ويمكن الرجوع إليه.
   ========================================================================= */
import { newProfileData, normalizeData, DATA_VERSION } from './progression.js';

export const KEYS = {
  profiles: 'mc2:profiles',
  data: (id) => `mc2:p:${id}`,
  active: (id) => `mc2:active:${id}`,
  migrated: 'mc2:migrated',
};

/** واجهة تخزين: localStorage إن توفّر، وإلا ذاكرة مؤقتة (وضع التصفّح الخاص مثلًا) */
export function createBackend(ls = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const mem = new Map();
  let persistent = false;
  try {
    if (ls) { ls.setItem('__mc_t', '1'); ls.removeItem('__mc_t'); persistent = true; }
  } catch { persistent = false; }
  if (persistent) {
    return {
      persistent: true,
      get: (k) => { try { return ls.getItem(k); } catch { return null; } },
      set: (k, v) => { try { ls.setItem(k, v); return true; } catch { return false; } },
      remove: (k) => { try { ls.removeItem(k); } catch { /* ignore */ } },
      keys: () => { const out = []; try { for (let i = 0; i < ls.length; i++) out.push(ls.key(i)); } catch { /* ignore */ } return out; },
    };
  }
  return {
    persistent: false,
    get: (k) => (mem.has(k) ? mem.get(k) : null),
    set: (k, v) => { mem.set(k, String(v)); return true; },
    remove: (k) => mem.delete(k),
    keys: () => [...mem.keys()],
  };
}

const parse = (s, fb = null) => { try { return s == null ? fb : JSON.parse(s); } catch { return fb; } };
export const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* =========================================================================
   ترحيل بيانات النسخة السابقة (Math Clash v1 أحادي الملف)
   ========================================================================= */
export function convertLegacy({ set, prog, stats }, lang = 'ar') {
  const d = newProfileData(set?.lang || lang);
  if (set) {
    d.settings.lang = set.lang || d.settings.lang;
    d.settings.digits = set.digits === 'arabic' ? 'arabic' : 'western';
    d.settings.sfx = set.sound === false ? 0 : 0.8;
    d.settings.haptics = set.haptics !== false;
    d.settings.contrast = !!set.cvd;
    d.settings.tutorialDone = !!set.tutDone;
  }
  let xp = 0;
  if (prog) {
    d.journey.unlocked = Math.max(1, Math.min(100, prog.unlocked | 0 || 1));
    for (const [k, v] of Object.entries(prog.stars || {})) {
      const L = +k, s = Math.max(0, Math.min(3, v | 0));
      if (L >= 1 && L <= 100 && s > 0) { d.journey.stars[L] = s; xp += s * 15; }
    }
    xp += (d.journey.unlocked - 1) * 20;
    for (const [k, v] of Object.entries(prog.edu || {})) {
      const s = Math.max(0, Math.min(3, v | 0));
      if (/^[a-z]+\|\d+$/.test(k) && s > 0) { d.lessons.done[k] = s; xp += s * 10; }
    }
    for (const [k, v] of Object.entries(prog.eduUnlocked || {})) if (/^[a-z]+$/.test(k)) d.lessons.unlocked[k] = Math.max(1, v | 0);
    if (prog.daily && prog.daily.last) {
      d.daily.last = String(prog.daily.last).slice(0, 10);
      d.daily.streak = prog.daily.streak | 0;
      d.daily.bestStreak = d.daily.streak;
    }
  }
  if (stats) {
    d.stats.bestStreak = stats.bestStreak | 0;
    xp += Math.min(2000, (stats.games | 0) * 10);
  }
  d.xp = xp;
  d.legacy = {
    migratedAt: Date.now(),
    games: stats?.games | 0, points: stats?.points | 0, popped: stats?.popped | 0, wins: stats?.wins | 0,
    selfBest: prog?.best || {}, dailyBest: prog?.daily?.best | 0,
  };
  return d;
}

export function migrateLegacy(be, lang = 'ar') {
  if (be.get(KEYS.migrated)) return null;
  const users = parse(be.get('mc_users'), []);
  const out = [];
  const read = (id) => ({ set: parse(be.get(`mc_set:${id}`)), prog: parse(be.get(`mc_prog:${id}`)), stats: parse(be.get(`mc_stats:${id}`)) });
  for (const u of Array.isArray(users) ? users : []) {
    if (!u || !u.uid) continue;
    const data = convertLegacy(read(u.uid), lang);
    out.push({ profile: { id: u.uid, name: String(u.name || 'لاعب').slice(0, 20), salt: u.salt || null, hash: u.hash || null, created: u.created || Date.now(), legacyRole: u.role || null }, data });
  }
  const g = read('guest');
  if (g.prog && ((g.prog.unlocked | 0) > 1 || Object.keys(g.prog.stars || {}).length || Object.keys(g.prog.edu || {}).length)) {
    out.push({ profile: { id: 'guest', name: 'ضيف', salt: null, hash: null, created: Date.now() }, data: convertLegacy(g, lang) });
  }
  const session = parse(be.get('mc_session'));
  be.set(KEYS.migrated, String(Date.now()));
  return { entries: out, currentId: session && session.uid ? session.uid : null };
}

/* =========================================================================
   مخزن الملفات الشخصية
   ========================================================================= */
export function createStore(be, { lang = 'ar' } = {}) {
  const readProfiles = () => {
    const p = parse(be.get(KEYS.profiles));
    return p && Array.isArray(p.list) ? p : { v: 2, current: null, list: [], rememberUntil: {} };
  };
  const writeProfiles = (p) => be.set(KEYS.profiles, JSON.stringify(p));

  const store = {
    backend: be,
    get persistent() { return be.persistent; },

    /** تهيئة: ترحيل البيانات القديمة ثم ضمان وجود ملف واحد على الأقل */
    init() {
      let P = readProfiles();
      const mig = migrateLegacy(be, lang);
      let migrated = 0;
      if (mig && mig.entries.length) {
        for (const { profile, data } of mig.entries) {
          if (P.list.some((x) => x.id === profile.id)) continue;
          P.list.push(profile);
          be.set(KEYS.data(profile.id), JSON.stringify(data));
          migrated++;
        }
        if (!P.current && mig.currentId && P.list.some((x) => x.id === mig.currentId)) P.current = mig.currentId;
      }
      if (!P.list.length) {
        const id = uid();
        P.list.push({ id, name: '', salt: null, hash: null, created: Date.now() });
        be.set(KEYS.data(id), JSON.stringify(newProfileData(lang)));
        P.current = id;
      }
      if (!P.current || !P.list.some((x) => x.id === P.current)) P.current = P.list[0].id;
      P.rememberUntil ||= {};
      writeProfiles(P);
      return { migrated, fresh: !mig || !mig.entries.length };
    },

    profiles: () => readProfiles().list,
    currentId: () => readProfiles().current,
    currentProfile() { const P = readProfiles(); return P.list.find((x) => x.id === P.current) || null; },
    setCurrent(id, { remember = false } = {}) {
      const P = readProfiles();
      if (!P.list.some((x) => x.id === id)) return false;
      P.current = id;
      P.rememberUntil ||= {};
      if (remember) P.rememberUntil[id] = Date.now() + 30 * 864e5;
      writeProfiles(P);
      return true;
    },
    /** هل يحتاج الملف الحالي لكلمة مرور قبل اللعب؟ */
    needsUnlock(id, now = Date.now()) {
      const P = readProfiles();
      const p = P.list.find((x) => x.id === id);
      if (!p || !p.hash) return false;
      return !(P.rememberUntil && P.rememberUntil[id] > now);
    },
    lock(id) { const P = readProfiles(); if (P.rememberUntil) delete P.rememberUntil[id]; writeProfiles(P); },
    createProfile(name, extra = {}) {
      const P = readProfiles();
      const id = uid();
      P.list.push({ id, name: String(name || '').slice(0, 20), salt: extra.salt || null, hash: extra.hash || null, created: Date.now() });
      writeProfiles(P);
      const d = newProfileData(extra.lang || lang);
      if (extra.settings) Object.assign(d.settings, extra.settings);
      be.set(KEYS.data(id), JSON.stringify(d));
      return id;
    },
    updateProfile(id, patch) {
      const P = readProfiles();
      const p = P.list.find((x) => x.id === id);
      if (!p) return false;
      Object.assign(p, patch);
      writeProfiles(P);
      return true;
    },
    deleteProfile(id) {
      const P = readProfiles();
      P.list = P.list.filter((x) => x.id !== id);
      be.remove(KEYS.data(id));
      be.remove(KEYS.active(id));
      if (P.current === id) P.current = P.list[0]?.id || null;
      writeProfiles(P);
      if (!P.list.length) store.init();
    },

    load(id) {
      const raw = parse(be.get(KEYS.data(id)));
      return normalizeData(raw, lang);
    },
    save(id, data) {
      return be.set(KEYS.data(id), JSON.stringify(data));
    },

    saveActive(id, snap) { return be.set(KEYS.active(id), JSON.stringify(snap)); },
    loadActive(id) { return parse(be.get(KEYS.active(id))); },
    clearActive(id) { be.remove(KEYS.active(id)); },

    exportData(id) {
      const p = readProfiles().list.find((x) => x.id === id);
      return { app: 'qatra', v: DATA_VERSION, when: Date.now(), name: p?.name || '', data: store.load(id) };
    },
    /** يستورد ملف حفظ (الجديد أو صيغة النسخة السابقة v1) إلى الملف المحدد */
    importData(id, json) {
      const obj = typeof json === 'string' ? parse(json) : json;
      if (!obj || typeof obj !== 'object') throw new Error('invalid');
      let data;
      if ((obj.app === 'qatra' || obj.app === 'math-clash') && obj.data) data = normalizeData(obj.data, lang);
      else if (obj.progress) data = convertLegacy({ set: obj.settings, prog: obj.progress, stats: obj.stats }, lang);
      else throw new Error('invalid');
      store.save(id, data);
      store.clearActive(id);
      return data;
    },
  };
  return store;
}

/* ---------- كلمات المرور (اختيارية) — نفس صيغة النسخة السابقة PBKDF2-SHA256 ---------- */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export async function hashPass(pass, saltB64) {
  const enc = new TextEncoder();
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  return { salt: saltB64 || b64(salt), hash: b64(bits) };
}
export async function verifyPass(pass, profile) {
  if (!profile.hash) return true;
  const { hash } = await hashPass(pass, profile.salt);
  return hash === profile.hash;
}
