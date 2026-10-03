/* «قطرة» — شخصية اللعبة الأصلية (SVG مرسوم بالكود). مزاجها يتغيّر مع اللعب،
   ولونها وإكسسوارها مظاهر تُفتح بالتقدّم. */

export const SKINS = {
  sky: ['#5BE1FF', '#1FA8E0', '#0B6FA8'],
  mint: ['#7DF0C0', '#2CC98B', '#14855A'],
  rose: ['#FFB3D1', '#FF6FA6', '#C23B73'],
  violet: ['#C9B8FF', '#8F78FF', '#5A3FD6'],
  sun: ['#FFE38A', '#FFB938', '#D8840F'],
  night: ['#8EA2FF', '#3F55D8', '#1F2C8A'],
};

const ACCS = {
  none: '',
  cap: `<g class="m-acc"><path d="M34 22c2-10 30-10 32 0z" fill="#FF6B7A"/><rect x="30" y="20" width="40" height="5" rx="2.5" fill="#E04857"/><circle cx="50" cy="9" r="4" fill="#FFC94A"/></g>`,
  glasses: `<g class="m-acc" fill="none" stroke="#1B2140" stroke-width="3"><circle cx="37" cy="73" r="9" fill="rgba(255,255,255,.25)"/><circle cx="63" cy="73" r="9" fill="rgba(255,255,255,.25)"/><path d="M46 72q4-3 8 0M28 71l-9-4M72 71l9-4"/></g>`,
  phones: `<g class="m-acc"><path d="M17 74c0-30 66-30 66 0" fill="none" stroke="#2A2F55" stroke-width="5"/><rect x="9" y="66" width="12" height="20" rx="5" fill="#FF6B7A"/><rect x="79" y="66" width="12" height="20" rx="5" fill="#FF6B7A"/></g>`,
  crown: `<g class="m-acc"><path d="M33 26 36 8l8 9 6-12 6 12 8-9 3 18z" fill="#FFC94A" stroke="#C98A12" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="18" r="2.6" fill="#FF6B7A"/></g>`,
  scarf: `<g class="m-acc"><path d="M18 96q32 12 64 0l-2 9q-30 11-60 0z" fill="#FF6B7A"/><path d="M66 100l4 18 9-3-5-17z" fill="#E04857"/></g>`,
};

const MOUTH = {
  happy: '<path d="M41 86q9 9 18 0" fill="none" stroke="#14233F" stroke-width="3.4" stroke-linecap="round"/>',
  cheer: '<path d="M39 84q11 15 22 0z" fill="#14233F"/><path d="M44 89q6 4 12 0" fill="#FF8FA3"/>',
  think: '<ellipse cx="52" cy="89" rx="4" ry="3.4" fill="#14233F"/>',
  sad: '<path d="M42 92q8-7 16 0" fill="none" stroke="#14233F" stroke-width="3.4" stroke-linecap="round"/>',
  wow: '<ellipse cx="50" cy="90" rx="5.5" ry="6.5" fill="#14233F"/>',
};

const EYES = {
  open: '<g class="m-eyes"><circle cx="37" cy="73" r="6.4" fill="#fff"/><circle cx="63" cy="73" r="6.4" fill="#fff"/><circle cx="38" cy="74" r="3.6" fill="#14233F"/><circle cx="64" cy="74" r="3.6" fill="#14233F"/><circle cx="39.4" cy="72.4" r="1.3" fill="#fff"/><circle cx="65.4" cy="72.4" r="1.3" fill="#fff"/></g>',
  smile: '<g class="m-eyes" fill="none" stroke="#14233F" stroke-width="3.4" stroke-linecap="round"><path d="M31 75q6-7 12 0"/><path d="M57 75q6-7 12 0"/></g>',
};

/** يعيد سلسلة SVG للشخصية */
export function mascotSVG({ skin = 'sky', acc = 'none', mood = 'happy', size = 96, label = '' } = {}) {
  const [c1, c2, c3] = SKINS[skin] || SKINS.sky;
  const id = 'm' + Math.random().toString(36).slice(2, 7);
  const eyes = mood === 'cheer' ? EYES.smile : EYES.open;
  return `<svg class="mascot mood-${mood}" viewBox="0 -14 100 136" width="${size}" height="${Math.round(size * 1.36)}" role="img" aria-label="${label}">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".6" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>
  <ellipse cx="50" cy="116" rx="26" ry="4" fill="rgba(0,0,0,.18)" class="m-shadow"/>
  <g class="m-body">
    <path d="M50 4C38 26 14 50 14 77a36 36 0 0 0 72 0C86 50 62 26 50 4z" fill="url(#${id})"/>
    <path d="M50 4C38 26 14 50 14 77a36 36 0 0 0 72 0C86 50 62 26 50 4z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
    <ellipse cx="32" cy="52" rx="6" ry="11" fill="rgba(255,255,255,.55)" transform="rotate(24 32 52)"/>
    <circle cx="27" cy="85" r="5.5" fill="#FF8FA3" opacity=".55"/><circle cx="73" cy="85" r="5.5" fill="#FF8FA3" opacity=".55"/>
    ${eyes}${MOUTH[mood] || MOUTH.happy}${ACCS[acc] || ''}
  </g></svg>`;
}

export function mascotEl(opts) {
  const w = document.createElement('span');
  w.className = 'mascot-wrap';
  w.innerHTML = mascotSVG(opts);
  return w;
}
