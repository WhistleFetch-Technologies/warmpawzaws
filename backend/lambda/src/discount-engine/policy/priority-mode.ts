export type PriorityMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID_MODES: PriorityMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Resolves priority rollout mode from `DISCOUNT_ENGINE_V2_PRIORITY_MODE`.
 * Default: AUTHORITATIVE.
 *
 * Legacy `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW=false` maps to OFF when MODE is unset.
 */
export function getPriorityMode(): PriorityMode {
  const raw = process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE?.trim().toUpperCase();
  if (raw && VALID_MODES.includes(raw as PriorityMode)) {
    return raw as PriorityMode;
  }
  if (process.env.DISCOUNT_ENGINE_V2_PRIORITY_SHADOW === 'false') {
    return 'OFF';
  }
  if (process.env.DISCOUNT_ENGINE_V2_PRIORITY_SHADOW === 'true') {
    return 'SHADOW';
  }
  return 'AUTHORITATIVE';
}

export function isPriorityEnabled(): boolean {
  return getPriorityMode() !== 'OFF';
}

/** @deprecated Use getPriorityMode() === 'SHADOW' */
export function isPriorityShadowEnabled(): boolean {
  return getPriorityMode() === 'SHADOW';
}

export function isPriorityAuthoritative(): boolean {
  return getPriorityMode() === 'AUTHORITATIVE';
}
