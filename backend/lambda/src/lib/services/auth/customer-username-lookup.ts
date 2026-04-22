/**
 * Shared customer resolution for password login and password-reset flows.
 */
import { query } from '../../../database/rds-connection';

/**
 * Normalize phone to canonical form for OTP storage/lookup.
 * Ensures "9326977987", "+919326977987", "919326977987" all match.
 * Indian 10-digit numbers: use last 10 digits. Others: digits only.
 */
export function normalizePhoneForOtp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10;
  }
  return digits || phone;
}

/** Collapse +91 and 10-digit customer rows to one canonical record. */
export async function selectCustomersByLast10Digits(last10: string): Promise<any[]> {
  const key = last10.replace(/\D/g, '').slice(-10);
  if (!key || key.length < 10) return [];
  const res = await query(
    `SELECT * FROM customers
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     ORDER BY
       LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) ASC,
       (profile_completed IS TRUE) DESC,
       updated_at DESC NULLS LAST,
       created_at DESC NULLS LAST`,
    [key]
  );
  return (res as any).rows || [];
}

export function dialablePhoneForCustomerAuth(dbPhone: string | null | undefined): string {
  const raw = String(dbPhone || '').trim();
  const d = raw.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (raw.startsWith('+')) return raw;
  return raw || d || '';
}

function isCustomerRowDeleted(record: any): boolean {
  if (!record || record.is_deleted === undefined || record.is_deleted === null) return false;
  if (record.is_deleted === true) return true;
  if (record.is_deleted === 't') return true;
  if (typeof record.is_deleted === 'string' && record.is_deleted.toLowerCase() === 'true') return true;
  if (record.is_deleted === 1) return true;
  return false;
}

/**
 * Resolve customer by username (exact / case-insensitive), phone last-10, or email (case-insensitive).
 * Skips soft-deleted rows (same spirit as verify-otp customer path).
 */
export async function findCustomerForPasswordLogin(rawUsername: string): Promise<any | null> {
  const key = String(rawUsername || '').trim();
  if (!key) return null;
  const r1 = await query(`SELECT * FROM customers WHERE username = $1 LIMIT 3`, [key]);
  const row1 = (r1 as any).rows?.[0];
  if (row1 && !isCustomerRowDeleted(row1)) return row1;
  const r2 = await query(`SELECT * FROM customers WHERE LOWER(username) = LOWER($1) LIMIT 3`, [key]);
  const row2 = (r2 as any).rows?.[0];
  if (row2 && !isCustomerRowDeleted(row2)) return row2;
  if (key.includes('@')) {
    const r3 = await query(
      `SELECT * FROM customers WHERE LOWER(TRIM(COALESCE(email, ''))) = LOWER(TRIM($1)) LIMIT 3`,
      [key]
    );
    const row3 = (r3 as any).rows?.[0];
    if (row3 && !isCustomerRowDeleted(row3)) return row3;
  }
  const digits = key.replace(/\D/g, '');
  if (digits.length >= 10) {
    const list = await selectCustomersByLast10Digits(digits.slice(-10));
    const first = list.find((r) => !isCustomerRowDeleted(r));
    if (first) return first;
  }
  return null;
}
