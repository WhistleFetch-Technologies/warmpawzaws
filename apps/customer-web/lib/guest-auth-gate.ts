/**
 * Guest authentication boundary helpers — login before customer-owned ops.
 * Guest is browsing-enabled AND no authenticated session (phone + JWT), not merely !phone.
 */

import { buildAuthLoginUrl, buildAuthUrlWithReturn } from './auth-redirect';
import { isGuestBrowsingEnabled } from './guest-browsing-flag';
import {
  persistGuestBookingIntentForAuth,
  type GuestBookingIntentV1,
} from './guest-booking-intent';
import { getStoredCustomerJwtForSession } from './session-utils';
import { enqueueAllyticasEvent } from './allyticas-ingest';

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

export type GuestAuthRequestOptions = {
  mode?: 'login' | 'signup';
  returnPath?: string;
  resumeScreen?: string;
  openAddPet?: boolean;
  guestBookingIntent?: Partial<Omit<GuestBookingIntentV1, 'v' | 'savedAt' | 'returnPath'>>;
};

type GuestAuthModalOpener = (options: GuestAuthRequestOptions) => void;

let guestAuthModalOpener: GuestAuthModalOpener | null = null;

export function registerGuestAuthModalOpener(opener: GuestAuthModalOpener | null): void {
  guestAuthModalOpener = opener;
}

function redirectGuestToAuthUrl(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}

/**
 * Single guest auth entry — opens in-app modal when guest browsing is enabled,
 * otherwise falls back to full-page /auth navigation.
 */
export function requestGuestAuth(options: GuestAuthRequestOptions = {}): void {
  emitGuestAuthAnalytics('login_prompt_shown');
  emitGuestAuthAnalytics('login_started');

  const mode = options.mode || 'signup';
  const merged = persistGuestBookingIntentForAuth({
    ...(options.guestBookingIntent || {}),
    returnPath: options.returnPath || options.guestBookingIntent?.returnPath || '/',
    resumeScreen: options.resumeScreen || options.guestBookingIntent?.resumeScreen,
    openAddPet: options.openAddPet,
  });

  const requestPayload: GuestAuthRequestOptions = {
    mode,
    returnPath: merged.returnPath || '/',
    resumeScreen: merged.resumeScreen,
    openAddPet: merged.openAddPet,
  };

  if (isGuestBrowsingEnabled() && guestAuthModalOpener) {
    guestAuthModalOpener(requestPayload);
    return;
  }

  const url =
    mode === 'login'
      ? buildAuthLoginUrl(merged.returnPath || '/')
      : buildAuthUrlWithReturn(merged.returnPath || '/');
  redirectGuestToAuthUrl(url);
}

/** Navigate to /auth with safe return; emits login_prompt_shown + login_started. */
export function redirectGuestToLogin(returnPath: string): void {
  requestGuestAuth({ mode: 'signup', returnPath: returnPath || '/' });
}
