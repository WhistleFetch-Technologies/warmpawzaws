/**
 * Razorpay Payment Utilities
 * Centralized functions for Razorpay payment processing
 */

import { buildSanitizedStandardRazorpayCheckoutOptions } from '@/lib/razorpay/build-standard-checkout-options';

/** Razorpay often hides UPI (especially on mobile / live mode) when `prefill.email` is absent. */
export const RAZORPAY_PREFILL_EMAIL_FALLBACK = 'test@example.com';

/** E.164 contact for Razorpay `prefill.contact` (better UPI flows than raw digits-only strings). */
/**
 * Razorpay Standard Checkout: custom display so UPI is not QR-only (shows collect / VPA where Razorpay still offers it).
 * Pattern from https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/sample-code/
 *
 * NOTE (Capacitor / Android WebView): a single `banks` block listing
 * `{ method: 'upi' }` alongside other methods causes Razorpay to drop UPI on
 * many Android WebView builds — UPI options disappear and only cards / wallets
 * show. Prefer {@link getWarmpawzRazorpayUpiDisplayConfig} (UPI block with
 * `flows: ['collect', 'intent', 'qr']`) plus `method: { upi: true }` for
 * payment surfaces, same as `buildSanitizedStandardRazorpayCheckoutOptions`.
 *
 * Kept for any non-payment legacy callers (e.g. wallet-add fallbacks) that
 * still need the old layout. Do not use for new code.
 */
export function getWarmpawzRazorpayStandardDisplayConfig(): {
  display: {
    blocks: Record<string, { name: string; instruments: { method: string }[] }>;
    sequence: string[];
    preferences: { show_default_blocks: boolean };
  };
} {
  return {
    display: {
      blocks: {
        banks: {
          name: 'All payment options',
          instruments: [
            { method: 'upi' },
            { method: 'card' },
            { method: 'wallet' },
            { method: 'netbanking' },
          ],
        },
      },
      sequence: ['block.banks'],
      preferences: {
        show_default_blocks: false,
      },
    },
  };
}

/**
 * UPI display block for Razorpay Standard Checkout.
 *
 * Required for Capacitor Android: `flows: ['collect', 'intent', 'qr']` keeps
 * intent (GPay / PhonePe / Paytm app launch) visible alongside collect (VPA)
 * and qr. Pair with `method: { upi: true }` on the checkout options. If the
 * Android manifest is missing UPI `<queries>` (`upi://` scheme + UPI app
 * packages), intent silently disappears even with this config.
 */
export function getWarmpawzRazorpayUpiDisplayConfig(): {
  display: {
    blocks: {
      upi: {
        name: string;
        instruments: { method: 'upi'; flows: Array<'collect' | 'intent' | 'qr'> }[];
      };
    };
    sequence: string[];
    preferences: { show_default_blocks: boolean };
  };
} {
  return {
    display: {
      blocks: {
        upi: {
          name: 'Pay using UPI',
          instruments: [{ method: 'upi', flows: ['collect', 'intent', 'qr'] }],
        },
      },
      sequence: ['block.upi'],
      preferences: { show_default_blocks: true },
    },
  };
}

export function digitsToRazorpayContactE164(digitsOnly: string): string | undefined {
  const d = String(digitsOnly || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('91')) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return undefined;
}

/** Razorpay validate/account can 500 on emojis and non-ASCII in description/name fields. */
export function razorpaySafeDescription(text: string): string {
  const t = String(text || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t || 'Payment';
}

/**
 * Standard Checkout may request bad static chunks (e.g. …/build/undefined) and fail
 * validate/account when options include undefined values, string "undefined", or
 * invalid offer ids. Strip those before `new Razorpay(opts)`.
 */
export function sanitizeRazorpayInstanceOptions<T extends Record<string, any>>(opts: T): T {
  const out = { ...opts } as Record<string, any>;

  for (const key of Object.keys(out)) {
    const v = out[key];
    if (v === undefined || v === null) {
      delete out[key];
      continue;
    }

    if (key === 'offers') {
      if (!Array.isArray(v)) {
        delete out[key];
        continue;
      }
      const ids = v
        .filter((x: unknown): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== 'undefined' && s !== 'null');
      if (ids.length === 0) delete out[key];
      else out[key] = ids;
      continue;
    }

    if (key === 'prefill' && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const p = { ...(v as Record<string, unknown>) };
      for (const pk of Object.keys(p)) {
        const pv = p[pk];
        if (pv === undefined || pv === null || pv === '') {
          delete p[pk];
        } else if (typeof pv === 'string') {
          const t = pv.trim();
          if (!t || t === 'undefined' || t === 'null') delete p[pk];
        }
      }
      if (Object.keys(p).length === 0) delete out[key];
      else out[key] = p;
      continue;
    }

    if (key === 'notes' && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const n = { ...(v as Record<string, unknown>) };
      for (const nk of Object.keys(n)) {
        if (n[nk] === undefined || n[nk] === null) delete n[nk];
      }
      if (Object.keys(n).length === 0) delete out[key];
      else out[key] = n;
      continue;
    }

    if (key === 'config' && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[key] = v;
      continue;
    }
  }

  const desc = out.description;
  if (desc === undefined || desc === null || (typeof desc === 'string' && !String(desc).trim())) {
    out.description = 'Payment';
  } else if (typeof desc === 'string' && desc.includes('undefined')) {
    out.description = 'Payment';
  } else if (typeof desc === 'string') {
    out.description = razorpaySafeDescription(desc);
  }

  if (typeof out.amount === 'number' && Number.isFinite(out.amount)) {
    out.amount = Math.max(1, Math.round(out.amount));
  }

  return out as T;
}

export interface RazorpayOrderResponse {
  orderId: string;
  keyId?: string;
  amount?: number;
  currency?: string;
}

export interface RazorpayCheckoutOptions {
  orderId: string;
  amount: number;
  currency?: string;
  description: string;
  customerPhone?: string;
  /** When set with E.164 contact, improves UPI collect / VPA entry on surfaces Razorpay still allows (often mobile). */
  customerEmail?: string;
  keyId?: string; // Razorpay key ID from API response
  onSuccess: (response: any) => Promise<void>;
  onDismiss?: () => void;
}

/**
 * Load Razorpay checkout script dynamically
 */
export const loadRazorpayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is not available'));
      return;
    }

    // If already loaded, resolve immediately
    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if ((window as any).Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
        }
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Razorpay script'));
      });
      return;
    }

    // Create and load new script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      setTimeout(() => {
        if ((window as any).Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
        }
      }, 100);
    };

    script.onerror = () => {
      reject(new Error('Failed to load Razorpay script'));
    };

    document.body.appendChild(script);
  });
};

/**
 * Open Razorpay checkout modal
 */
export const openRazorpayCheckout: any = async (options: RazorpayCheckoutOptions): Promise<void> => {
  // Load script if needed
  await loadRazorpayScript();

  if (!(window as any).Razorpay) {
    throw new Error('Razorpay is not available');
  }

  // Use keyId from API response, fallback to environment variable
  const razorpayKey = options.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY;

  if (!razorpayKey) {
    throw new Error('Razorpay key is missing. Please provide keyId or set NEXT_PUBLIC_RAZORPAY_KEY environment variable.');
  }

  const razorpayOptions = buildSanitizedStandardRazorpayCheckoutOptions({
    key: razorpayKey,
    amountPaise: Math.max(1, Math.round(Number(options.amount) * 100)),
    currency: options.currency || 'INR',
    name: 'Warmpawz',
    description: options.description?.trim() ? options.description : 'Payment',
    order_id: options.orderId,
    handler: options.onSuccess,
    customerPhone: options.customerPhone,
    customerEmail: options.customerEmail,
    modal: {
      ondismiss: options.onDismiss || (() => { }),
    },
  });

  const razorpay = new (window as any).Razorpay(razorpayOptions);
  if (typeof razorpay.on === 'function' && options.onFailure) {
    razorpay.on('payment.failed', (resp: { error?: { description?: string; reason?: string } }) => {
      options.onFailure(new Error(resp?.error?.description || resp?.error?.reason || 'Payment failed'));
    });
  }
  razorpay.open();
};
