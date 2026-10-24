/* الصوت: مؤثرات قصيرة وموسيقى هادئة مولّدة برمجيًا (Web Audio) — بلا ملفات.
   تحكّم مستقل بمستوى المؤثرات والموسيقى. */

let AC = null, sfxGain = null, musicGain = null;
let levels = { sfx: 0.8, music: 0.3 };
let musicTimer = null, nextNoteTime = 0, step = 0, musicWanted = false;

function ctx() {
  if (AC) return AC;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    AC = new C();
    sfxGain = AC.createGain(); sfxGain.gain.value = levels.sfx; sfxGain.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.gain.value = levels.music * 0.5; musicGain.connect(AC.destination);
  } catch { AC = null; }
  return AC;
}

/** يُستدعى عند أول لمسة (سياسات المتصفح تمنع الصوت قبلها) */
export function unlockAudio() {
  const c = ctx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  if (musicWanted) startMusic();
}

export function setLevels({ sfx, music }) {
  if (sfx != null) levels.sfx = sfx;
  if (music != null) levels.music = music;
  if (sfxGain) sfxGain.gain.value = levels.sfx;
  if (musicGain) musicGain.gain.setTargetAtTime(levels.music * 0.5, AC.currentTime, 0.1);
  if (levels.music <= 0) stopMusic(); else if (musicWanted) startMusic();
}

function tone(freq, dur = 0.12, type = 'sine', delay = 0, vol = 0.2, dest = null) {
  const c = ctx();
  if (!c || (dest == null && levels.sfx <= 0)) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  o.connect(g); g.connect(dest || sfxGain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.03);
}

/** ضوضاء مرشّحة قصيرة (رذاذ/نقرة/اندفاع) — تعطي الأصوات ملمسًا مائيًا */
let noiseBuf = null;
function noise(dur = 0.1, vol = 0.1, freq = 1500, sweep = false) {
  const c = ctx();
  if (!c || levels.sfx <= 0) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = 0.9;
  if (sweep) f.frequency.exponentialRampToValueAtTime(freq * 4, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t); src.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(420, 0.05, 'triangle', 0, 0.08),
  key: () => tone(560, 0.04, 'triangle', 0, 0.06),
  correct: () => { tone(660, 0.1, 'sine', 0, 0.18); tone(990, 0.14, 'sine', 0.07, 0.16); },
  wrong: () => { tone(220, 0.16, 'triangle', 0, 0.16); tone(180, 0.2, 'triangle', 0.08, 0.12); },
  combo: () => [784, 988, 1319].forEach((f, i) => tone(f, 0.09, 'triangle', i * 0.05, 0.12)),
  tick: () => tone(1200, 0.03, 'square', 0, 0.03),
  // الطبقة ترتفع مع السلسلة (حتى أوكتاف تقريبًا) — إحساس «الاندفاع»
  // «بوب» مائي: نقرة ناعمة + نغمتان ترتفعان مع السلسلة، ولمعة إضافية من ٥ متتالية
  pop: (streak = 0) => {
    const k = Math.pow(2, Math.min(12, Math.max(0, streak - 1)) / 12);
    noise(0.05, 0.10, 2200); tone(620 * k, 0.07, 'sine', 0, 0.17); tone(1240 * k, 0.1, 'sine', 0.045, 0.12);
    if (streak >= 5) tone(1860 * k, 0.12, 'triangle', 0.09, 0.07);
  },
  whoosh: () => noise(0.35, 0.12, 900, true),
  fever: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'square', i * 0.06, 0.07)),
  gift: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.1, 'triangle', i * 0.07, 0.11)),
  record: () => [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', i * 0.08, 0.13)),
  splash: () => { noise(0.25, 0.14, 700); tone(200, 0.18, 'sine', 0, 0.14); tone(120, 0.26, 'triangle', 0.05, 0.11); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', i * 0.1, 0.16)),
  fanfare: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', i * 0.09, 0.14)),
  lose: () => [440, 392, 330].forEach((f, i) => tone(f, 0.22, 'sine', i * 0.13, 0.12)),
  count: () => tone(520, 0.1, 'sine', 0, 0.12),
  go: () => tone(880, 0.22, 'sine', 0, 0.16),
  reward: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'sine', i * 0.06, 0.1)),
};

/* ---------- موسيقى خفيفة: arpeggio خماسي هادئ ---------- */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const PATTERN = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 6, 5, 4, 2, 3];
const BASS = [130.81, 130.81, 110.0, 110.0, 146.83, 146.83, 98.0, 123.47];
const BEAT = 0.36;

function schedule() {
  const c = ctx(); if (!c) return;
  while (nextNoteTime < c.currentTime + 0.6) {
    const d = nextNoteTime - c.currentTime;
    const n = PATTERN[step % PATTERN.length];
    if (step % 2 === 0 || n % 2 === 0) tone(SCALE[n], 0.5, 'triangle', d, 0.07, musicGain);
    if (step % 4 === 0) tone(BASS[(step / 4) % BASS.length], 1.3, 'sine', d, 0.09, musicGain);
    nextNoteTime += BEAT; step++;
  }
}
/** الموسيقى أُزيلت من اللعبة (المؤثرات فقط). تبقى الدالة للتوافق. */
export function startMusic() { musicWanted = false; }
export function stopMusic(keepWanted = false) {
  if (!keepWanted) musicWanted = false;
  clearInterval(musicTimer); musicTimer = null;
}
export function pauseAll() { stopMusic(true); if (AC && AC.state === 'running') AC.suspend().catch(() => {}); }
export function resumeAll() { if (AC && AC.state === 'suspended') AC.resume().then(() => { if (musicWanted) startMusic(); }).catch(() => {}); }

/* ---------- الاهتزاز (اختياري حيث تدعمه المنصة) ---------- */
let hapticsOn = true;
export const hapticsSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export function setHaptics(on) { hapticsOn = !!on; }
export function buzz(pattern) {
  if (!hapticsOn || !hapticsSupported()) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}
