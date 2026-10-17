/* جسر Play Games في المتصفح مع إضافة أصلية مزيّفة (محاكاة تطبيق Android) — بلا أي خادم */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, newPage, waitScreen } from './helpers.js';

let S, browser;
before(async () => { S = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); await S.close(); });

/** يحقن Capacitor مزيّفًا بإضافة PlayGames تسجّل كل الاستدعاءات */
async function nativePage() {
  const page = await newPage(browser);
  await page.addInitScript(() => {
    window.__pgCalls = [];
    const plugin = {
      isAuthenticated: async () => ({ authenticated: true }),
      signIn: async () => ({ authenticated: true }),
      unlockAchievement: async (o) => { window.__pgCalls.push(['ach', o.achievementId]); },
      submitScore: async (o) => { window.__pgCalls.push(['score', o.leaderboardId, o.score]); },
      showAchievements: async () => { window.__pgCalls.push(['showAch']); },
      showLeaderboards: async () => { window.__pgCalls.push(['showLb']); },
    };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n === 'PlayGames', registerPlugin: () => plugin };
  });
  return page;
}

test('play games bridge: signs in, unlocks achievements, submits best scores once; buttons in Friends', async () => {
  const page = await nativePage();
  await page.goto(S.url + '?e2e=1');
  await waitScreen(page, 'home');
  const out = await page.evaluate(async () => {
    const cfg = (await import('/src/net/playgames-config.js')).PGS;
    cfg.achievements.first = 'ACH_FIRST';
    cfg.leaderboards.stars = 'LB_STARS';
    cfg.leaderboards.survival = 'LB_SURV';
    const pg = await import('/src/net/playgames.js');
    const app = window.__mc;
    app.data.badges.first = '2026-10-03';
    app.data.journey.stars = { 1: 3, 2: 2 };
    app.data.records['survival:hard'] = { value: 17 };
    await pg.init(app);
    await pg.sync(app); // مرة ثانية: لا تكرار
    return { calls: window.__pgCalls };
  });
  assert.deepEqual(out.calls.filter((c) => c[0] === 'ach'), [['ach', 'ACH_FIRST']]);
  assert.deepEqual(out.calls.filter((c) => c[0] === 'score'), [['score', 'LB_STARS', 5], ['score', 'LB_SURV', 17]]);
  // أزرار Play Games في شاشة الأصدقاء
  await page.evaluate(() => window.__mc.go('friends'));
  await page.waitForSelector('text=Google Play Games');
  await page.click('button:has-text("الإنجازات")');
  await page.click('button:has-text("لوحات الصدارة")');
  const calls = await page.evaluate(() => window.__pgCalls.map((c) => c[0]));
  assert.ok(calls.includes('showAch') && calls.includes('showLb'));
  assert.deepEqual(page.errors, []);
});

test('in a normal browser the bridge is inert', async () => {
  const page = await newPage(browser);
  await page.goto(S.url + '?e2e=1');
  await waitScreen(page, 'home');
  const r = await page.evaluate(async () => { const pg = await import('/src/net/playgames.js'); return [pg.available(), await pg.signIn({ interactive: true })]; });
  assert.deepEqual(r, [false, false]);
  assert.deepEqual(page.errors, []);
});
