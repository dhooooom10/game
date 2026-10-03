/* جسر Play Games في المتصفح مع إضافة أصلية مزيّفة (محاكاة تطبيق Android) وخادم Google مزيّف */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, newPage, waitScreen } from './helpers.js';
import { startServer } from '../../server/index.js';

let S, browser;
const fetchImpl = async (url, opts = {}) => {
  const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
  if (String(url).includes('oauth2')) return res(200, { access_token: 'at-' + new URLSearchParams(opts.body).get('code') });
  return res(200, { playerId: 'gp-' + opts.headers.Authorization.slice(-6), displayName: 'Play Hero' });
};
before(async () => {
  S = await startServer({ registerLimit: 1000, playGames: { clientId: 'web.apps.googleusercontent.com', clientSecret: 'sec', fetchImpl } });
  browser = await launch();
});
after(async () => { await browser.close(); await S.close(); });

/** يحقن Capacitor مزيّفًا بإضافة PlayGames تسجّل كل الاستدعاءات */
async function nativePage() {
  const page = await newPage(browser);
  await page.addInitScript(() => {
    window.__pgCalls = [];
    const plugin = {
      isAuthenticated: async () => ({ authenticated: true }),
      signIn: async () => ({ authenticated: true }),
      requestServerSideAccess: async (o) => { window.__pgCalls.push(['access', o.clientId]); return { authCode: 'code-abc123' }; },
      unlockAchievement: async (o) => { window.__pgCalls.push(['ach', o.achievementId]); },
      submitScore: async (o) => { window.__pgCalls.push(['score', o.leaderboardId, o.score]); },
      showAchievements: async () => { window.__pgCalls.push(['showAch']); },
      showLeaderboards: async () => { window.__pgCalls.push(['showLb']); },
    };
    window.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => n === 'PlayGames', registerPlugin: () => plugin };
  });
  return page;
}

test('play games bridge: links account, unlocks achievements, submits best scores once', async () => {
  const page = await nativePage();
  await page.goto(S.url + '/?e2e=1');
  await waitScreen(page, 'home');
  const out = await page.evaluate(async () => {
    const cfg = (await import('/src/net/playgames-config.js')).PGS;
    cfg.webClientId = 'web.apps.googleusercontent.com';
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
    return { calls: window.__pgCalls, online: app.data.online };
  });
  assert.equal(out.online.pgs, true);
  assert.ok(out.online.token);
  assert.equal(out.online.name, 'Play Hero');
  assert.deepEqual(out.calls.filter((c) => c[0] === 'access'), [['access', 'web.apps.googleusercontent.com']]);
  assert.deepEqual(out.calls.filter((c) => c[0] === 'ach'), [['ach', 'ACH_FIRST']]);
  assert.deepEqual(out.calls.filter((c) => c[0] === 'score'), [['score', 'LB_STARS', 5], ['score', 'LB_SURV', 17]]);
  // الهوية المربوطة تعمل مع الخادم، وأزرار Play تظهر في مركز الأونلاين
  await page.evaluate(() => window.__mc.go('online'));
  await page.waitForSelector('text=إنجازات Google Play');
  await page.click('text=إنجازات Google Play');
  await page.click('text=لوحات Google Play');
  const calls = await page.evaluate(() => window.__pgCalls.map((c) => c[0]));
  assert.ok(calls.includes('showAch') && calls.includes('showLb'));
  assert.deepEqual(page.errors, []);
});

test('in a normal browser the bridge is inert', async () => {
  const page = await newPage(browser);
  await page.goto(S.url + '/?e2e=1');
  await waitScreen(page, 'home');
  const r = await page.evaluate(async () => { const pg = await import('/src/net/playgames.js'); return [pg.available(), await pg.signIn({ interactive: true })]; });
  assert.deepEqual(r, [false, false]);
  assert.deepEqual(page.errors, []);
});
