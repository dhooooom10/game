/* =========================================================================
   إعدادات النشر العامة — عدّلها مرة واحدة قبل الإطلاق.
   ========================================================================= */
import { SERVER } from './net/online.js';

export const CONFIG = {
  // اسم حزمة تطبيق Android (يطابق capacitor.config.json)
  playPackage: 'app.mathclash.game',
  // رقم التحدي اليومي الأول (#1) — يوم إطلاق اللعبة
  launchDate: '2026-10-01',
};

/** رابط اللعبة العام الذي يُشارك (في التطبيق location.origin = https://localhost، لذا نستخدم عنوان الخادم) */
export const PUBLIC_URL = (SERVER && !/^https?:\/\/localhost(:\d+)?$/.test(SERVER) ? SERVER : (typeof location !== 'undefined' ? location.origin : '')).replace(/\/+$/, '');
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${CONFIG.playPackage}`;
export const isNativeApp = () => !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
