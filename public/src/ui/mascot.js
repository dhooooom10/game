/* «قطرة» — رمز اللعبة: قطرة ماء نقية بلا وجه، بلمعة وانعكاس.
   مزاجها يظهر بالحركة (قفزة، اهتزاز، توهّج) لا بالملامح.
   لونها وزينتها مظاهر تُفتح بالتقدّم. */

export const SKINS = {
  sky: ['#7BE8FF', '#2BB8EE', '#0B6FA8'],
  mint: ['#9AF5CF', '#2CC98B', '#14855A'],
  rose: ['#FFC4DB', '#FF6FA6', '#C23B73'],
  violet: ['#D6CAFF', '#8F78FF', '#5A3FD6'],
  sun: ['#FFEA9E', '#FFB938', '#D8840F'],
  night: ['#A9B8FF', '#3F55D8', '#1F2C8A'],
};

const ACCS = {
  none: '',
  cap: `<g class="m-acc"><path d="M36 24c2-10 26-10 28 0z" fill="#FF6B7A"/><rect x="32" y="22" width="36" height="5" rx="2.5" fill="#E04857"/><circle cx="50" cy="11" r="3.6" fill="#FFC94A"/></g>`,
  sparkle: `<g class="m-acc m-sparkle" fill="#FFF6C9"><path d="M14 40l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/><path d="M86 60l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z"/><path d="M80 22l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"/></g>`,
  phones: `<g class="m-acc"><path d="M17 74c0-30 66-30 66 0" fill="none" stroke="#2A2F55" stroke-width="5"/><rect x="9" y="66" width="12" height="20" rx="5" fill="#FF6B7A"/><rect x="79" y="66" width="12" height="20" rx="5" fill="#FF6B7A"/></g>`,
  crown: `<g class="m-acc"><path d="M34 27 37 9l7.5 9L50 6l5.5 12L63 9l3 18z" fill="#FFC94A" stroke="#C98A12" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="19" r="2.6" fill="#FF6B7A"/></g>`,
  scarf: `<g class="m-acc"><path d="M18 96q32 12 64 0l-2 9q-30 11-60 0z" fill="#FF6B7A"/><path d="M66 100l4 18 9-3-5-17z" fill="#E04857"/></g>`,
};

/** يعيد سلسلة SVG للقطرة. mood: happy | cheer | think | sad | wow (يحدد الحركة فقط) */
export function mascotSVG({ skin = 'sky', acc = 'none', mood = 'happy', size = 96, label = '' } = {}) {
  const [c1, c2, c3] = SKINS[skin] || SKINS.sky;
  const id = 'm' + Math.random().toString(36).slice(2, 7);
  return `<svg class="mascot mood-${mood}" viewBox="0 -14 100 136" width="${size}" height="${Math.round(size * 1.36)}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="${id}" x1="0.1" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient>
    <radialGradient id="${id}g" cx=".35" cy=".7" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="50" cy="116" rx="26" ry="4" fill="rgba(0,0,0,.2)" class="m-shadow"/>
  <g class="m-body">
    <path d="M50 4C38 26 14 50 14 77a36 36 0 0 0 72 0C86 50 62 26 50 4z" fill="url(#${id})"/>
    <path d="M50 4C38 26 14 50 14 77a36 36 0 0 0 72 0C86 50 62 26 50 4z" fill="url(#${id}g)"/>
    <path d="M50 4C38 26 14 50 14 77a36 36 0 0 0 72 0C86 50 62 26 50 4z" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.6"/>
    <path d="M30 60c-5 9-6 19-3 27" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="38" cy="42" rx="4.5" ry="7" fill="rgba(255,255,255,.75)" transform="rotate(28 38 42)"/>
    <path d="M58 104q12-4 18-16" fill="none" stroke="rgba(0,20,60,.18)" stroke-width="4" stroke-linecap="round"/>
    ${ACCS[acc] || ''}
  </g></svg>`;
}

export function mascotEl(opts) {
  const w = document.createElement('span');
  w.className = 'mascot-wrap';
  w.innerHTML = mascotSVG(opts);
  return w;
}
