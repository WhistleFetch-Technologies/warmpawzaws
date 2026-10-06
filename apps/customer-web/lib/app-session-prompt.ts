/**
 * Once-per-app-session gate for home prompts (sessionStorage — cleared on app relaunch).
 * Fails closed (treated as seen) when storage is unavailable.
 */

export const VENDOR_FEEDBACK_PROMPT_SESSION_KEY = 'warmpawz_vendor_feedback_prompt_seen';

export function hasSeenSessionPrompt(key: string): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return true;
  }
}

export function markSessionPromptSeen(key: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* private mode / quota — fail closed for this session */
  }
}
