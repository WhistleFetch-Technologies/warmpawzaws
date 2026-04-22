import { query } from '../../../database/rds-connection';

/** PostgreSQL undefined_column — seen when `727_customer_password_reset_auth_version.sql` was not applied. */
export function isPgUndefinedAuthVersionColumnError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === '42703' && String(e.message || '').includes('auth_version');
}

/**
 * Sets password hash and bumps `auth_version` when the column exists (migration 727).
 * Falls back to a plain password update if the column is missing so older DBs do not 500.
 */
export async function updateCustomerPasswordHashWithAuthVersionBump(
  passwordHash: string,
  customerId: string
): Promise<void> {
  const withAv = `UPDATE customers SET password_hash = $1, password_set_at = NOW(),
     auth_version = COALESCE(auth_version, 0) + 1, updated_at = NOW() WHERE id = $2::uuid`;
  const withoutAv = `UPDATE customers SET password_hash = $1, password_set_at = NOW(),
     updated_at = NOW() WHERE id = $2::uuid`;
  try {
    await query(withAv, [passwordHash, customerId]);
  } catch (e) {
    if (isPgUndefinedAuthVersionColumnError(e)) {
      console.warn(
        '[auth_version] Column missing; run db/migrations/727_customer_password_reset_auth_version.sql. Updating password without bump.'
      );
      await query(withoutAv, [passwordHash, customerId]);
      return;
    }
    throw e;
  }
}

/** Load id + auth_version, or id + 0 when `auth_version` column is absent. */
export async function selectCustomerIdAndAuthVersion(
  customerId: string
): Promise<{ id: string; auth_version: number } | null> {
  try {
    const res = await query(
      `SELECT id, COALESCE(auth_version, 0)::int AS auth_version FROM customers WHERE id = $1::uuid LIMIT 1`,
      [customerId]
    );
    const row = (res as any).rows?.[0];
    if (!row) return null;
    return { id: String(row.id), auth_version: Number(row.auth_version) };
  } catch (e) {
    if (isPgUndefinedAuthVersionColumnError(e)) {
      const res = await query(`SELECT id FROM customers WHERE id = $1::uuid LIMIT 1`, [customerId]);
      const row = (res as any).rows?.[0];
      if (!row) return null;
      return { id: String(row.id), auth_version: 0 };
    }
    throw e;
  }
}
