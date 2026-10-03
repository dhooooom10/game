/* =========================================================================
   الإعلانات (AdMob) — داخل تطبيق Android فقط. في المتصفح لا إعلانات إطلاقًا.
   - إعلانات بمكافأة اختيارية دائمًا (اللاعب يختار: قلب إضافي أو مضاعفة الخبرة).
   - إعلانات بينية بين الجولات فقط، بحدود تكرار، ولا تظهر لمن اشترى «إزالة الإعلانات»،
     ولا في الجولات الأولى، ولا في قسم التعلّم أو الأونلاين.
   - موافقة المستخدم (UMP / GDPR) تُطلب قبل أي إعلان حيث يلزم.
   ========================================================================= */
import { MONEY, TEST_UNITS } from './monetization-config.js';
import { isNativeApp } from '../config.js';
import { track } from './analytics.js';

let plugin = null, ready = false, canRequest = false, privacyRequired = false, initP = null;
let rewardedLoaded = false, interLoaded = false;
let roundsSinceInter = 0, lastInterAt = 0;

const unit = (k) => (MONEY.testAds ? TEST_UNITS[k] : MONEY.adUnits[k]) || '';
const families = () => MONEY.audience === 'families';

function getPlugin() {
  if (plugin) return plugin;
  const C = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!isNativeApp() || !C?.isPluginAvailable?.('AdMob')) return null;
  plugin = C.registerPlugin('AdMob');
  return plugin;
}

export const available = () => !!getPlugin() && (!!unit('rewarded') || !!unit('interstitial'));

/** تهيئة + طلب الموافقة (مرة واحدة) */
export function init() {
  if (initP) return initP;
  initP = (async () => {
    const p = getPlugin();
    if (!p || !available()) return false;
    try {
      await p.initialize({
        initializeForTesting: MONEY.testAds,
        tagForChildDirectedTreatment: families(),
        tagForUnderAgeOfConsent: families(),
        maxAdContentRating: families() ? 'General' : 'ParentalGuidance',
      });
      let info = await p.requestConsentInfo({ tagForUnderAgeOfConsent: families() });
      if (info.status === 'REQUIRED' && info.isConsentFormAvailable) info = await p.showConsentForm();
      canRequest = info.canRequestAds !== false;
      privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
      ready = true;
      preload();
      return true;
    } catch { return false; }
  })();
  return initP;
}

function preload() {
  const p = getPlugin();
  if (!ready || !canRequest) return;
  const npa = families();
  if (!rewardedLoaded && unit('rewarded')) p.prepareRewardVideoAd({ adId: unit('rewarded'), isTesting: MONEY.testAds, npa }).then(() => { rewardedLoaded = true; }).catch(() => {});
  if (!interLoaded && unit('interstitial')) p.prepareInterstitial({ adId: unit('interstitial'), isTesting: MONEY.testAds, npa }).then(() => { interLoaded = true; }).catch(() => {});
}

export const rewardedReady = () => ready && canRequest && rewardedLoaded;

/** يعرض إعلانًا بمكافأة. يعيد true فقط إن أكمل اللاعب المشاهدة */
export async function showRewarded() {
  const p = getPlugin();
  if (!rewardedReady()) return false;
  rewardedLoaded = false;
  try {
    const item = await p.showRewardVideoAd();
    track('ad_rewarded');
    return !!item;
  } catch { return false; } finally { setTimeout(preload, 1000); }
}

/**
 * يُستدعى عند مغادرة شاشة النتائج. يعرض إعلانًا بينيًا إن سمحت كل الشروط.
 * ctx: { data, kind }
 */
export async function maybeInterstitial({ data, kind }) {
  const p = getPlugin();
  if (!ready || !canRequest || !interLoaded) return false;
  if (data.ent?.noAds) return false;
  if (['lesson', 'tutorial', 'online', 'friend'].includes(kind)) return false;
  const c = MONEY.interstitial;
  roundsSinceInter++;
  if ((data.stats?.rounds || 0) < c.minRoundsBeforeFirst) return false;
  if (roundsSinceInter < c.everyRounds) return false;
  if (Date.now() - lastInterAt < c.minSeconds * 1000) return false;
  interLoaded = false;
  try { await p.showInterstitial(); roundsSinceInter = 0; lastInterAt = Date.now(); track('ad_interstitial'); return true; }
  catch { return false; } finally { setTimeout(preload, 1000); }
}

export const privacyOptionsRequired = () => privacyRequired;
export async function showPrivacyOptions() { const p = getPlugin(); if (p) try { await p.showPrivacyOptionsForm(); } catch { /* ignore */ } }
