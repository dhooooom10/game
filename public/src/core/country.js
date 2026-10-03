/* =========================================================================
   الدولة: تُقترح من لغة الجهاز ومنطقته الزمنية (بلا طلب موقع)، ويمكن للاعب تغييرها.
   الأسماء من Intl.DisplayNames بلغة الواجهة، والأعلام رموز تعبيرية.
   ========================================================================= */
export const COUNTRIES = ('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IQ IN IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW').split(' ');

const TZ = {
  'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Kuwait': 'KW', 'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM', 'Asia/Aden': 'YE',
  'Asia/Baghdad': 'IQ', 'Asia/Amman': 'JO', 'Asia/Damascus': 'SY', 'Asia/Beirut': 'LB', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS', 'Africa/Cairo': 'EG',
  'Africa/Khartoum': 'SD', 'Africa/Tripoli': 'LY', 'Africa/Tunis': 'TN', 'Africa/Algiers': 'DZ', 'Africa/Casablanca': 'MA', 'Africa/Nouakchott': 'MR',
  'Europe/Istanbul': 'TR', 'Asia/Jakarta': 'ID', 'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK', 'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES',
  'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX', 'Europe/Berlin': 'DE', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
};

/** اقتراح الدولة من إعدادات الجهاز (قد يعيد null) */
export function detectCountry() {
  try {
    const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
    for (const l of langs) { const m = /^[a-z]{2,3}[-_]([A-Z]{2})\b/.exec(l || ''); if (m && COUNTRIES.includes(m[1])) return m[1]; }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ[tz]) return TZ[tz];
  } catch { /* ignore */ }
  return null;
}

export const flag = (cc) => cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1F1A5 + c.charCodeAt(0))) : '🏳️';

const cache = new Map();
export function countryName(cc, lang = 'en') {
  if (!cc) return '';
  let dn = cache.get(lang);
  if (!dn) { try { dn = new Intl.DisplayNames([lang], { type: 'region' }); } catch { dn = null; } cache.set(lang, dn); }
  try { return (dn && dn.of(cc)) || cc; } catch { return cc; }
}
