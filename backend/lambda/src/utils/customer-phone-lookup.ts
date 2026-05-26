import { query, select } from '../database/rds-connection';

export function normalizePhoneToLast10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

/**
 * Resolve a customer row when `phone` may be stored as 10 digits, +91..., or with separators.
 */
export async function findCustomerByPhone(phone: string): Promise<any | null> {
  const raw = String(phone || '').trim();
  if (!raw) return null;

  const exact = await select('customers', { phone: raw });
  if (exact.length > 0) return exact[0];

  const last10 = normalizePhoneToLast10(raw);
  if (last10.length !== 10) return null;

  const candidates = [last10, `+91${last10}`];
  const matched = await query(
    `SELECT * FROM customers
     WHERE phone = ANY($1::text[])
        OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $2
     ORDER BY
       CASE
         WHEN phone = $3 THEN 0
         WHEN phone = $4 THEN 1
         ELSE 2
       END,
       updated_at DESC NULLS LAST,
       created_at DESC NULLS LAST
     LIMIT 1`,
    [candidates, last10, candidates[0], candidates[1]]
  ).catch(() => ({ rows: [] as any[] }));

  return matched.rows.length > 0 ? matched.rows[0] : null;
}
