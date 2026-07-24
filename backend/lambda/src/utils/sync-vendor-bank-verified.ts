import { query } from '../database/rds-connection';

/** Keep vendors.bank_verified in sync when a bank account is verified. */
export async function markVendorBankVerified(vendorId: string): Promise<void> {
  await query(
    `UPDATE vendors SET bank_verified = true, updated_at = NOW() WHERE id = $1`,
    [vendorId],
  );
}
