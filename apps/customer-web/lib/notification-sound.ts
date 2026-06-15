/**
 * In-app notification alert sound (Web Audio API).
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

function playBeep(frequency: number, durationSec: number, volume: number, delayMs = 0): void {
  window.setTimeout(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationSec);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + durationSec);
    } catch {
      /* ignore */
    }
  }, delayMs);
}

/** Two-tone alert for support replies and inbox updates */
export function playNotificationAlertSound(): void {
  playBeep(800, 0.15, 0.2, 0);
  playBeep(1000, 0.15, 0.2, 150);
}
