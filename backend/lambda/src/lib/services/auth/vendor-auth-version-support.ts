import { query } from '../../../database/rds-connection';
import {
  isPgUndefinedAuthVersionColumnError,
} from './customer-auth-version-support';

/**
 * Sets vendors.password_hash and bumps auth_version when the column exists (migration 728).
 */
export async function updateVendorPasswordHashWithAuthVersionBump(
  passwordHash: string,
  vendorId: string
): Promise<void> {
  const withAv = `UPDATE vendors SET password_hash = $1,
     auth_version = COALESCE(auth_version, 0) + 1, updated_at = NOW() WHERE id = $2::uuid`;
  const withoutAv = `UPDATE vendors SET password_hash = $1, updated_at = NOW() WHERE id = $2::uuid`;
  try {
    await query(withAv, [passwordHash, vendorId]);
  } catch (e) {
    if (isPgUndefinedAuthVersionColumnError(e)) {
      console.warn(
        '[auth_version] vendors.auth_version missing; run db/migrations/728_vendor_password_hash_auth_version.sql. Updating password without bump.'
      );
      await query(withoutAv, [passwordHash, vendorId]);
      return;
    }
    throw e;
  }
}

/** Load id + auth_version for vendor password-reset JWT binding (parity with customers). */
export async function selectVendorIdAndAuthVersion(
  vendorId: string
): Promise<{ id: string; auth_version: number } | null> {
  try {
    const res = await query(
      `SELECT id, COALESCE(auth_version, 0)::int AS auth_version FROM vendors WHERE id = $1::uuid LIMIT 1`,
      [vendorId]
    );
    const row = (res as any).rows?.[0];
    if (!row) return null;
    return { id: String(row.id), auth_version: Number(row.auth_version) };
  } catch (e) {
    if (isPgUndefinedAuthVersionColumnError(e)) {
      const res = await query(`SELECT id FROM vendors WHERE id = $1::uuid LIMIT 1`, [vendorId]);
      const row = (res as any).rows?.[0];
      if (!row) return null;
      return { id: String(row.id), auth_version: 0 };
    }
    throw e;
  }
}
