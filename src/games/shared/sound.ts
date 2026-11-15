/**
 * Small synthesized sound effects (Web Audio, no files to download). Muting is remembered per device.
 * Browsers only allow audio after a tap, so the context is created lazily and resumed on the first gesture.
 */

export type SoundName = 'move' | 'click' | 'hit' | 'miss' | 'sunk' | 'alert' | 'win' | 'lose' | 'coin' | 'spin' | 'card' | 'pop' | 'wrong' | 'clue';

const MUTE_KEY = 'ndj-muted';
let ctx: AudioContext | null = null;
let muted = loadMuted();
const listeners = new Set<() => void>();

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable: the choice lasts for this visit.
  }
  listeners.forEach(l => l());
}

export function onMuteChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Unlock audio on the first tap so sounds triggered by other players' moves can play.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

interface Tone {
  freq: number;
  /** Frequency at the end, for a slide. */
  to?: number;
  start: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function tones(list: Tone[]): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime + 0.01;
  for (const t of list) {
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.freq, now + t.start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, now + t.start + t.dur);
    const peak = t.gain ?? 0.18;
    amp.gain.setValueAtTime(0.0001, now + t.start);
    amp.gain.exponentialRampToValueAtTime(peak, now + t.start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.dur + 0.05);
  }
}

/** A short burst of filtered noise: splashes and booms. */
function noise(dur: number, freq: number, gain: number, start = 0): void {
  const ac = audio();
  if (!ac) return;
  const length = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(ac.currentTime + 0.01 + start);
}

const SOUNDS: Record<SoundName, () => void> = {
  move: () => tones([{ freq: 220, to: 160, start: 0, dur: 0.09, type: 'triangle', gain: 0.25 }]),
  click: () => tones([{ freq: 660, start: 0, dur: 0.05, type: 'square', gain: 0.05 }]),
  pop: () => tones([{ freq: 520, to: 880, start: 0, dur: 0.12, type: 'sine', gain: 0.16 }]),
  hit: () => {
    noise(0.35, 900, 0.5);
    tones([{ freq: 140, to: 60, start: 0, dur: 0.3, type: 'sawtooth', gain: 0.12 }]);
  },
  miss: () => noise(0.4, 2400, 0.22),
  sunk: () => {
    noise(0.8, 500, 0.6);
    tones([
      { freq: 110, to: 40, start: 0, dur: 0.8, type: 'sawtooth', gain: 0.14 },
      { freq: 392, start: 0.15, dur: 0.18, type: 'triangle' },
      { freq: 311, start: 0.33, dur: 0.18, type: 'triangle' },
      { freq: 262, start: 0.51, dur: 0.35, type: 'triangle' },
    ]);
  },
  alert: () => tones([
    { freq: 880, start: 0, dur: 0.12, type: 'square', gain: 0.06 },
    { freq: 880, start: 0.16, dur: 0.12, type: 'square', gain: 0.06 },
  ]),
  win: () => tones([
    { freq: 523, start: 0, dur: 0.14, type: 'triangle' },
    { freq: 659, start: 0.12, dur: 0.14, type: 'triangle' },
    { freq: 784, start: 0.24, dur: 0.14, type: 'triangle' },
    { freq: 1047, start: 0.36, dur: 0.45, type: 'triangle' },
  ]),
  lose: () => tones([
    { freq: 392, start: 0, dur: 0.22, type: 'triangle' },
    { freq: 330, start: 0.22, dur: 0.22, type: 'triangle' },
    { freq: 262, start: 0.44, dur: 0.5, type: 'triangle' },
  ]),
  coin: () => tones([
    { freq: 988, start: 0, dur: 0.08, type: 'square', gain: 0.07 },
    { freq: 1319, start: 0.07, dur: 0.25, type: 'square', gain: 0.07 },
  ]),
  spin: () => tones(Array.from({ length: 14 }, (_, i) => ({ freq: 900, start: i * (0.04 + i * 0.006), dur: 0.03, type: 'square' as const, gain: 0.04 }))),
  card: () => noise(0.12, 4000, 0.15),
  wrong: () => tones([{ freq: 200, to: 120, start: 0, dur: 0.25, type: 'sawtooth', gain: 0.08 }]),
  /** A soft rising chime: a message has arrived. */
  clue: () => tones([
    { freq: 659, start: 0, dur: 0.18, type: 'sine', gain: 0.16 },
    { freq: 988, start: 0.11, dur: 0.38, type: 'sine', gain: 0.14 },
    { freq: 1319, start: 0.11, dur: 0.3, type: 'sine', gain: 0.04 },
  ]),
};

export function playSound(name: SoundName): void {
  if (muted) return;
  try {
    SOUNDS[name]();
  } catch {
    // Audio is a nicety; never let it break a move.
  }
}
