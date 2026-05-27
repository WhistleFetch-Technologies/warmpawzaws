/**
 * Platform support line for customer "Call us" actions.
 * Set NEXT_PUBLIC_SUPPORT_PHONE in env (digits with optional + / spaces), e.g. +91 800 123 4567
 * Optional NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY for UI label only.
 */
const DEFAULT_SUPPORT_DIGITS = '918001234567';

export function getSupportPhoneDigits(): string {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  if (raw && raw.replace(/\D/g, '').length >= 8) {
    return raw.replace(/\D/g, '');
  }
  return DEFAULT_SUPPORT_DIGITS;
}

export function getSupportTelHref(): string {
  return `tel:${getSupportPhoneDigits()}`;
}

export function getSupportPhoneLabel(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY?.trim() || '+91 8001234567';
}

/** sessionStorage key: set before navigating to Help & Support */
export const SUPPORT_INITIAL_TAB_KEY = 'warmpawz_support_initial_tab';

/** sessionStorage key: booking context when opening Help from a booking */
export const SUPPORT_BOOKING_CONTEXT_KEY = 'warmpawz_support_booking_context';

export type SupportBookingContext = {
  bookingId: string;
  serviceName?: string;
  bookingDate?: string;
  amount?: number;
  status?: string;
  vendorName?: string;
};

export function storeSupportBookingContext(ctx: SupportBookingContext): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SUPPORT_BOOKING_CONTEXT_KEY, JSON.stringify(ctx));
    sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'contact');
  } catch {
    /* ignore */
  }
}

export function readSupportBookingContext(): SupportBookingContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SUPPORT_BOOKING_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupportBookingContext;
    if (!parsed?.bookingId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSupportBookingContext(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SUPPORT_BOOKING_CONTEXT_KEY);
  } catch {
    /* ignore */
  }
}

export function navigateToBookingSupport(
  router: { push: (path: string) => void },
  ctx: SupportBookingContext
): void {
  storeSupportBookingContext(ctx);
  router.push(`/help?bookingId=${encodeURIComponent(ctx.bookingId)}`);
}
