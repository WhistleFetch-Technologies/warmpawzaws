/**
 * Shared Razorpay Standard Checkout (`checkout.js`) options.
 *
 * Razorpay / NPCI are deprecating UPI Collect (manual VPA) on many surfaces; **only**
 * `flows: ['collect']` can yield no eligible instruments on web (Razorpay error:
 * "No appropriate payment method found"). Include **qr** (and **intent** where supported)
 * alongside collect so UPI stays available; VPA / collect remains best-effort per Razorpay.
 * @see https://razorpay.com/docs/announcements/upi-collect-migration/standard-integration/
 */

import { apiClient } from '@/lib/api-client';
import {
  digitsToRazorpayContactE164,
  isInvalidRazorpayString,
  RAZORPAY_PREFILL_EMAIL_FALLBACK,
  sanitizeRazorpayInstanceOptions,
} from '@/lib/razorpay/razorpay-utils';

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
  /** Dashboard Checkout Configuration ID (can re-enable collect / alter UPI vs QR). */
  checkout_config_id?: string;
  handler: (response: any) => void | Promise<void>;
  /** Raw or digits-only phone; digits are extracted for E.164 prefill. */
  customerPhone?: string | null;
  customerEmail?: string | null;
  prefillName?: string | null;
  theme?: { color?: string; backdrop_color?: string };
  modal?: Record<string, unknown>;
  offers?: string[];
  notes?: Record<string, unknown>;
  retry?: { enabled: boolean; max_count: number };
  /**
   * When true (default), UPI `display.blocks` (qr / intent / collect) + `method: { upi: true }`.
   * When false, default Razorpay checkout layout (cards / netbanking / full method list).
   */
  includeInstrumentBlocks?: boolean;
}

/**
 * Builds checkout options and runs {@link sanitizeRazorpayInstanceOptions}.
 * Prefers E.164 `prefill.contact` and optional `prefill.email` when valid.
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
    theme,
    modal,
    offers,
    notes,
    retry,
    includeInstrumentBlocks = true,
  } = input;

  const checkoutConfigId = (() => {
    const fromInput =
      typeof input.checkout_config_id === 'string' ? input.checkout_config_id : '';
    const fromEnv =
      typeof process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_CONFIG_ID === 'string'
        ? process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_CONFIG_ID
        : '';
    const candidate = fromInput.trim() || fromEnv.trim();
    return isInvalidRazorpayString(candidate) ? undefined : candidate;
  })();

  const phoneDigits = customerPhone ? String(customerPhone).replace(/\D/g, '') : '';
  const e164 = digitsToRazorpayContactE164(phoneDigits);

  const emailTrim =
    typeof customerEmail === 'string' && customerEmail.includes('@') ? customerEmail.trim() : '';
  const email =
    emailTrim && emailTrim !== 'undefined' && emailTrim !== 'null' ? emailTrim : undefined;

  const emailForPrefill =
    includeInstrumentBlocks && e164 && !email ? RAZORPAY_PREFILL_EMAIL_FALLBACK : email;

  const prefill: Record<string, string> = {};
  if (e164) prefill.contact = e164;
  if (emailForPrefill) prefill.email = emailForPrefill;
  const nameTrim =
    typeof prefillName === 'string' && prefillName.trim() ? prefillName.trim() : '';
  if (nameTrim) prefill.name = nameTrim;

  const display: Record<string, unknown> = {
    preferences: {
      show_default_blocks: true,
    },
  };

  if (includeInstrumentBlocks) {
    display.blocks = {
      upi: {
        name: 'Pay using UPI',
        instruments: [{ method: 'upi', flows: ['collect', 'intent', 'qr'] }],
      },
    };
    display.sequence = ['block.upi'];
  } else {
    display.preferences = { show_default_blocks: true };
  }

  const offerIds =
    Array.isArray(offers) && offers.length > 0
      ? offers
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s !== 'undefined' && s !== 'null')
      : [];

  const checkoutPayload: Record<string, any> = {
    key,
    amount: Math.max(1, Math.round(Number(amountPaise))),
    currency,
    name,
    description: String(description || 'Payment').trim() || 'Payment',
    handler,
    ...(order_id ? { order_id } : {}),
    ...(checkoutConfigId ? { checkout_config_id: checkoutConfigId } : {}),
    ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
    config: { display },
  };

  if (includeInstrumentBlocks) {
    checkoutPayload.method = { upi: true };
  }

  const raw: Record<string, any> = {
    ...checkoutPayload,
    ...(theme ? { theme } : {}),
    ...(modal ? { modal } : {}),
    ...(offerIds.length > 0 ? { offers: offerIds } : {}),
    ...(notes && Object.keys(notes).length > 0 ? { notes } : {}),
    ...(retry ? { retry } : {}),
  };

  return sanitizeRazorpayInstanceOptions(raw);
}
