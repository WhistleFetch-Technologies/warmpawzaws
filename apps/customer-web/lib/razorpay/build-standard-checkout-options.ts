/**
 * Canonical Warmpawz Razorpay Standard Checkout options.
 *
 * Matches the Aug 5–Aug 25 Pay Bill minimal checkout:
 * key, amount, currency, name, description, order_id, handler,
 * optional prefill, theme, modal.
 *
 * Does not add UPI instrument blocks, `method: { upi: true }`,
 * or a fallback / invented email.
 */

import { apiClient } from '@/lib/api-client';
import {
  digitsToRazorpayContactE164,
  sanitizeRazorpayInstanceOptions,
} from '@/lib/razorpay/razorpay-utils';

/**
 * Default Razorpay checkout theme. `hide_topbar` removes the cross-origin merchant
 * toolbar that overlaps the iOS status bar in Capacitor WKWebView.
 */
export const WARMPAWZ_RAZORPAY_CHECKOUT_THEME = {
  color: '#FF8C42',
  hide_topbar: true,
} as const;

/** Best-effort profile email for Razorpay `prefill.email` (non-fatal if profile missing). */
export async function fetchCheckoutEmailForPrefill(customerPhone: string): Promise<string | undefined> {
  try {
    const profileResponse = (await apiClient.get(
      `/customer/profile?phone=${encodeURIComponent(customerPhone)}`
    )) as any;
    const profile = profileResponse?.profile ?? profileResponse;
    const em = profile?.email;
    if (typeof em === 'string' && em.includes('@')) {
      const t = em.trim();
      return t || undefined;
    }
  } catch {
    /* non-fatal */
  }
  return undefined;
}

export interface BuildStandardRazorpayCheckoutOptionsInput {
  key: string;
  amountPaise: number;
  currency?: string;
  name?: string;
  description: string;
  order_id?: string;
  handler: (response: any) => void | Promise<void>;
  /** Raw or digits-only phone; digits are extracted for E.164 prefill. */
  customerPhone?: string | null;
  customerEmail?: string | null;
  prefillName?: string | null;
  /**
   * Business-specific extra prefill (e.g. user-entered VPA).
   * Does not add UPI instrument blocks or invent email.
   */
  extraPrefill?: Record<string, string>;
  theme?: { color?: string; backdrop_color?: string; hide_topbar?: boolean };
  modal?: Record<string, unknown>;
  offers?: string[];
  notes?: Record<string, unknown>;
  retry?: { enabled: boolean; max_count: number };
}

/**
 * Builds minimal Standard Checkout options and runs {@link sanitizeRazorpayInstanceOptions}.
 * Prefills E.164 `contact` and a real `email` only when those values exist.
 */
export function buildSanitizedStandardRazorpayCheckoutOptions(
  input: BuildStandardRazorpayCheckoutOptionsInput
): Record<string, any> {
  const {
    key,
    amountPaise,
    currency = 'INR',
    name = 'Warmpawz',
    description,
    order_id,
    handler,
    customerPhone,
    customerEmail,
    prefillName,
    extraPrefill,
    theme,
    modal,
    offers,
    notes,
    retry,
  } = input;

  const phoneDigits = customerPhone ? String(customerPhone).replace(/\D/g, '') : '';
  const e164 = digitsToRazorpayContactE164(phoneDigits);

  const emailTrim =
    typeof customerEmail === 'string' && customerEmail.includes('@') ? customerEmail.trim() : '';
  const email =
    emailTrim && emailTrim !== 'undefined' && emailTrim !== 'null' ? emailTrim : undefined;

  const prefill: Record<string, string> = {};
  if (e164) prefill.contact = e164;
  if (email) prefill.email = email;
  const nameTrim =
    typeof prefillName === 'string' && prefillName.trim() ? prefillName.trim() : '';
  if (nameTrim) prefill.name = nameTrim;
  if (extraPrefill) {
    for (const [pk, pv] of Object.entries(extraPrefill)) {
      const value = typeof pv === 'string' ? pv.trim() : '';
      if (value && value !== 'undefined' && value !== 'null') {
        prefill[pk] = value;
      }
    }
  }

  const offerIds =
    Array.isArray(offers) && offers.length > 0
      ? offers
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s !== 'undefined' && s !== 'null')
      : [];

  const raw: Record<string, any> = {
    key,
    amount: Math.max(1, Math.round(Number(amountPaise))),
    currency,
    name,
    description: String(description || 'Payment').trim() || 'Payment',
    handler,
    ...(order_id ? { order_id } : {}),
    ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
    theme: {
      ...WARMPAWZ_RAZORPAY_CHECKOUT_THEME,
      ...theme,
      hide_topbar: true,
    },
    ...(modal ? { modal } : {}),
    ...(offerIds.length > 0 ? { offers: offerIds } : {}),
    ...(notes && Object.keys(notes).length > 0 ? { notes } : {}),
    ...(retry ? { retry } : {}),
  };

  return sanitizeRazorpayInstanceOptions(raw);
}
