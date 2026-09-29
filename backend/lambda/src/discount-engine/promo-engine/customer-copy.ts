/**
 * Admin-configurable customer copy for a promotion (stored in promo_engine_promotions.metadata.customerCopy).
 * Amounts, expiry and redeem scope stay dynamic — admins only control the wording around them.
 */

export const PROMO_CUSTOMER_COPY_KEYS = [
  'earnLine',
  'discountLine',
  'redeemLine',
  'termsLine',
  'savingsLine',
  'creditedTitle',
  'creditedBody',
] as const;

export type PromoCustomerCopyKey = (typeof PROMO_CUSTOMER_COPY_KEYS)[number];

export type PromoCustomerCopy = Partial<Record<PromoCustomerCopyKey, string>>;

export const PROMO_CUSTOMER_COPY_PLACEHOLDERS = [
  'amount',
  'discount',
  'expiryDays',
  'expiryDate',
  'redeemLabel',
] as const;

export const PROMO_CUSTOMER_COPY_MAX_LENGTH = 200;

export const DEFAULT_CREDITED_TITLE = '₹{amount} cashback credited!';
export const DEFAULT_CREDITED_BODY = 'Added to your Warmpawz Wallet. Use it before {expiryDate}.';
export const DEFAULT_CREDITED_BODY_NO_EXPIRY = 'Added to your Warmpawz Wallet. Use it on your next payment.';

const PLACEHOLDER_RE = /\{(\w+)\}/g;

export function parseCustomerCopy(metadata: unknown): PromoCustomerCopy | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).customerCopy;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: PromoCustomerCopy = {};
  for (const key of PROMO_CUSTOMER_COPY_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v !== 'string') continue;
    const trimmed = v.trim().slice(0, PROMO_CUSTOMER_COPY_MAX_LENGTH);
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length ? out : null;
}

/** Returns human-readable errors; empty array when valid. */
export function validateCustomerCopy(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw !== 'object' || Array.isArray(raw)) return ['Customer message must be an object'];
  const errors: string[] = [];
  const allowed = new Set<string>(PROMO_CUSTOMER_COPY_PLACEHOLDERS);
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(PROMO_CUSTOMER_COPY_KEYS as readonly string[]).includes(key)) continue;
    if (value == null || value === '') continue;
    if (typeof value !== 'string') {
      errors.push(`${key} must be text`);
      continue;
    }
    if (value.trim().length > PROMO_CUSTOMER_COPY_MAX_LENGTH) {
      errors.push(`${key} must be at most ${PROMO_CUSTOMER_COPY_MAX_LENGTH} characters`);
    }
    for (const m of value.matchAll(PLACEHOLDER_RE)) {
      if (!allowed.has(m[1])) errors.push(`${key} uses unknown placeholder {${m[1]}}`);
    }
  }
  return errors;
}

export function renderCustomerCopy(
  template: string,
  vars: Partial<Record<(typeof PROMO_CUSTOMER_COPY_PLACEHOLDERS)[number], string | number | null | undefined>>,
): string {
  return template
    .replace(PLACEHOLDER_RE, (whole, name: string) => {
      const v = (vars as Record<string, unknown>)[name];
      return v == null || v === '' ? '' : String(v);
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}
