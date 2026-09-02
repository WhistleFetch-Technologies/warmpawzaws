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
import { getStoredCustomerJwtForSession, isTokenExpired } from './session-utils';
import { enqueueAllyticasEvent } from './allyticas-ingest';
import { buildWpayVendorPayPath } from './warmpawz-pay/wpay-guest-journey';

/**
 * Canonical customer auth: phone + (unexpired JWT or Cognito refresh window).
 * Phone-only or expired JWT without refresh is Guest.
 */
export function hasAuthenticatedCustomerSession(): boolean {
  if (typeof window === 'undefined') return false;
  const phone = (localStorage.getItem('customerPhone') || '').replace(/\D/g, '');
  if (phone.length < 10) return false;
  const token = getStoredCustomerJwtForSession();
  if (token && !isTokenExpired(token)) return true;
  const refreshExpiry = localStorage.getItem('customerRefreshTokenExpiry');
  const hasBundle = !!localStorage.getItem('customerCognitoTokens');
  return hasBundle && !!refreshExpiry && Date.now() < parseInt(refreshExpiry, 10);
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

/** Live service Book/Continue — restore to an existing shell screen, not a fabricated slot. */
export function requestGuestAuthForServiceResume(opts: {
  resumeScreen: string;
  persona?: string;
  category?: string;
  vendorId?: string;
}): boolean {
  return requestGuestAuthForBooking({
    kind: 'booking',
    persona: opts.persona,
    category: opts.category || opts.persona,
    vendorId: opts.vendorId,
    requiresPet: false,
    returnPath: '/',
    resumeScreen: opts.resumeScreen,
  });
}

/** Events Book — restore to /events/{id}/book after login, signup, profile, or pet creation. */
export function requestGuestAuthForEventBook(opts: {
  eventId: string;
  returnPath?: string;
}): boolean {
  const eventId = String(opts.eventId || '').trim();
  const returnPath = opts.returnPath || (eventId ? `/events/${eventId}/book` : '/events');
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath,
    resumeScreen: undefined,
    guestBookingIntent: {
      kind: 'event',
      requiresPet: true,
      funnelStarted: 'booking',
    },
  });
}

/** Instant Tele — not a slot appointment; must not overwrite higher-priority journeys. */
export function requestGuestAuthForInstantTele(returnPath?: string): boolean {
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath: returnPath || '/?service=tele',
    resumeScreen: undefined,
    guestBookingIntent: {
      kind: 'instant_tele',
      appointmentType: 'instant_tele',
      requiresPet: false,
    },
  });
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
  const { returnPath, resumeScreen, openAddPet, ...rest } = intent;
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath: returnPath || '/',
    resumeScreen,
    openAddPet,
    guestBookingIntent: {
      ...rest,
      kind: rest.kind || 'booking',
      resumeScreen,
      openAddPet,
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
  serviceId?: string;
  serviceStyle?: string;
  resumeScreen: string;
  wapptMode?: boolean;
}): boolean {
  const wapptMode = opts.wapptMode === true;
  return requestGuestAuthForBooking({
    kind: 'booking',
    persona: opts.persona,
    category: opts.category,
    vendorId: opts.vendorId,
    serviceId: opts.serviceId,
    serviceStyle: opts.serviceStyle,
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

/** Warmpawz Pay vendor card — list browse is guest-ok. Prefer requestGuestAuthForWpayPay at Proceed. */
export function requestGuestAuthForWpayVendor(vendorId: string): boolean {
  const id = String(vendorId || '').trim();
  const returnPath = buildWpayVendorPayPath(id);
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath,
    resumeScreen: 'warmpawz-pay-vendor',
    guestBookingIntent: {
      kind: 'pay_bill',
      vendorId: id || undefined,
      requiresPet: false,
      resumeScreen: 'warmpawz-pay-vendor',
    },
  });
}

/** Pay Bill Proceed to Pay — persist amount; auth only at this boundary. */
export function requestGuestAuthForWpayPay(opts: { vendorId: string; amount: number }): boolean {
  const id = String(opts.vendorId || '').trim();
  const amount = Number(opts.amount);
  const returnPath = buildWpayVendorPayPath(id);
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath,
    resumeScreen: 'warmpawz-pay-vendor',
    guestBookingIntent: {
      kind: 'pay_bill',
      vendorId: id || undefined,
      price: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      requiresPet: false,
      resumeScreen: 'warmpawz-pay-vendor',
    },
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
  const next = resolveEcommerceReturnPath(returnPath) || '/checkout';
  return requestGuestAuthIfNeeded({
    mode: 'signup',
    returnPath: next,
    resumeScreen: 'shop',
    guestBookingIntent: {
      kind: 'cart',
      requiresPet: false,
      funnelStarted: 'checkout',
    },
  });
}

/**
 * @deprecated Use requestGuestAuthForEcommerceAdd for add-to-cart;
 * requestGuestAuth or requestGuestAuthForCheckout for checkout.
 */
export function requestGuestAuthForCart(returnPath?: string): boolean {
  return requestGuestAuthForCheckout(returnPath);
}
