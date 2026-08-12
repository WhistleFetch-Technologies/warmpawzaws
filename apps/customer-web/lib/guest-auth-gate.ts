/**
 * Guest authentication boundary helpers — login before customer-owned ops.
 */

import { buildAuthUrlWithReturn } from './auth-redirect';
import { getStoredCustomerJwtForSession } from './session-utils';
import { enqueueAllyticasEvent } from './allyticas-ingest';

export function hasAuthenticatedCustomerSession(): boolean {
  if (typeof window === 'undefined') return false;
  const phone = localStorage.getItem('customerPhone');
  const token = getStoredCustomerJwtForSession();
  return !!(phone && token);
}

export function emitGuestAuthAnalytics(
  eventName:
    | 'login_prompt_shown'
    | 'login_started'
    | 'login_completed'
    | 'identity_authenticated'
    | 'pet_add_attempted'
    | 'pet_add_auth_required'
    | 'guest_home_viewed'
    | 'booking_resumed'
): void {
  try {
    enqueueAllyticasEvent({
      event_type: 'custom',
      event_name: eventName,
      properties: { source: 'guest_auth_boundary' },
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
