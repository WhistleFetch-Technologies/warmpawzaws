import { query, select } from '../database/rds-connection';

export function normalizePhoneToLast10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

/**
 * Resolve a customer row when `phone` formatting differs from {@code customers.phone}
 * (spaces, punctuation, country trunk). Exact match first; then digit-normalized / suffix alignment in SQL.
 */
export async function findCustomerByPhone(phone: string): Promise<any | null> {
  const raw = String(phone || '').trim();
  if (!raw) return null;

  const exact = await select('customers', { phone: raw });
  if (exact.length > 0) return exact[0];

  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length > 0) {
    const byDigits = await select('customers', { phone: digitsOnly });
    if (byDigits.length > 0) return byDigits[0];
  }

  const last10 = normalizePhoneToLast10(raw);
  if (last10.length !== 10) return null;

  const matched = await query(
    `SELECT * FROM customers
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [last10]
  ).catch(() => ({ rows: [] as any[] }));

  return matched.rows.length > 0 ? matched.rows[0] : null;
}
