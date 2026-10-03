/* =========================================================================
   جسر Google Play Games (يعمل فقط داخل تطبيق Android المبني بـ Capacitor).
   في المتصفح/PWA كل الدوال لا تفعل شيئًا وتعيد false — اللعبة لا تعتمد عليه.
   الإضافة الأصلية: android/app/src/main/java/.../PlayGamesPlugin.kt
   ========================================================================= */
import { PGS } from './playgames-config.js';
import { api } from './online.js';

let plugin = null, authed = false, syncing = false, timer = 0;

function getPlugin() {
  if (plugin) return plugin;
  const C = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!C || !C.isNativePlatform?.() || !C.isPluginAvailable?.('PlayGames')) return null;
  plugin = C.registerPlugin('PlayGames');
  return plugin;
}

/** هل Play Games متاح على هذا الجهاز (تطبيق Android)؟ */
export const available = () => !!getPlugin();
export const signedIn = () => authed;

/** تسجيل الدخول (Play Games v2 يسجّل تلقائيًا عادة؛ هذا يظهر نافذة فقط إن لزم) */
export async function signIn({ interactive = false } = {}) {
  const p = getPlugin();
  if (!p) return false;
  try {
    let r = await p.isAuthenticated();
    if (!r.authenticated && interactive) r = await p.signIn();
    authed = !!r.authenticated;
  } catch { authed = false; }
  return authed;
}

/**
 * يربط ملف اللاعب الحالي بحساب Play على خادم اللعبة، أو يسترجع حسابًا مربوطًا سابقًا.
 * يحدّث data.online ويعيد true عند النجاح.
 */
export async function linkAccount(app) {
  const p = getPlugin();
  if (!p || !PGS.webClientId || !authed) return false;
  try {
    const { authCode } = await p.requestServerSideAccess({ clientId: PGS.webClientId });
    if (!authCode) return false;
    const r = await api('POST', '/api/auth/playgames', { authCode });
    const prev = app.data.online || {};
    app.data.online = { id: r.id, token: r.token || prev.token, name: r.name, code: r.code, pgs: true };
    app.save();
    return !!app.data.online.token;
  } catch { return false; }
}

const best = (records, prefix) => Object.entries(records || {}).filter(([k]) => k.startsWith(prefix)).reduce((m, [, v]) => Math.max(m, v.value || 0), 0);

/** يرسل الإنجازات الجديدة وأفضل النتائج إلى Play Games (بلا تكرار) */
export async function sync(app) {
  const p = getPlugin();
  if (!p || !authed || syncing || !app.data) return;
  syncing = true;
  const d = app.data;
  const sent = (d.pgs ||= { a: {}, l: {} });
  try {
    for (const id of Object.keys(d.badges || {})) {
      const aid = PGS.achievements[id];
      if (!aid || sent.a[id]) continue;
      await p.unlockAchievement({ achievementId: aid });
      sent.a[id] = 1;
    }
    const stars = Object.values(d.journey?.stars || {}).reduce((a, b) => a + b, 0);
    const scores = { stars, xp: d.xp || 0, survival: best(d.records, 'survival:'), time60: best(d.records, 'time:60:') };
    for (const [k, v] of Object.entries(scores)) {
      const lid = PGS.leaderboards[k];
      if (!lid || !v || (sent.l[k] || 0) >= v) continue;
      await p.submitScore({ leaderboardId: lid, score: v });
      sent.l[k] = v;
    }
  } catch { /* بلا اتصال: نعيد المحاولة في المرة القادمة */ }
  syncing = false;
  app.save();
}

/** مزامنة مؤجلة (تُستدعى بعد كل حفظ دون إبطاء اللعب) */
export function scheduleSync(app) {
  if (!authed) return;
  clearTimeout(timer);
  timer = setTimeout(() => sync(app), 2500);
}

export async function showLeaderboards() { const p = getPlugin(); if (p) try { await p.showLeaderboards(); } catch { /* ignore */ } }
export async function showAchievements() { const p = getPlugin(); if (p) try { await p.showAchievements(); } catch { /* ignore */ } }
export const hasAchievements = () => Object.values(PGS.achievements).some(Boolean);
export const hasLeaderboards = () => Object.values(PGS.leaderboards).some(Boolean);

/** عند الإقلاع داخل التطبيق: دخول صامت ثم ربط ثم مزامنة */
export async function init(app) {
  if (!available()) return;
  if (!(await signIn())) return;
  if (!app.data.online?.pgs) await linkAccount(app);
  sync(app);
}
