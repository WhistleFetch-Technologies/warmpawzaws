import { query, select } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

export function normalizePhoneToLast10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

/**
 * PostgreSQL flexible phone match aligned with {@code CustomerRepository.findFirstMatchingPhoneInput}
 * (customer-service): exact trim, full digit-string equality, or right-aligned suffix when both sides
 * have at least 8 digits (handles country-code vs national formats without hard-coded country rules).
 */
async function findCustomerByFlexiblePhoneSql(rawPhone: string, digitsPhone: string): Promise<any | null> {
  const matched = await query(
    `SELECT * FROM customers c
     WHERE trim(COALESCE(c.phone, '')) = trim(COALESCE($1::text, ''))
        OR regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g')
             = regexp_replace(COALESCE($2::text, ''), '[^0-9]', '', 'g')
        OR (
             least(
               length(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g')),
               length(regexp_replace(COALESCE($2::text, ''), '[^0-9]', '', 'g'))
             ) >= 8
             AND right(
                  regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'),
                  least(
                    length(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g')),
                    length(regexp_replace(COALESCE($2::text, ''), '[^0-9]', '', 'g')),
                    15
                  )
                )
                = right(
                  regexp_replace(COALESCE($2::text, ''), '[^0-9]', '', 'g'),
                  least(
                    length(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g')),
                    length(regexp_replace(COALESCE($2::text, ''), '[^0-9]', '', 'g')),
                    15
                  )
                )
           )
     ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
     LIMIT 1`,
    [rawPhone, digitsPhone]
  ).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[findCustomerByPhone] flexible phone SQL failed:', msg);
    return { rows: [] as any[] };
  });

  return matched.rows.length > 0 ? matched.rows[0] : null;
}

/**
 * Resolve a customer row when `phone` formatting differs from {@code customers.phone}
 * (spaces, punctuation, country trunk). Exact match first; then digit-only; then SQL aligned with customer-service.
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

  const digitsParam = digitsOnly.length > 0 ? digitsOnly : raw;
  return findCustomerByFlexiblePhoneSql(raw, digitsParam);
}

/**
 * First path segment of {@code /customer/:segment/pets/...} may be a DB customer UUID or a phone string.
 * Matches customer-service behaviour for pet routes (UUID id vs flexible phone).
 *
 * When {@code petId} is set and the segment is a UUID, falls back to verifying ownership via
 * {@code pets.customer_id} if there is no {@code customers} row (e.g. UAT partial data, or reads that used
 * {@code GET /customer/pets/:petId} without a customer record).
 */
export async function findCustomerForCustomerPetPathSegment(
  segment: string,
  petId?: string
): Promise<any | null> {
  const s = String(segment || '').trim();
  if (!s) return null;
  if (isValidUUID(s)) {
    const byId = await select('customers', { id: s });
    if (byId.length > 0) return byId[0];

    const pid = String(petId || '').trim();
    if (!isValidUUID(pid)) return null;

    const pets = await select('pets', { id: pid });
    if (pets.length === 0) return null;
    const row = pets[0] as Record<string, unknown>;
    const ownerId = String(row.customer_id ?? row.customerId ?? '').trim();
    if (!ownerId || ownerId.toLowerCase() !== s.toLowerCase()) return null;

    return { id: ownerId };
  }
  return findCustomerByPhone(s);
}
