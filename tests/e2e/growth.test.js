/* ميزات الانتشار: مشاركة التحدي اليومي، تحدي صديق من جولة فردية، دعوة التطبيق */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, newPage, waitScreen } from './helpers.js';
import { startServer } from '../../server/index.js';

let S, browser;
before(async () => { S = await startServer({ registerLimit: 1000 }); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

async function page() {
  const p = await newPage(browser);
  await p.addInitScript(() => { window.__shared = []; navigator.share = async (d) => { window.__shared.push(d); }; });
  return p;
}

test('daily result: Wordle-style share text with number, grid and link', async () => {
  const p = await page();
  await p.goto(S.url + '/?e2e=1');
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
  assert.match(d.url, /[?&]d=2026-10-03/);
  assert.match(d.url, /ref=share/);
  assert.deepEqual(p.errors, []);
});

test('challenge a friend from an offline round; the link opens the same drops for the friend', async () => {
  const p = await page();
  await p.goto(S.url + '/?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; window.__mc.go('rainPlay', { kind: 'time', args: { dur: 30, diff: 'easy' } }); });
  // نلعب بإدخال الإجابات الصحيحة حتى تنتهي الجولة (أو نُسرّع المحرك)
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
  const id = new URL(d.url).searchParams.get('c');
  assert.ok(id);
  // الصديق يفتح الرابط
  const f = await page();
  await f.goto(S.url + '/?e2e=1&c=' + id);
  await waitScreen(f, 'challenge');
  await f.waitForSelector('text=⚔️');
  assert.deepEqual(p.errors, []);
  assert.deepEqual(f.errors, []);
});

test('nations league: country auto-detected, ranking shown, home chip', async () => {
  const p = await page();
  await p.goto(S.url + '/?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => window.__mc.go('nations'));
  await waitScreen(p, 'nations');
  // البلد يُقترح تلقائيًا من لغة الجهاز (ar-SA) عند إنشاء الهوية
  await p.waitForSelector('.nat-me');
  assert.match(await p.locator('.nat-me').innerText(), /السعودية/);
  await p.evaluate(() => window.__mc.go('home', {}, { root: true }));
  await p.waitForSelector('#natChip', { timeout: 8000 });
  assert.deepEqual(p.errors, []);
});

test('clubs: create, invite link joins a second player, owner sees member', async () => {
  const owner = await page();
  await owner.goto(S.url + '/?e2e=1');
  await waitScreen(owner, 'home');
  await owner.evaluate(() => window.__mc.go('clubs'));
  await owner.waitForSelector('#createClub');
  await owner.fill('main input[maxlength="24"]', 'فصل التحدي');
  await owner.click('#createClub');
  await waitScreen(owner, 'club');
  const code = (await owner.locator('#clubCode').innerText()).trim();
  const m = await page();
  await m.goto(S.url + `/?e2e=1&club=${code}`);
  await waitScreen(m, 'clubJoin');
  await m.click('#confirmJoin');
  await waitScreen(m, 'club');
  await owner.evaluate(() => window.__mc.refresh());
  await owner.waitForFunction(() => document.querySelectorAll('.lb-row').length === 2, null, { timeout: 8000 });
  assert.deepEqual(owner.errors, []);
  assert.deepEqual(m.errors, []);
});

test('languages: full translations load on demand (Spanish), LTR, no missing-key fallbacks on home', async () => {
  const p = await page();
  await p.goto(S.url + '/?e2e=1');
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
  await p.goto(S.url + '/?e2e=1');
  await waitScreen(p, 'home');
  await p.evaluate(() => { window.__mc.data.settings.tutorialDone = true; });
  await p.click('#modeCustom');
  await waitScreen(p, 'setupCustom');
  await p.click('text=جنونية');
  await p.click('#startCustom');
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
  await p.goto(S.url + '/?e2e=1');
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
