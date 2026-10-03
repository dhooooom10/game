/* =========================================================================
   التحقق من مشتريات Google Play على الخادم (Google Play Developer API).
   لا نثق أبدًا بالجهاز: نسأل Google عن رمز الشراء، ثم نُقرّ به (acknowledge) أو نستهلكه (consume).
   المتطلبات: حساب خدمة (Service account) في Google Cloud مع صلاحية «عرض البيانات المالية/إدارة الطلبات»
   في Play Console ← Users and permissions، ومفتاحه JSON في المتغير GOOGLE_SERVICE_ACCOUNT_JSON
   (محتوى JSON نفسه أو مسار الملف).
   ========================================================================= */
import { createSign } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { HttpError } from './services.js';

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

export function loadServiceAccount(v) {
  if (!v) return null;
  try {
    const txt = v.trim().startsWith('{') ? v : existsSync(v) ? readFileSync(v, 'utf8') : '';
    const j = JSON.parse(txt);
    return j.client_email && j.private_key ? j : null;
  } catch { return null; }
}

export function createGooglePlay({ packageName = '', serviceAccount = null, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const enabled = !!(packageName && serviceAccount);
  let token = null, tokenExp = 0;

  async function accessToken() {
    if (token && now() < tokenExp - 60000) return token;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const iat = Math.floor(now() / 1000);
    const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: serviceAccount.client_email, scope: SCOPE, aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
    const sig = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url');
    const r = await fetchImpl(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new HttpError(502, 'play_auth_failed');
    token = j.access_token; tokenExp = now() + (j.expires_in || 3600) * 1000;
    return token;
  }

  async function call(method, path, body) {
    const r = await fetchImpl(`${API}/${encodeURIComponent(packageName)}${path}`, {
      method, headers: { Authorization: 'Bearer ' + (await accessToken()), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000),
    });
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (r.status === 404 || r.status === 400 || r.status === 410) throw new HttpError(400, 'purchase_invalid');
    if (!r.ok) throw new HttpError(502, 'play_api_failed');
    return j;
  }

  const p = (productId, tok) => `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(tok)}`;
  return {
    enabled,
    /** يعيد تفاصيل الشراء من Google: { purchased, acknowledged, consumed, orderId, accountId } */
    async getProduct(productId, purchaseToken) {
      if (!enabled) throw new HttpError(501, 'billing_disabled');
      const j = await call('GET', p(productId, purchaseToken));
      return { purchased: j.purchaseState === 0, acknowledged: j.acknowledgementState === 1, consumed: j.consumptionState === 1,
        orderId: j.orderId || null, accountId: j.obfuscatedExternalAccountId || null, testPurchase: j.purchaseType === 0 };
    },
    acknowledge: (productId, purchaseToken) => call('POST', p(productId, purchaseToken) + ':acknowledge', {}),
    consume: (productId, purchaseToken) => call('POST', p(productId, purchaseToken) + ':consume'),
  };
}
