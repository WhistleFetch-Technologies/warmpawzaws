/**
 * Resolve vendor row for password login (phone-as-username), aligned with OTP vendor lookup.
 */
import { query, select } from '../../../database/rds-connection';
import { normalizePhoneForOtp } from './customer-username-lookup';
import { verifyCustomerPassword } from './customer-password-crypto';

export function isVendorRowDeleted(record: any): boolean {
  if (!record || record.is_deleted === undefined || record.is_deleted === null) return false;
  if (record.is_deleted === true) return true;
  if (record.is_deleted === 't') return true;
  if (typeof record.is_deleted === 'string' && record.is_deleted.toLowerCase() === 'true') return true;
  if (record.is_deleted === 1) return true;
  return false;
}

/** Last-10-digit match on vendors.phone (Indian mobiles and +91 variants). */
export async function selectVendorsByLast10Digits(last10: string): Promise<any[]> {
  const key = last10.replace(/\D/g, '').slice(-10);
  if (!key || key.length < 10) return [];
  const res = await query(
    `SELECT * FROM vendors
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
    [key]
  );
  return (res as any).rows || [];
}

/**
 * Merge onboarding_status from vendor_identity when present (same spirit as verify-otp vendor branch).
 */
export async function mergeVendorIdentityOnboarding(vendor: any): Promise<any> {
  const merged = { ...vendor };
  const phones = Array.from(
    new Set(
      [vendor.phone, normalizePhoneForOtp(String(vendor.phone || ''))].filter(
        (p): p is string => typeof p === 'string' && p.length > 0
      )
    )
  );

  for (const p of phones) {
    try {
      let rows = await select('vendor_identity', { phone: p });
      const vi = (rows || []).find((r: any) => !isVendorRowDeleted(r));
      if (vi) {
        merged.onboarding_status = vi.onboarding_status;
        merged.vendor_identity_id = vi.id;
        break;
      }
    } catch {
      // non-fatal
    }
  }
  return merged;
}

/**
 * Resolve vendor by phone string: exact / normalized OTP form, then last-10 digits.
 * Skips soft-deleted vendors (same as OTP path).
 */
export async function findVendorForPasswordLogin(rawUsername: string): Promise<any | null> {
  const key = String(rawUsername || '').trim();
  if (!key) return null;

  const normalizedKey = normalizePhoneForOtp(key);

  try {
    const rExact = await query(
      `SELECT * FROM vendors WHERE phone = $1 OR phone = $2 LIMIT 10`,
      [key, normalizedKey]
    );
    const exactRows = (rExact as any).rows || [];
    const hit = exactRows.find((r: any) => !isVendorRowDeleted(r));
    if (hit) return hit;
  } catch {
    // fall through to last-10
  }

  const digits = key.replace(/\D/g, '');
  if (digits.length >= 10) {
    const list = await selectVendorsByLast10Digits(digits.slice(-10));
    const first = list.find((r) => !isVendorRowDeleted(r));
    if (first) return first;
  }

  return null;
}

export type VendorPasswordLoginResolution =
  | { kind: 'matched'; vendor: any }
  | { kind: 'not_found' }
  | { kind: 'password_on_inactive_only'; activeBusinessName?: string | null; inactiveBusinessName?: string | null }
  | { kind: 'no_active_vendor' };

function dedupeVendorsById(rows: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows) {
    const id = row?.id != null ? String(row.id) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/** Collect vendor rows for a dialable username (exact phone, then last-10). */
export async function collectVendorRowsForPasswordUsername(rawUsername: string): Promise<any[]> {
  const key = String(rawUsername || '').trim();
  if (!key) return [];

  const normalizedKey = normalizePhoneForOtp(key);
  const collected: any[] = [];

  try {
    const rExact = await query(
      `SELECT * FROM vendors WHERE phone = $1 OR phone = $2 LIMIT 25`,
      [key, normalizedKey]
    );
    collected.push(...((rExact as any).rows || []));
  } catch {
    /* fall through */
  }

  const digits = key.replace(/\D/g, '');
  if (digits.length >= 10) {
    collected.push(...(await selectVendorsByLast10Digits(digits.slice(-10))));
  }

  return dedupeVendorsById(collected);
}

/**
 * When one phone maps to multiple vendor rows, pick the row whose stored password matches.
 * Surfaces when the password belongs only to a soft-deleted/inactive profile.
 */
export async function resolveVendorForPasswordLogin(
  rawUsername: string,
  plainPassword: string,
  hasMeaningfulPassword: (hash: unknown) => boolean
): Promise<VendorPasswordLoginResolution> {
  const rows = await collectVendorRowsForPasswordUsername(rawUsername);
  if (rows.length === 0) return { kind: 'not_found' };

  const active = rows.filter((r) => !isVendorRowDeleted(r));
  if (active.length === 0) return { kind: 'no_active_vendor' };

  const pass = String(plainPassword ?? '');
  let inactiveMatch: any | null = null;

  for (const row of rows) {
    if (!hasMeaningfulPassword(row.password_hash)) continue;
    const ok = await verifyCustomerPassword(pass, row.password_hash);
    if (!ok) continue;
    if (!isVendorRowDeleted(row)) {
      return { kind: 'matched', vendor: row };
    }
    if (!inactiveMatch) inactiveMatch = row;
  }

  if (inactiveMatch) {
    const primaryActive = active[0];
    return {
      kind: 'password_on_inactive_only',
      activeBusinessName: primaryActive?.business_name ?? null,
      inactiveBusinessName: inactiveMatch?.business_name ?? null,
    };
  }

  return { kind: 'not_found' };
}

/**
 * When `vendors` has no row yet for this phone (e.g. application submitted, row pending),
 * resolve `vendors.id` via `vendor_identity`: linked `vendor_id`, or a vendors row whose id equals identity.id.
 */
export async function findVendorIdViaVendorIdentityByPhone(rawUsername: string): Promise<string | null> {
  const key = String(rawUsername || '').trim();
  if (!key) return null;
  const normalizedKey = normalizePhoneForOtp(key);
  const digits = key.replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : '';

  const res = await query(
    `SELECT vi.id, vi.vendor_id
     FROM vendor_identity vi
     WHERE (vi.is_deleted IS NULL OR vi.is_deleted = false OR vi.is_deleted = 'f')
       AND (
         vi.phone = $1
         OR vi.phone = $2
         OR ($3::text <> '' AND LENGTH(REGEXP_REPLACE(COALESCE(vi.phone, ''), '[^0-9]', '', 'g')) >= 10
             AND RIGHT(REGEXP_REPLACE(COALESCE(vi.phone, ''), '[^0-9]', '', 'g'), 10) = $3)
       )
     ORDER BY vi.updated_at DESC NULLS LAST, vi.created_at DESC NULLS LAST
     LIMIT 10`,
    [key, normalizedKey, last10]
  );
  const rows = (res as any).rows || [];

  for (const vi of rows) {
    const vid = vi.vendor_id;
    if (vid) {
      const chk = await query(
        `SELECT id FROM vendors WHERE id = $1::uuid AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f') LIMIT 1`,
        [String(vid)]
      );
      if ((chk as any).rows?.[0]) return String((chk as any).rows[0].id);
    }
    const iid = vi.id;
    if (iid) {
      const chkSame = await query(
        `SELECT id FROM vendors WHERE id = $1::uuid AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f') LIMIT 1`,
        [String(iid)]
      );
      if ((chkSame as any).rows?.[0]) return String((chkSame as any).rows[0].id);
    }
  }
  return null;
}

/**
 * Forgot-password only: resolve vendor by `vendors.email` (case-insensitive, trimmed).
 * Not used for password login. Skips soft-deleted rows.
 */
export async function findVendorByEmailForForgotPassword(rawEmail: string): Promise<any | null> {
  const em = String(rawEmail || '').trim();
  if (!em || !em.includes('@')) return null;
  try {
    const res = await query(
      `SELECT * FROM vendors
       WHERE NULLIF(TRIM(COALESCE(email, '')), '') IS NOT NULL
         AND LOWER(TRIM(email)) = LOWER(TRIM($1))
       LIMIT 10`,
      [em]
    );
    const rows = (res as any).rows || [];
    return rows.find((r: any) => !isVendorRowDeleted(r)) || null;
  } catch {
    return null;
  }
}

/** Phone/username (via {@link findVendorForPasswordLogin}), then email when username contains `@`. */
export async function findVendorForForgotPassword(rawUsername: string): Promise<any | null> {
  const byPhone = await findVendorForPasswordLogin(rawUsername);
  if (byPhone) return byPhone;
  const key = String(rawUsername || '').trim();
  if (key.includes('@')) {
    return findVendorByEmailForForgotPassword(key);
  }
  return null;
}
