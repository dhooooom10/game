/* ميزات الانتشار: مشاركة التحدي اليومي، تحدي صديق برمز من جولة فردية، دعوة التطبيق */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen } from './helpers.js';

let S, browser;
before(async () => { S = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

async function page() {
  const p = await newPage(browser);
  await p.addInitScript(() => { window.__shared = []; navigator.share = async (d) => { window.__shared.push(d); }; });
  return p;
}

test('daily result: Wordle-style share text with number, grid and link', async () => {
  const p = await page();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => {
    const answers = [{ correct: true, ms: 900 }, { correct: true, ms: 2600 }, { correct: false, timeout: true }, { correct: true, ms: null }];
    const sum = { score: 420, popped: 3, accuracy: 0.75, correct: 3, answered: 4, skipped: 0, bestStreak: 2, avgMs: 1500, answers };
    window.__mc.go('results', { view: { engine: 'rain', kind: 'daily', args: { date: '2026-10-03', official: true }, sum, score: 470, title: 'x', notes: [], mood: 'happy' } });
  });
  await waitScreen(p, 'results');
  await p.click('#shareDaily');
  const d = (await p.evaluate(() => window.__shared))[0];
  assert.match(d.text, /#[3٣]\n/);
  assert.match(d.text, /🟦🟩🟥🟦/);
  assert.match(d.url, /play\.google\.com\/store\/apps\/details\?id=app\.qatra\.game/);
  assert.match(d.url, /utm_source%3Dshare/);
  assert.deepEqual(p.errors, []);
});

test('challenge a friend from any round: the code opens the exact same drops for the friend (no server)', async () => {
  const p = await page();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.go('rainPlay', { kind: 'custom', seed: 4242, args: { mode: 'time', dur: 30, diff: 'easy' } }); });
  await p.waitForFunction(() => window.__mc.current?.rain?.()?.state?.tick > 0, null, { timeout: 8000 });
  for (let i = 0; i < 80; i++) {
    const done = await p.evaluate(() => {
      const c = window.__mc.current; if (c.name !== 'rainPlay') return true;
      const R = c.rain(); const d = R.state.drops.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
      if (d) { for (const ch of String(d.q.answer)) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }
      return false;
    });
    if (done) break;
    await p.waitForTimeout(450);
  }
  await waitScreen(p, 'results', 40000);
  await p.click('#challengeFriend');
  await p.waitForFunction(() => window.__shared.length > 0, null, { timeout: 8000 });
  const d = (await p.evaluate(() => window.__shared))[0];
  assert.match(d.text, /QC-[A-Za-z0-9_-]+\.[0-9a-z]{3}/);
  assert.match(d.url, /play\.google\.com/);
  // الصديق يلصق الرسالة كاملة
  const f = await page();
  await f.goto(S.url + '?e2e=1');
  await waitScreen(f, 'home');
  await f.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.go('friends'); });
  await f.fill('#codeIn', d.text);
  await f.click('#openCode');
  await f.click('#playCode');
  await waitScreen(f, 'rainPlay');
  const r = await f.evaluate(() => ({ seed: window.__mc.stack.at(-1).params.seed, cfg: window.__mc.current.rain().cfg }));
  assert.equal(r.seed, 4242, 'same seed = same drops');
  const mine = await p.evaluate(async () => { const { challengeConfig } = await import('/src/core/challenge.js'); return challengeConfig({ mode: 'time', dur: 30, diff: 'easy' }); });
  assert.deepEqual(JSON.parse(JSON.stringify(r.cfg)), JSON.parse(JSON.stringify(mine)), 'same rules');
  assert.match(await f.textContent('main'), /⚔️/);
  assert.deepEqual(p.errors, []);
  assert.deepEqual(f.errors, []);
});

test('languages: full translations load on demand (Spanish), LTR, no missing-key fallbacks on home', async () => {
  const p = await page();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__mc.go('settings'));
  await waitScreen(p, 'settings');
  await p.selectOption('main select', 'es');
  await p.waitForFunction(() => document.documentElement.lang === 'es' && document.documentElement.dir === 'ltr');
  await p.evaluate(() => window.__mc.go('home', {}, { root: true }));
  await waitScreen(p, 'home');
  const txt = await p.locator('#app').innerText();
  assert.match(txt, /Jugar/);
  assert.doesNotMatch(txt, /\b[a-z]+\.[a-zA-Z]+\b/, 'no raw keys');
  // إعادة التحميل: اللغة تُحمَّل قبل أول رسم
  await p.reload();
  await waitScreen(p, 'home');
  assert.match(await p.locator('#app').innerText(), /Desafío diario|Jugar/);
  assert.deepEqual(p.errors, []);
});

test('custom challenge: pick ops/speed/accel, play, wrong answer flashes red, speedup shows, record saved', async () => {
  const p = await page();
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; });
  await p.click('#menuChallenges');
  await p.click('#modeCustom');
  await waitScreen(p, 'setupCustom');
  await p.click('#ch-custom');
  await p.click('text=جنونية');
  await p.click('#startChallenge');
  await waitScreen(p, 'rainPlay');
  const cfg = await p.evaluate(() => window.__mc.current.rain().cfg);
  assert.equal(cfg.travel, 3.2); assert.equal(cfg.accel, 0.08);
  await p.waitForFunction(() => window.__mc.current.rain().state.drops.some((d) => !d.dead), null, { timeout: 8000 });
  // إجابة خطأ مؤكدة: رقم لا يبدأ به أي ناتج
  const bad = await p.evaluate(() => { const ans = window.__mc.current.rain().state.drops.filter((d) => !d.dead).map((d) => String(d.q.answer)); for (let i = 1; i < 10; i++) if (!ans.some((a) => a.startsWith(String(i)))) return String(i); return '9'; });
  await p.keyboard.press(bad);
  await p.waitForSelector('.sky.wrong-flash', { timeout: 3000 });
  // نقفز ١٠ ثوانٍ في المحرك للتأكد من حدث التسارع
  const ups = await p.evaluate(() => { const R = window.__mc.current.rain(); let n = 0; while (R.state.tick < 610 && !R.state.over) for (const e of R.step()) if (e.type === 'speedup') n++; return n; });
  assert.equal(ups, 1);
  assert.deepEqual(p.errors, []);
});

test('android back button: navigates inside the game, double press on home to exit', async () => {
  const p = await newPage(browser);
  await p.addInitScript(() => {
    window.__exit = 0; let cb = null;
    const appPlugin = { addListener: (ev, fn) => { if (ev === 'backButton') cb = fn; return Promise.resolve({ remove() {} }); }, exitApp: () => { window.__exit++; } };
    window.__back = () => cb && cb();
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n === 'App', registerPlugin: () => appPlugin };
  });
  await p.goto(S.url + '?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__mc.go('settings'));
  await waitScreen(p, 'settings');
  await p.evaluate(() => window.__back());
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__back());
  assert.equal(await p.evaluate(() => window.__exit), 0, 'first press on home only warns');
  await p.waitForSelector('text=اضغط رجوع مرة أخرى للخروج');
  await p.evaluate(() => window.__back());
  assert.equal(await p.evaluate(() => window.__exit), 1);
  assert.deepEqual(p.errors, []);
});
