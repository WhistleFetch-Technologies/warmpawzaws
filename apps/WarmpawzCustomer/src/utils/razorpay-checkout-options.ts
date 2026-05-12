/**
 * Map Warmpawz customer identity into Razorpay Standard Checkout options for react-native-razorpay.
 *
 * - Prefill E.164 `contact`, `email` (with placeholder if missing), and `name` when available —
 *   Razorpay needs `prefill.email` for UPI Collect (UPI ID) to surface on the Standard Checkout.
 * - We let Razorpay render its **default Standard Checkout layout** (Recommended UPI apps + the
 *   "All Payment Options" section) instead of forcing a single custom `display.blocks.upi` block.
 *   That custom block was collapsing to nothing on Android (no UPI section visible at all) when
 *   the intent flow could not enumerate installed PSP apps — see the `<queries>` declaration in
 *   `android/app/src/main/AndroidManifest.xml` for the package-visibility fix that pairs with
 *   this. Removing the override matches the reference (BHIVE / Razorpay Trusted Business)
 *   layout and keeps iOS — which already worked — visually identical.
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
 * Merges customer prefill (E.164 contact, email, name) into the options passed to
 * `RazorpayCheckout.open`. UPI surface configuration is intentionally NOT overridden — Razorpay's
 * default Standard Checkout layout is used so UPI Apps + UPI ID + QR all appear (matching iOS and
 * the Razorpay reference design). Returns a shallow copy; safe to call right before `open()`.
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

  const out: Record<string, any> = {
    ...options,
    prefill,
    theme: { ...existingTheme },
  };

  console.log('Razorpay options:', out);

  return out;
}
