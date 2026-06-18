/**
 * Platform support line for customer "Call us" actions.
 * Set NEXT_PUBLIC_SUPPORT_PHONE in env (digits with optional + / spaces), e.g. +91 800 123 4567
 * Optional NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY for UI label only.
 */
import { resolveMealPlanTitle } from '@/lib/meal-order-tracking-details';

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

/** When set, SupportHelpCenter opens the contact ticket form on mount (Report an Issue). */
export const SUPPORT_OPEN_CONTACT_FORM_KEY = 'warmpawz_support_open_contact_form';

export function rememberSupportOpenContactForm(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SUPPORT_OPEN_CONTACT_FORM_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeSupportOpenContactForm(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = sessionStorage.getItem(SUPPORT_OPEN_CONTACT_FORM_KEY);
    sessionStorage.removeItem(SUPPORT_OPEN_CONTACT_FORM_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

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
    clearSupportMealOrderContext();
    sessionStorage.setItem(SUPPORT_BOOKING_CONTEXT_KEY, JSON.stringify(ctx));
    sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'tickets');
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

/** sessionStorage key: meal order context when opening Help from track order */
export const SUPPORT_MEAL_ORDER_CONTEXT_KEY = 'warmpawz_support_meal_order_context';

export type SupportMealOrderContext = {
  orderId: string;
  orderDisplayNumber?: string;
  planTitle?: string;
  orderStatus?: string;
  amount?: number;
  vendorName?: string;
  orderDate?: string;
};

export function storeSupportMealOrderContext(ctx: SupportMealOrderContext): void {
  if (typeof window === 'undefined') return;
  try {
    clearSupportBookingContext();
    sessionStorage.setItem(SUPPORT_MEAL_ORDER_CONTEXT_KEY, JSON.stringify(ctx));
    sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'contact');
  } catch {
    /* ignore */
  }
}

export function readSupportMealOrderContext(): SupportMealOrderContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SUPPORT_MEAL_ORDER_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupportMealOrderContext;
    if (!parsed?.orderId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSupportMealOrderContext(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SUPPORT_MEAL_ORDER_CONTEXT_KEY);
  } catch {
    /* ignore */
  }
}

export function buildSupportMealOrderContext(order: Record<string, unknown>): SupportMealOrderContext {
  const orderId = String(order.id || order.order_id || '').trim();
  const orderNumber = String(order.order_number || order.orderNumber || '').trim();
  const display = orderNumber
    ? orderNumber.startsWith('#')
      ? orderNumber
      : `#${orderNumber}`
    : orderId
      ? `#${orderId.replace(/-/g, '').slice(-10)}`
      : undefined;

  let planTitle: string | undefined;
  try {
    const title = resolveMealPlanTitle(order);
    planTitle = title?.trim() || undefined;
  } catch {
    planTitle =
      (typeof order.plan_title === 'string' && order.plan_title.trim()) ||
      (typeof order.planTitle === 'string' && order.planTitle.trim()) ||
      undefined;
  }

  const vendorName =
    (typeof order.vendor_name === 'string' && order.vendor_name.trim()) ||
    (typeof order.vendorName === 'string' && order.vendorName.trim()) ||
    undefined;

  const amountRaw = order.total_amount ?? order.total ?? order.totalAmount ?? order.amount;
  const amount =
    typeof amountRaw === 'number'
      ? amountRaw
      : typeof amountRaw === 'string'
        ? parseFloat(amountRaw.replace(/,/g, ''))
        : undefined;

  const createdAt = order.created_at ?? order.createdAt;
  const orderDate =
    createdAt != null && String(createdAt).trim() ? String(createdAt) : undefined;

  return {
    orderId,
    orderDisplayNumber: display,
    planTitle,
    orderStatus: order.status != null ? String(order.status) : undefined,
    amount: Number.isFinite(amount) ? amount : undefined,
    vendorName,
    orderDate,
  };
}

export function navigateToMealOrderSupport(
  router: { push: (path: string) => void },
  ctx: SupportMealOrderContext
): void {
  storeSupportMealOrderContext(ctx);
  router.push(`/help?orderId=${encodeURIComponent(ctx.orderId)}&orderType=meal`);
}

/** One linked ticket at a time — meal order wins if both were left in storage. */
export function resolveSupportContactContext(
  bookingContext?: SupportBookingContext | null,
  mealOrderContext?: SupportMealOrderContext | null,
): {
  kind: 'booking' | 'meal' | null;
  booking: SupportBookingContext | null;
  meal: SupportMealOrderContext | null;
} {
  if (mealOrderContext?.orderId) {
    return { kind: 'meal', booking: null, meal: mealOrderContext };
  }
  if (bookingContext?.bookingId) {
    return { kind: 'booking', booking: bookingContext, meal: null };
  }
  return { kind: null, booking: null, meal: null };
}

export function navigateToBookingSupport(
  router: { push: (path: string) => void },
  ctx: SupportBookingContext
): void {
  storeSupportBookingContext(ctx);
  router.push(`/help?bookingId=${encodeURIComponent(ctx.bookingId)}`);
}
