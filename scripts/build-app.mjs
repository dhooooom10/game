/* =========================================================================
   يجهّز ملفات اللعبة لتطبيق Android (Capacitor): ينسخ public/ إلى build/app-www/
   ويستبعد لوحة الإدارة. اللعبة تعمل بالكامل بلا خادم.
   الاستخدام:  node scripts/build-app.mjs
   ثم:        npx cap sync android
   ========================================================================= */
import { cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'build/app-www';
rmSync(out, { recursive: true, force: true });
const skip = ['admin.html', 'src/admin', 'styles/admin.css', 'sw.js'];
cpSync(root + 'public', out, { recursive: true, filter: (src) => !skip.some((s) => src.endsWith('/public/' + s)) });
if (!existsSync(out + '/src/main.js')) throw new Error('copy failed');
console.log('✓ build/app-www جاهز');
