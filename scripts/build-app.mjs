/* =========================================================================
   يجهّز ملفات اللعبة لتطبيق Android (Capacitor): ينسخ public/ إلى build/app-www/
   ويضيف عنوان خادم الأونلاين، ويستبعد لوحة الإدارة.
   الاستخدام:  MC_SERVER=https://game.example.com node scripts/build-app.mjs
   ثم:        npx cap sync android
   ========================================================================= */
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'build/app-www';
const server = (process.env.MC_SERVER || '').replace(/\/+$/, '');
if (!/^https:\/\/[^/]+$/.test(server)) {
  console.error('✗ اضبط MC_SERVER على عنوان خادمك بـ https (مثال: MC_SERVER=https://qatra.duckdns.org)');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
const skip = ['admin.html', 'src/admin', 'styles/admin.css', 'sw.js'];
cpSync(root + 'public', out, { recursive: true, filter: (src) => !skip.some((s) => src.endsWith('/public/' + s)) });
const idx = out + '/index.html';
let html = readFileSync(idx, 'utf8');
html = html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n<meta name="mc-server" content="${server}">`);
writeFileSync(idx, html);
if (!existsSync(out + '/src/main.js')) throw new Error('copy failed');
console.log(`✓ build/app-www جاهز (الخادم: ${server})`);
