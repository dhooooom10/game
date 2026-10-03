/* أدوات اختبارات الواجهة: خادم ملفات ثابت مدمج + متصفح Chromium عبر Playwright. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../public/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };

export async function startServer() {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) throw new Error('bad');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  return { url, close: () => new Promise((r) => srv.close(r)) };
}

export async function launch() {
  return chromium.launch();
}

/** صفحة جديدة بسياق نظيف (تخزين محلي فارغ) وتجميع أخطاء الصفحة */
export async function newPage(browser, { width = 390, height = 844, locale = 'ar-SA', storage = null, reducedMotion = 'reduce' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale, reducedMotion, hasTouch: false });
  if (storage) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, storage);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  return page;
}

export const mc = (page, fn, arg) => page.evaluate(fn, arg);
export const screenName = (page) => page.evaluate(() => window.__mc.current?.name);
export const phase = (page) => page.evaluate(() => window.__mc.current?.session?.phase);

export async function waitScreen(page, name, timeout = 8000) {
  await page.waitForFunction((n) => window.__mc?.current?.name === n, name, { timeout });
}
export async function waitAsking(page, timeout = 8000) {
  await page.waitForFunction(() => { const c = window.__mc?.current; return c?.session?.phase === 'asking' && !document.querySelector('.overlay'); }, null, { timeout });
}

/** يجيب عن السؤال الحالي عبر الواجهة (صحيحًا أو خطأً) */
export async function answer(page, correct = true) {
  await waitAsking(page);
  const q = await page.evaluate(() => {
    const s = window.__mc.current.session; return { format: s.question.format, answer: s.question.answer, choices: s.question.choices || null, index: s.index };
  });
  if (q.format === 'choice') {
    const v = correct ? q.answer : q.choices.find((c) => c !== q.answer);
    await page.click(`.choice[data-v="${v}"]`);
  } else if (q.format === 'compare') {
    const v = correct ? q.answer : (q.answer === 'left' ? 'right' : 'left');
    await page.locator('.compare button').nth({ left: 0, equal: 1, right: 2 }[v]).click();
  } else {
    const v = correct ? q.answer : q.answer + 1;
    for (const ch of String(v)) await page.keyboard.press(ch === '-' ? 'Minus' : ch);
    await page.keyboard.press('Enter');
  }
  return q;
}

/** ينتظر حتى يظهر سؤال جديد أو تنتهي الجولة */
export async function waitNextOrEnd(page, prevIndex, timeout = 8000) {
  await page.waitForFunction((i) => {
    const c = window.__mc?.current;
    if (!c) return false;
    if (c.name !== 'play') return true;
    const s = c.session; return (s.phase === 'asking' && s.index !== i) || s.phase === 'ended';
  }, prevIndex, { timeout });
}

/** يلعب الجولة حتى النهاية. pattern(i) => صحيح/خطأ */
export async function playRound(page, pattern = () => true, max = 80) {
  await page.waitForFunction(() => window.__mc?.current?.session, null, { timeout: 8000 });
  const sid = await page.evaluate(() => window.__mc.current.session.spec.id);
  let n = 0;
  for (let i = 0; i < max; i++) {
    if ((await screenName(page)) !== 'play') return;
    if ((await page.evaluate(() => window.__mc.current?.session?.spec.id)) !== sid) return; // بدأت جولة أخرى
    const nb = await page.$('.next-btn');
    if (nb) { await nb.click(); continue; }
    const ph = await phase(page);
    if (ph !== 'asking') { await page.waitForTimeout(150); continue; }
    const q = await answer(page, pattern(n++));
    const nb2 = await page.waitForSelector('.next-btn', { timeout: 400 }).catch(() => null);
    if (nb2) await nb2.click();
    await waitNextOrEnd(page, q.index);
  }
}

export async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
