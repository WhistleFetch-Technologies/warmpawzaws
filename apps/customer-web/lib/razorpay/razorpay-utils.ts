/**
 * Razorpay Payment Utilities
 * Centralized functions for Razorpay payment processing
 */

/** Razorpay often hides UPI (especially on mobile / live mode) when `prefill.email` is absent. */
export const RAZORPAY_PREFILL_EMAIL_FALLBACK = 'test@example.com';

/** E.164 contact for Razorpay `prefill.contact` (better UPI flows than raw digits-only strings). */
/**
 * Razorpay Standard Checkout: custom display so UPI is not QR-only (shows collect / VPA where Razorpay still offers it).
 * Pattern from https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/sample-code/
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

export function digitsToRazorpayContactE164(digitsOnly: string): string | undefined {
  const d = String(digitsOnly || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('91')) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return undefined;
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

  const digits =
    options.customerPhone && String(options.customerPhone).trim()
      ? String(options.customerPhone).replace(/\D/g, '')
      : '';
  const e164 = digitsToRazorpayContactE164(digits);
  const emailRaw = options.customerEmail?.trim();
  const email =
    emailRaw && emailRaw.includes('@') && emailRaw !== 'undefined' && emailRaw !== 'null'
      ? emailRaw
      : undefined;
  const prefill: Record<string, string> = {};
  if (e164) prefill.contact = e164;
  if (email) prefill.email = email;

  const razorpayOptions = sanitizeRazorpayInstanceOptions({
    key: razorpayKey,
    amount: Math.round(options.amount * 100), // Convert to paise
    currency: options.currency || 'INR',
    name: 'Warmpawz',
    description: options.description?.trim() ? options.description : 'Payment',
    order_id: options.orderId,
    handler: options.onSuccess,
    config: getWarmpawzRazorpayStandardDisplayConfig(),
    ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
    ...(e164 && email ? { method: 'upi' as const } : {}),
    theme: {
      color: '#FF8C42',
      // The orange "W Warmpawz" merchant toolbar that Razorpay renders above
      // its Standard Checkout sheet stacks under the device status bar on
      // phones and makes the header look unnecessarily tall. checkout.js
      // honors `hide_topbar` (web-only) and starts the sheet directly with
      // Price Summary / payment options — matching the cleaner BHIVE / "trusted
      // business" look. Native (react-native-razorpay) handles the equivalent
      // via WindowInsets in MainApplication.kt and ignores this flag.
      hide_topbar: true,
    },
    modal: {
      ondismiss: options.onDismiss || (() => { }),
    },
  });

  const razorpay = new (window as any).Razorpay(razorpayOptions);
  razorpay.open();
};
