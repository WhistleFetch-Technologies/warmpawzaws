export type ResolverMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID_MODES: ResolverMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Production HTTP resolver rollout — `DISCOUNT_ENGINE_V2_RESOLVER_MODE`.
 * Default OFF preserves legacy-only behaviour (Phase 8 pre-cutover).
 */
export function getResolverMode(): ResolverMode {
  const raw = process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE?.trim().toUpperCase();
  if (raw && VALID_MODES.includes(raw as ResolverMode)) {
    return raw as ResolverMode;
  }
  return 'OFF';
}

export function isResolverShadowMode(): boolean {
  return getResolverMode() === 'SHADOW';
}

export function isResolverAuthoritative(): boolean {
  return getResolverMode() === 'AUTHORITATIVE';
}

export function isResolverEnabled(): boolean {
  return getResolverMode() !== 'OFF';
}
