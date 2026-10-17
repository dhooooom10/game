/* =========================================================================
   التذكيرات على الجهاز (Capacitor Local Notifications — داخل تطبيق Android فقط).
   • تذكير السلسلة: الساعة ٨ مساءً إن لم تلعب التحدي اليومي اليوم.
   • تحديات الأصدقاء المنتظرة: بعد ٣ ساعات من مغادرة التطبيق إن بقيت رموز تحدٍّ فتحتها ولم تلعبها.
   تُعاد جدولتها كل مرة يغادر فيها اللاعب التطبيق، ولا تُرسل شيئًا إن أطفأها من الإعدادات.
   كلها محلية على الجهاز — لا خادم ولا Push.
   ========================================================================= */
import { isNativeApp } from '../config.js';
import { dailyStatus, todayStr } from '../core/progression.js';
import { t } from '../i18n.js';

const ID_STREAK = 1001, ID_FRIENDS = 1002;
let plugin = null;
function getPlugin() {
  if (plugin) return plugin;
  const C = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!isNativeApp() || !C?.isPluginAvailable?.('LocalNotifications')) return null;
  plugin = C.registerPlugin('LocalNotifications');
  return plugin;
}
export const available = () => !!getPlugin();
export const enabled = (data) => data.settings.notify !== false;

/** يطلب الإذن (Android 13+) — يعيد true إن سُمح */
export async function requestPermission() {
  const p = getPlugin(); if (!p) return false;
  try {
    const cur = await p.checkPermissions();
    if (cur.display === 'granted') return true;
    const r = await p.requestPermissions();
    return r.display === 'granted';
  } catch { return false; }
}

/** وقت التذكير القادم بالسلسلة: اليوم ٨ مساءً إن لم يفت ولم يُلعب اليومي، وإلا غدًا */
export function nextStreakTime(data, now = new Date()) {
  const at = new Date(now); at.setHours(20, 0, 0, 0);
  const doneToday = dailyStatus(data, todayStr(now)).done;
  if (doneToday || at <= now) at.setDate(at.getDate() + 1);
  return at;
}

/** تحديات وصلتك برمز ولم تلعبها بعد */
export const pendingCodes = (data) => (data?.social?.list || []).filter((c) => c.dir === 'recv' && c.mine == null).length;

/** يعيد جدولة التذكيرات (يُستدعى عند مغادرة التطبيق) */
export async function reschedule(app, { pendingChallenges = pendingCodes(app.data) } = {}) {
  const p = getPlugin(); if (!p) return;
  try {
    await p.cancel({ notifications: [{ id: ID_STREAK }, { id: ID_FRIENDS }] });
    if (!enabled(app.data)) return;
    const perm = await p.checkPermissions();
    if (perm.display !== 'granted') return;
    const ds = dailyStatus(app.data);
    const list = [{
      id: ID_STREAK, schedule: { at: nextStreakTime(app.data), allowWhileIdle: true },
      title: t('app.name'),
      body: ds.streak > 0 ? t('notif.streak', { n: ds.streak }) : t('notif.daily'),
    }];
    if (pendingChallenges > 0) list.push({ id: ID_FRIENDS, schedule: { at: new Date(Date.now() + 3 * 3600e3), allowWhileIdle: true }, title: t('app.name'), body: t('notif.friends', { n: pendingChallenges }) });
    await p.schedule({ notifications: list });
  } catch { /* لا نعطّل اللعبة بسبب الإشعارات */ }
}
