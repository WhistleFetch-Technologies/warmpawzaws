/**
 * Map Warmpawz customer identity into Razorpay Standard Checkout options
 * for react-native-razorpay.
 *
 * Canonical presentation matches the Aug 5–Aug 25 Pay Bill checkout:
 * key, amount, currency, name, description, order_id, handler, optional
 * prefill, theme. Does not add UPI instrument blocks, `method: { upi: true }`,
 * or an invented fallback email.
 *
 * `theme.hide_topbar` is only honored by checkout.js on web and is omitted here.
 */

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
 * Merges E.164 contact and a real profile email/name into Razorpay options.
 * Strips UPI-first `config.display` / `method` so native matches the canonical
 * web Standard Checkout. Returns a shallow copy; safe to call right before `open()`.
 */
export function applyWarmpawzCustomerToRazorpayOptions(
  options: Record<string, any>,
  ctx: { phone: string; email?: string | null; name?: string | null }
): Record<string, any> {
  const e164 = digitsToRazorpayContactE164(ctx.phone);
  const email = normalizeCustomerEmail(ctx.email ?? undefined);
  const name =
    typeof ctx.name === 'string' && ctx.name.trim() ? ctx.name.trim() : undefined;

  const incomingPrefill =
    typeof options.prefill === 'object' && options.prefill !== null
      ? { ...(options.prefill as Record<string, string>) }
      : {};
  delete incomingPrefill.email;

  const prefill: Record<string, string> = { ...incomingPrefill };
  if (e164) prefill.contact = e164;
  if (email) prefill.email = email;
  if (name) prefill.name = name;

  const existingTheme =
    typeof options.theme === 'object' && options.theme !== null ? options.theme : {};

  const { config: _config, method: _method, ...rest } = options;

  const out: Record<string, any> = {
    ...rest,
    theme: { ...existingTheme },
    ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
  };

  return out;
}
