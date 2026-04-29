/**
 * Map Warmpawz customer identity into Razorpay Standard Checkout options for react-native-razorpay.
 *
 * - Prefill E.164 `contact`, `email` (with placeholder if missing), and `name` when available —
 *   Razorpay may hide UPI collect when `prefill.email` is absent.
 * - `config.display.blocks.upi` with `flows: ['collect','intent','qr']` + `method: { upi: true }` so UPI ID
 *   (collect) is preferred where supported, with intent and QR as fallbacks.
 * - `theme.hide_topbar: true` removes the orange Razorpay merchant toolbar (the tall "W Warmpawz"
 *   header) at the top of `com.razorpay.CheckoutActivity`. On phones the merchant toolbar +
 *   system status bar were stacking into one tall band that pushed the WebView back button into
 *   the status-bar tap zone. Hiding it lets Razorpay's UI start right below the status bar; the
 *   Android system back button still dismisses checkout.
 */

const RAZORPAY_PREFILL_EMAIL_FALLBACK = 'test@example.com';

export function digitsToRazorpayContactE164(digitsOrPhone: string): string | undefined {
  const d = String(digitsOrPhone || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('91')) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return undefined;
}

export function normalizeCustomerEmail(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t.includes('@') || t === 'undefined' || t === 'null') return undefined;
  return t;
}

/** Extract email / display name from CustomerApi.getCustomerByPhone / getProfile payloads. */
export function profileEmailAndName(profile: any): { email?: string; name?: string } {
  if (!profile || typeof profile !== 'object') return {};
  const email =
    normalizeCustomerEmail(profile.email) ||
    normalizeCustomerEmail(profile.user?.email) ||
    normalizeCustomerEmail(profile.profile?.email);
  const nameRaw =
    (typeof profile.name === 'string' && profile.name) ||
    (typeof profile.fullName === 'string' && profile.fullName) ||
    (typeof profile.displayName === 'string' && profile.displayName) ||
    (typeof profile.user?.name === 'string' && profile.user.name);
  const name = nameRaw && String(nameRaw).trim() ? String(nameRaw).trim() : undefined;
  return { email, name };
}

/**
 * Merges customer prefill + UPI-friendly `config.display` into options passed to `RazorpayCheckout.open`.
 * Mutates a shallow copy; safe to call right before open().
 */
export function applyWarmpawzCustomerToRazorpayOptions(
  options: Record<string, any>,
  ctx: { phone: string; email?: string | null; name?: string | null }
): Record<string, any> {
  const e164 = digitsToRazorpayContactE164(ctx.phone);
  const emailFromProfile = normalizeCustomerEmail(ctx.email ?? undefined);
  const emailForPrefill =
    emailFromProfile || (e164 ? RAZORPAY_PREFILL_EMAIL_FALLBACK : undefined);
  const name =
    typeof ctx.name === 'string' && ctx.name.trim() ? ctx.name.trim() : undefined;

  const prefill: Record<string, string> = {
    ...(typeof options.prefill === 'object' && options.prefill !== null ? options.prefill : {}),
  };
  if (e164) prefill.contact = e164;
  if (emailForPrefill) prefill.email = emailForPrefill;
  if (name) prefill.name = name;

  const display = {
    preferences: { show_default_blocks: true },
    blocks: {
      upi: {
        name: 'Pay using UPI',
        instruments: [{ method: 'upi', flows: ['collect', 'intent', 'qr'] }],
      },
    },
    sequence: ['block.upi'],
  };

  const existingConfig =
    typeof options.config === 'object' && options.config !== null ? options.config : {};

  const existingTheme =
    typeof options.theme === 'object' && options.theme !== null ? options.theme : {};

  const out: Record<string, any> = {
    ...options,
    prefill,
    config: {
      ...existingConfig,
      display,
    },
    method: { upi: true },
    theme: {
      ...existingTheme,
      hide_topbar: true,
    },
  };

  console.log('Razorpay options:', out);

  return out;
}
