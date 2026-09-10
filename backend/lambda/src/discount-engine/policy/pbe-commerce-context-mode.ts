export type PbeCommerceContextMode = 'OFF' | 'SHADOW' | 'AUTHORITATIVE';

const VALID_MODES: PbeCommerceContextMode[] = ['OFF', 'SHADOW', 'AUTHORITATIVE'];

/**
 * Commerce-context rollout for unified PBE surfaces.
 * `PBE_COMMERCE_CONTEXT_MODE` — default OFF (existing WPay / Appointment amounts).
 *
 * SHADOW: Discount Engine V2 evaluates Pay Bill and Appointment beside the
 * existing money path. AUTHORITATIVE is accepted as a value but must never
 * apply V2 to customer-facing WPay or Appointment amounts in Phase 2/3.
 */
export function getPbeCommerceContextMode(): PbeCommerceContextMode {
  const raw = process.env.PBE_COMMERCE_CONTEXT_MODE?.trim().toUpperCase();
  if (raw && VALID_MODES.includes(raw as PbeCommerceContextMode)) {
    return raw as PbeCommerceContextMode;
  }
  return 'OFF';
}

/** Shadow evaluate may run. V2 is never authoritative for WPay/Appointment in Phase 2/3. */
export function isPbeCommerceContextShadowEnabled(): boolean {
  const mode = getPbeCommerceContextMode();
  return mode === 'SHADOW' || mode === 'AUTHORITATIVE';
}
