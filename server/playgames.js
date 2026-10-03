/* =========================================================================
   Google Play Games Services (v2) — التحقق من هوية اللاعب على الخادم.
   التطبيق (Android) يطلب «رمز وصول للخادم» serverAuthCode من Play Games،
   ويرسله إلينا؛ نستبدله بـ access token من Google ثم نقرأ معرّف اللاعب.
   لا نثق أبدًا بمعرّف يرسله العميل مباشرة.
   المتطلبات (متغيرات البيئة): GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET
   (عميل OAuth من نوع «Web application» في مشروع Google Cloud المرتبط بـ Play Console).
   ========================================================================= */
import { HttpError } from './services.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PLAYER_URL = 'https://www.googleapis.com/games/v1/players/me';

export function createPlayGames({ clientId = '', clientSecret = '', fetchImpl = globalThis.fetch } = {}) {
  const enabled = !!(clientId && clientSecret);
  return {
    enabled,
    /** يعيد { playerId, displayName } أو يرمي HttpError */
    async verify(authCode) {
      if (!enabled) throw new HttpError(501, 'playgames_disabled');
      if (typeof authCode !== 'string' || authCode.length < 10 || authCode.length > 2048) throw new HttpError(400, 'bad_code');
      const ctl = AbortSignal.timeout(8000);
      let tok;
      try {
        const r = await fetchImpl(TOKEN_URL, {
          method: 'POST', signal: ctl,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code: authCode, client_id: clientId, client_secret: clientSecret, redirect_uri: '' }).toString(),
        });
        tok = await r.json().catch(() => ({}));
        if (!r.ok || !tok.access_token) throw new HttpError(401, 'playgames_rejected');
      } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(502, 'playgames_unreachable'); }
      let me;
      try {
        const r = await fetchImpl(PLAYER_URL, { headers: { Authorization: 'Bearer ' + tok.access_token }, signal: AbortSignal.timeout(8000) });
        me = await r.json().catch(() => ({}));
        if (!r.ok || !me.playerId) throw new HttpError(401, 'playgames_rejected');
      } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(502, 'playgames_unreachable'); }
      return { playerId: String(me.playerId), displayName: String(me.displayName || '') };
    },
  };
}
