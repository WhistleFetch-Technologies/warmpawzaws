import { query } from '../../../database/rds-connection';
import { isPgUndefinedAuthVersionColumnError } from './customer-auth-version-support';

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
