/* =========================================================================
   الوصول الآمن لإضافات Android الأصلية (Capacitor).
   • داخل التطبيق: تُحمَّل طبقة Capacitor (vendor/capacitor.js) فتتوفر registerPlugin.
   • احتياط: إن غابت registerPlugin نستخدم جسر Capacitor مباشرة (nativePromise / addListener).
   • في المتصفح أو عند أي خلل: نعيد null — الميزة تتعطل بهدوء ولا تتوقف اللعبة أبدًا.
   ========================================================================= */
const cache = new Map();

export function nativePlugin(name) {
  if (cache.has(name)) return cache.get(name);
  let p = null;
  try {
    const C = typeof window !== 'undefined' ? window.Capacitor : null;
    if (C && C.isNativePlatform?.() && C.isPluginAvailable?.(name)) {
      if (typeof C.registerPlugin === 'function') p = C.registerPlugin(name);
      else if (typeof C.nativePromise === 'function') {
        p = new Proxy({}, {
          get: (_, m) => (m === 'then' ? undefined
            : m === 'addListener' ? (ev, cb) => Promise.resolve(C.addListener(name, ev, cb))
            : (opts) => C.nativePromise(name, String(m), opts || {})),
        });
      }
    }
  } catch { p = null; }
  if (p) cache.set(name, p);
  return p;
}
