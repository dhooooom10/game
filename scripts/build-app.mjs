/* =========================================================================
   يجهّز ملفات اللعبة لتطبيق Android (Capacitor): ينسخ public/ إلى build/app-www/
   ويستبعد لوحة الإدارة. اللعبة تعمل بالكامل بلا خادم.
   الاستخدام:  node scripts/build-app.mjs
   ثم:        npx cap sync android
   ========================================================================= */
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + 'build/app-www';
rmSync(out, { recursive: true, force: true });
const skip = ['admin.html', 'src/admin', 'styles/admin.css', 'sw.js'];
cpSync(root + 'public', out, { recursive: true, filter: (src) => !skip.some((s) => src.endsWith('/public/' + s)) });
if (!existsSync(out + '/src/main.js')) throw new Error('copy failed');
// طبقة Capacitor في JavaScript (registerPlugin وجسور الإضافات). بدونها لا تعمل إضافات Android
// (زر الرجوع، الشراء، Play Games، الإشعارات، المشاركة) — تُحمَّل قبل اللعبة داخل التطبيق فقط.
mkdirSync(out + '/vendor', { recursive: true });
cpSync(root + 'node_modules/@capacitor/core/dist/capacitor.js', out + '/vendor/capacitor.js');
const idx = out + '/index.html';
const html = readFileSync(idx, 'utf8');
if (!html.includes('<script type="module" src="./src/main.js"></script>')) throw new Error('index.html: main script tag not found');
writeFileSync(idx, html.replace('<script type="module" src="./src/main.js"></script>', '<script src="./vendor/capacitor.js"></script>\n<script type="module" src="./src/main.js"></script>'));
console.log('✓ build/app-www جاهز');
