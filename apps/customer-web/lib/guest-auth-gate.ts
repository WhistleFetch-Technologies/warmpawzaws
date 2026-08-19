/**
 * Guest authentication boundary helpers — login before customer-owned ops.
 * Guest is browsing-enabled AND no authenticated session (phone + JWT), not merely !phone.
 */

import { buildAuthUrlWithReturn } from './auth-redirect';
import { getStoredCustomerJwtForSession } from './session-utils';
import { enqueueAllyticasEvent } from './allyticas-ingest';
import { isGuestBrowsingEnabled } from './guest-browsing-flag';

export function hasAuthenticatedCustomerSession(): boolean {
  if (typeof window === 'undefined') return false;
  const phone = localStorage.getItem('customerPhone');
  const token = getStoredCustomerJwtForSession();
  return !!(phone && token);
}

/** Explicit application guest state — not `!phone` alone. */
export function isGuestApplicationState(): boolean {
  return isGuestBrowsingEnabled() && !hasAuthenticatedCustomerSession();
}

export type GuestConversionEvent =
  | 'login_prompt_shown'
  | 'login_started'
  | 'login_completed'
  | 'identity_authenticated'
  | 'pet_add_attempted'
  | 'pet_add_auth_required'
  | 'guest_home_viewed'
  | 'booking_resumed'
  | 'search_started'
  | 'search_result_viewed'
  | 'vendor_viewed'
  | 'service_viewed'
  | 'slot_viewed'
  | 'booking_started'
  | 'checkout_started'
  | 'payment_started'
  | 'payment_failed'
  | 'booking_completed'
  | 'booking_abandoned'
  | 'cart_abandoned';

export function emitGuestAuthAnalytics(
  eventName: GuestConversionEvent,
  extra?: Record<string, unknown>
): void {
  try {
    enqueueAllyticasEvent({
      event_type: 'custom',
      event_name: eventName,
      properties: { source: 'guest_auth_boundary', ...(extra || {}) },
    });
  } catch {
    // analytics must never block UX
  }
}

/** Navigate to /auth with safe return; emits login_prompt_shown + login_started. */
export function redirectGuestToLogin(returnPath: string): void {
  emitGuestAuthAnalytics('login_prompt_shown');
  emitGuestAuthAnalytics('login_started');
  if (typeof window !== 'undefined') {
    window.location.href = buildAuthUrlWithReturn(returnPath || '/');
  }
}
