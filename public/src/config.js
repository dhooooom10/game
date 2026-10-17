/* =========================================================================
   إعدادات النشر العامة — عدّلها مرة واحدة قبل الإطلاق.
   ========================================================================= */

export const CONFIG = {
  // اسم حزمة تطبيق Android (يطابق capacitor.config.json)
  playPackage: 'app.qatra.game',
  // رقم التحدي اليومي الأول (#1) — يوم إطلاق اللعبة
  launchDate: '2026-10-01',
};

export const PLAY_URL = `https://play.google.com/store/apps/details?id=${CONFIG.playPackage}`;
export const isNativeApp = () => !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
