// يولّد قائمة الملفات المخزّنة في عامل الخدمة ورقم إصدار من محتواها.
// الاستخدام: node scripts/build-sw.mjs  (شغّله بعد أي تعديل قبل النشر)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('../public/', import.meta.url).pathname;
// شجرة الاستيراد الثابتة من main.js ← روابط modulepreload في index.html.
// بدونها يكتشف المتصفح الوحدات طبقة بعد طبقة (رحلة شبكة لكل طبقة: بطيء على 4G).
// الاستيراد الديناميكي import() (اللغات الأخرى، الشاشات الثانوية) لا يُحمَّل مسبقًا.
const graph = new Set();
(function visit(file) {
  if (graph.has(file)) return;
  graph.add(file);
  const src = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/gm)) {
    visit(relative(root, join(root, file, '..', m[1])).split('\\').join('/'));
  }
})('src/main.js');
const links = [...graph].map((f) => `<link rel="modulepreload" href="./${f}">`).join('\n');
const idx = readFileSync(join(root, 'index.html'), 'utf8');
const next = idx.replace(/(<!-- modulepreload:start[^>]*-->\n)[\s\S]*?(<!-- modulepreload:end -->)/, `$1${links}\n$2`);
if (next === idx && !idx.includes(links)) throw new Error('index.html: modulepreload markers not found');
writeFileSync(join(root, 'index.html'), next);
console.log(`index.html: ${graph.size} modules preloaded`);

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
