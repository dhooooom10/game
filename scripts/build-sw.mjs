// يولّد قائمة الملفات المخزّنة في عامل الخدمة ورقم إصدار من محتواها.
// الاستخدام: node scripts/build-sw.mjs  (شغّله بعد أي تعديل قبل النشر)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('../public/', import.meta.url).pathname;
const skip = new Set(['sw.js', '_headers', '404.html', 'robots.txt']);
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (!skip.has(f) && !f.endsWith('.txt')) files.push(relative(root, p).split('\\').join('/'));
  }
})(root);
files.sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 10);
const sw = readFileSync(join(root, 'sw.js'), 'utf8')
  .replace(/const CACHE = '[^']*';/, `const CACHE = 'qatra-${version}';`)
  .replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n  './',\n${files.map((f) => `  './${f}'`).join(',\n')}\n];`);
writeFileSync(join(root, 'sw.js'), sw);
console.log(`sw.js updated: ${files.length} files, cache qatra-${version}`);
