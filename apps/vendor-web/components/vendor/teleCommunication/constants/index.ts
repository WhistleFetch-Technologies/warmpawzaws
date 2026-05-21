export const CHAT_TOPIC = 'chat-message';
export const TYPING_TOPIC = 'typing-indicator';
export const CALL_ENDED_TOPIC = 'call-ended';
export const MEDIA_STATE_TOPIC = 'call-media-state';
/** Fallback when API timer is unavailable (matches backend default). */
export const DEFAULT_CALL_SLOT_SECONDS = 30 * 60;
export const MESSAGE_LIFETIME_MS = 300000; // 5 minutes

export interface CallTimerPayload {
  serviceDurationMinutes?: number;
  serviceDurationSeconds?: number;
  consultationStartedAt?: string | null;
  callRemainingSeconds?: number;
  consultationActive?: boolean;
  timerPaused?: boolean;
  timerRunningSince?: string | null;
  timerBaseSeconds?: number | null;
}

/** Client-side remaining time (pausable — uses frozen base at run start or paused absolute). */
export function computeClientCallRemaining(
  serviceDurationSeconds: number,
  opts: {
    timerRunningSince?: string | null;
    timerBaseSeconds?: number | null;
    timerPaused?: boolean;
  } = {}
): number {
  const slot = Math.max(0, Math.round(serviceDurationSeconds) || 0);
  const runningSince = opts.timerRunningSince;

  if (!opts.timerPaused && runningSince) {
    const started = new Date(runningSince).getTime();
    if (!Number.isNaN(started)) {
      const base =
        opts.timerBaseSeconds != null ? Math.max(0, opts.timerBaseSeconds) : slot;
      const elapsed = Math.floor((Date.now() - started) / 1000);
      return Math.max(0, base - elapsed);
    }
  }
  if (opts.timerBaseSeconds != null && opts.timerBaseSeconds >= 0) {
    return opts.timerBaseSeconds;
  }
  return slot;
}
