/**
 * Sensory feedback utilities — haptic + optional sound for satisfying micro-rewards.
 * Pref stored in localStorage so users can disable sound.
 */

const SOUND_KEY = 'honsgarden-feedback-sound';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOUND_KEY) !== '0';
}

export function setSoundEnabled(on: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_KEY, on ? '1' : '0');
}

/** Short tap — used on every save/log */
export function hapticTap() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  } catch {}
}

/** Stronger celebration pattern — used for milestones / new records */
export function hapticCelebrate() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 40, 30, 40, 60]);
    }
  } catch {}
}

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      _ctx = new Ctx();
    }
    if (_ctx?.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, when = 0, type: OscillatorType = 'sine', gain = 0.08) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
  g.gain.setValueAtTime(0, ctx.currentTime + when);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + duration + 0.02);
}

/** Soft pling for a normal log */
export function soundPling() {
  if (!isSoundEnabled()) return;
  tone(880, 0.18, 0, 'sine', 0.06);
  tone(1320, 0.22, 0.05, 'sine', 0.05);
}

/** Triumphant chime for personal record / milestone */
export function soundCelebrate() {
  if (!isSoundEnabled()) return;
  tone(660, 0.18, 0, 'triangle', 0.07);
  tone(880, 0.18, 0.12, 'triangle', 0.07);
  tone(1320, 0.32, 0.24, 'triangle', 0.08);
}

/** One-call satisfying tap (haptic + pling) */
export function feedbackTap() {
  hapticTap();
  soundPling();
}

/** One-call milestone (haptic burst + chime) */
export function feedbackCelebrate() {
  hapticCelebrate();
  soundCelebrate();
}
