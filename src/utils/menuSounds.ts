/**
 * Short Web Audio UI cues for menus (no external assets).
 * Uses a single shared AudioContext where possible.
 */

let menuAudioContext: AudioContext | null = null;

function getMenuAudioContext(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!menuAudioContext || menuAudioContext.state === 'closed') {
      menuAudioContext = new AC();
    }
    if (menuAudioContext.state === 'suspended') {
      void menuAudioContext.resume();
    }
    return menuAudioContext;
  } catch {
    return null;
  }
}

function beep(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType,
  peakGain: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration + 0.02);
}

/** Generic menu button / navigation click */
export function playMenuButtonSound(): void {
  const ctx = getMenuAudioContext();
  if (!ctx) return;
  beep(ctx, 920, 0.05, 'square', 0.055);
}

/** Turning a threat / toggle ON */
export function playMenuToggleOnSound(): void {
  const ctx = getMenuAudioContext();
  if (!ctx) return;
  beep(ctx, 520, 0.045, 'sine', 0.07);
  beep(ctx, 780, 0.04, 'sine', 0.055);
}

/** Turning a threat / toggle OFF */
export function playMenuToggleOffSound(): void {
  const ctx = getMenuAudioContext();
  if (!ctx) return;
  beep(ctx, 720, 0.04, 'sine', 0.06);
  beep(ctx, 380, 0.055, 'sine', 0.05);
}

/** Same chime used when starting a night from the menu */
export function playGameStartChime(): void {
  const ctx = getMenuAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore
  }
}
