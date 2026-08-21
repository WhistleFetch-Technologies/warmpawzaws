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
    returnPath: options.returnPath || '/',
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

/** @returns true if the guest modal was opened (caller should abort). */
export function requestGuestAuthIfNeeded(options: GuestAuthRequestOptions = {}): boolean {
  if (hasAuthenticatedCustomerSession()) return false;
  requestGuestAuth(options);
  return true;
}

/** Booking continue / Book appointment — modal, not full-page /auth. */
export function requestGuestAuthForBooking(
  intent: Partial<Omit<GuestBookingIntentV1, 'v' | 'savedAt'>> & {
    vendorId?: string;
    serviceId?: string;
    serviceStyle?: string;
    wapptMode?: boolean;
  }
): boolean {
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath: intent.returnPath || '/',
    resumeScreen: intent.resumeScreen,
    guestBookingIntent: {
      kind: intent.kind || 'booking',
      persona: intent.persona,
      category: intent.category,
      vendorId: intent.vendorId || intent.vendorId,
      serviceId: intent.serviceId || intent.serviceId,
      serviceStyle: intent.serviceStyle || intent.serviceStyle,
      date: intent.date,
      time: intent.time,
      wapptMode: intent.wapptMode ?? intent.wapptMode,
      requiresPet: intent.requiresPet,
      resumeScreen: intent.resumeScreen,
    },
  });
}

/** Marketplace Book service / Continue from vendor profile (not slot browse). */
export function requestGuestAuthForMarketplaceBook(opts: {
  persona: string;
  category: string;
  vendorId?: string;
  resumeScreen: string;
}): boolean {
  return requestGuestAuthForProfileContinue({ ...opts, wapptMode: false });
}

/**
 * Vendor profile CTA that leaves the profile for slot booking.
 * Same injection for marketplace Continue and WAPPT Select Slot.
 */
export function requestGuestAuthForProfileContinue(opts: {
  persona: string;
  category: string;
  vendorId?: string;
  resumeScreen: string;
  wapptMode?: boolean;
}): boolean {
  const wapptMode = opts.wapptMode === true;
  return requestGuestAuthForBooking({
    kind: 'booking',
    persona: opts.persona,
    category: opts.category,
    vendorId: opts.vendorId,
    requiresPet: !wapptMode,
    wapptMode,
    returnPath: '/',
    resumeScreen: opts.resumeScreen,
  });
}

/** @deprecated Prefer requestGuestAuthForProfileContinue({ wapptMode: true }) on the slot CTA. */
export function requestGuestAuthForWapptBook(opts: {
  persona: string;
  category: string;
  vendorId?: string;
  resumeScreen?: string;
}): boolean {
  return requestGuestAuthForBooking({
    kind: 'booking',
    persona: opts.persona,
    category: opts.category,
    vendorId: opts.vendorId,
    requiresPet: false,
    wapptMode: true,
    returnPath: '/',
    resumeScreen: opts.resumeScreen || 'wappt-vendor-profile',
  });
}

/** Warmpawz Pay vendor card — list browse is guest-ok; opening a vendor requires login. */
export function requestGuestAuthForWpayVendor(vendorId: string): boolean {
  const id = String(vendorId || '').trim();
  const returnPath = id
    ? `/warmpawz-pay/vendors/${encodeURIComponent(id)}`
    : '/warmpawz-pay';
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath,
    resumeScreen: 'warmpawz-pay-vendor',
  });
}

function resolveEcommerceReturnPath(returnPath?: string): string {
  return (
    returnPath ||
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search || ''}` || '/shop'
      : '/shop')
  );
}

/**
 * @returns true if caller should abort add-to-cart (auth prompt shown).
 * Guest browsing ON → allow local cart (return false).
 * Guest browsing OFF → legacy: prompt login before add (return true for guests).
 */
export function requestGuestAuthForEcommerceAdd(returnPath?: string): boolean {
  if (hasAuthenticatedCustomerSession()) return false;
  if (isGuestBrowsingEnabled()) return false;
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath: resolveEcommerceReturnPath(returnPath),
    resumeScreen: 'shop',
  });
}

/** Checkout / payment boundary — not add-to-cart. */
export function requestGuestAuthForCheckout(returnPath?: string): boolean {
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath: resolveEcommerceReturnPath(returnPath),
    resumeScreen: 'shop',
  });
}

/**
 * @deprecated Use requestGuestAuthForEcommerceAdd for add-to-cart;
 * requestGuestAuth or requestGuestAuthForCheckout for checkout.
 */
export function requestGuestAuthForCart(returnPath?: string): boolean {
  return requestGuestAuthForCheckout(returnPath);
}
