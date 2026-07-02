export type StackMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID_MODES: StackMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Resolves stack rollout mode from `DISCOUNT_ENGINE_V2_STACK_MODE`.
 * Default: AUTHORITATIVE (when priority is authoritative and stack runs).
 */
export function getStackMode(): StackMode {
  const raw = process.env.DISCOUNT_ENGINE_V2_STACK_MODE?.trim().toUpperCase();
  if (raw && VALID_MODES.includes(raw as StackMode)) {
    return raw as StackMode;
  }
  return 'AUTHORITATIVE';
}

export function isStackEnabled(): boolean {
  return getStackMode() !== 'OFF';
}

export function isStackShadowMode(): boolean {
  return getStackMode() === 'SHADOW';
}

export function isStackAuthoritative(): boolean {
  return getStackMode() === 'AUTHORITATIVE';
}
