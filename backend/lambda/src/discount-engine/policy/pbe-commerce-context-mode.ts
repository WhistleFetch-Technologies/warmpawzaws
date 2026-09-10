export type PbeCommerceContextMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID_MODES: PbeCommerceContextMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Commerce-context rollout for unified PBE surfaces.
 * `PBE_COMMERCE_CONTEXT_MODE` — default OFF (existing WPay amounts only).
 *
 * Phase 2 enables SHADOW only. AUTHORITATIVE is accepted as a value but must
 * never apply Discount Engine V2 to customer-facing WPay amounts.
 */
export function getPbeCommerceContextMode(): PbeCommerceContextMode {
  const raw = process.env.PBE_COMMERCE_CONTEXT_MODE?.trim().toUpperCase();
  if (raw && VALID_MODES.includes(raw as PbeCommerceContextMode)) {
    return raw as PbeCommerceContextMode;
  }
  return 'OFF';
}

/** Shadow evaluate may run. V2 is never authoritative for WPay in Phase 2. */
export function isPbeCommerceContextShadowEnabled(): boolean {
  const mode = getPbeCommerceContextMode();
  return mode === 'SHADOW' || mode === 'AUTHORITATIVE';
}
