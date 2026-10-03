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
  // مظاهر المتجر
  ember: ['#FFC2A0', '#FF6A3D', '#C2410C'],
  lime: ['#E2FF9A', '#8BE33D', '#4D8F12'],
  glacier: ['#F2FDFF', '#A6F0FF', '#3AA9CF'],
  neon: ['#FFB0F7', '#E040FB', '#8E24AA'],
  season: ['#FFF3B0', '#FFC94A', '#B9851A'],
};

const ACCS = {
  none: '',
  cap: `<g class="m-acc"><path d="M36 24c2-10 26-10 28 0z" fill="#FF6B7A"/><rect x="32" y="22" width="36" height="5" rx="2.5" fill="#E04857"/><circle cx="50" cy="11" r="3.6" fill="#FFC94A"/></g>`,
  sparkle: `<g class="m-acc m-sparkle" fill="#FFF6C9"><path d="M14 40l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/><path d="M86 60l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z"/><path d="M80 22l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"/></g>`,
  phones: `<g class="m-acc"><path d="M17 74c0-30 66-30 66 0" fill="none" stroke="#2A2F55" stroke-width="5"/><rect x="9" y="66" width="12" height="20" rx="5" fill="#FF6B7A"/><rect x="79" y="66" width="12" height="20" rx="5" fill="#FF6B7A"/></g>`,
  crown: `<g class="m-acc"><path d="M34 27 37 9l7.5 9L50 6l5.5 12L63 9l3 18z" fill="#FFC94A" stroke="#C98A12" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="19" r="2.6" fill="#FF6B7A"/></g>`,
  halo: `<g class="m-acc"><ellipse cx="50" cy="-4" rx="18" ry="5" fill="none" stroke="#FFE27A" stroke-width="3.2"/><ellipse cx="50" cy="-4" rx="18" ry="5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1"/></g>`,
  star: `<g class="m-acc"><path d="M50 -12l3.6 7.4 8.2 1.2-5.9 5.8 1.4 8.1L50 6.6l-7.3 3.9 1.4-8.1-5.9-5.8 8.2-1.2z" fill="#FFD45E" stroke="#B9851A" stroke-width="1.4" stroke-linejoin="round"/></g>`,
  scarf: `<g class="m-acc"><path d="M18 96q32 12 64 0l-2 9q-30 11-60 0z" fill="#FF6B7A"/><path d="M66 100l4 18 9-3-5-17z" fill="#E04857"/></g>`,
};

/** يعيد سلسلة SVG للقطرة. mood: happy | cheer | think | sad | wow (يحدد الحركة فقط) */
export function mascotSVG({ skin = 'sky', acc = 'none', mood = 'happy', size = 96, label = '' } = {}) {
  const [c1, c2, c3] = SKINS[skin] || SKINS.sky;
  const id = 'm' + Math.random().toString(36).slice(2, 7);
  return `<svg class="mascot mood-${mood}" viewBox="0 -14 100 136" width="${size}" height="${Math.round(size * 1.36)}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="${c1}" stop-opacity=".35"/><stop offset=".55" stop-color="${c2}" stop-opacity=".14"/><stop offset="1" stop-color="${c2}" stop-opacity=".3"/></linearGradient>
  </defs>
  <ellipse cx="50" cy="116" rx="24" ry="3.5" fill="${c2}" fill-opacity=".25" class="m-shadow"/>
  <g class="m-body">
    <path d="M50 4C38 26 14 50 14 77a36 36 0 0 0 72 0C86 50 62 26 50 4z" fill="url(#${id})"/>
    <path d="M50 4C38 26 14 50 14 77a36 36 0 0 0 72 0C86 50 62 26 50 4z" fill="none" stroke="${c1}" stroke-width="2.6"/>
    <path d="M37 33c-5 7-8 13-10 20" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M40 106q16 5 30-6" fill="none" stroke="${c1}" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>
    ${ACCS[acc] || ''}
  </g></svg>`;
}

export function mascotEl(opts) {
  const w = document.createElement('span');
  w.className = 'mascot-wrap';
  w.innerHTML = mascotSVG(opts);
  return w;
}
