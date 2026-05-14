/**
 * Map Warmpawz customer identity into Razorpay Standard Checkout options for react-native-razorpay.
 *
 * - Prefill E.164 `contact`, `email` (with placeholder if missing), and `name` when available —
 *   Razorpay needs `prefill.email` for UPI Collect (UPI ID) to surface on the Standard Checkout.
 * - Force UPI on by declaring `method: { upi: true }` and a `config.display.blocks.upi`
 *   instrument block with `flows: ['collect','intent','qr']`. This is the same shape the
 *   customer-web checkout uses in
 *   `apps/customer-web/lib/razorpay/build-standard-checkout-options.ts` and the reason iOS
 *   already shows the UPI section — without it, Android Standard Checkout silently drops UPI
 *   from `All payment options` even though the merchant has UPI enabled. We pair the block with
 *   `preferences.show_default_blocks: true` so Razorpay still renders Cards / Wallet / Netbanking
 *   below UPI (matching the BHIVE / Razorpay Trusted Business reference). The `<queries>`
 *   declaration in `android/app/src/main/AndroidManifest.xml` lets the SDK enumerate installed
 *   UPI PSP apps for the "Recommended" Google Pay / PhonePe shortcuts.
 * - System chrome around `com.razorpay.CheckoutActivity` (status bar / merchant toolbar
 *   alignment) is handled in `MainApplication.RazorpayCheckoutWindowInsetsCallback` so the
 *   `← Warmpawz` header lays out cleanly below the system status bar. We do NOT set
 *   `theme.hide_topbar` here: that option is only honored by `checkout.js` on the web SDK and
 *   has no effect on react-native-razorpay's native Android checkout.
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
 * Merges customer prefill (E.164 contact, email, name) and a UPI-friendly `config.display` /
 * `method.upi` into the options passed to `RazorpayCheckout.open`. This mirrors the
 * customer-web checkout payload (`buildSanitizedStandardRazorpayCheckoutOptions`) so the native
 * RN screens get the same `All payment options: UPI / Cards / Wallet / Netbanking` layout iOS
 * already shows. Returns a shallow copy; safe to call right before `open()`.
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

  const existingTheme =
    typeof options.theme === 'object' && options.theme !== null ? options.theme : {};

  const existingConfig =
    typeof options.config === 'object' && options.config !== null ? options.config : {};
  const existingDisplay =
    typeof (existingConfig as any).display === 'object' && (existingConfig as any).display !== null
      ? (existingConfig as any).display
      : {};

  // `show_default_blocks: true` keeps Cards / Wallet / Netbanking visible below the explicit
  // UPI block. `flows: ['collect','intent','qr']` matches the customer-web payload — Razorpay
  // surfaces UPI ID (collect), installed PSP intents, and QR on whichever device supports them.
  const display: Record<string, unknown> = {
    ...existingDisplay,
    preferences: { show_default_blocks: true },
    blocks: {
      ...(typeof (existingDisplay as any).blocks === 'object' &&
      (existingDisplay as any).blocks !== null
        ? (existingDisplay as any).blocks
        : {}),
      upi: {
        name: 'Pay using UPI',
        instruments: [{ method: 'upi', flows: ['collect', 'intent', 'qr'] }],
      },
    },
    sequence: ['block.upi'],
  };

  const existingMethod =
    typeof options.method === 'object' && options.method !== null ? options.method : {};

  const out: Record<string, any> = {
    ...options,
    prefill,
    theme: { ...existingTheme },
    config: { ...existingConfig, display },
    method: { ...existingMethod, upi: true },
  };

  console.log('Razorpay options:', out);

  return out;
}
