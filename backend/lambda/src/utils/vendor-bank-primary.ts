import { query } from '../database/rds-connection';

/**
 * Exactly one `vendor_bank_accounts` row per vendor should be `is_primary` (partial unique index).
 * After add/update from vendor settings, the saved row must be primary or GET /bank-details
 * (which historically preferred `is_primary DESC`) keeps returning an older primary row.
 */
export async function promoteVendorBankAccountToPrimary(vendorId: string, accountId: string): Promise<void> {
  await query(`UPDATE vendor_bank_accounts SET is_primary = false WHERE vendor_id = $1::uuid`, [vendorId]);
  await query(
    `UPDATE vendor_bank_accounts SET is_primary = true, updated_at = NOW() WHERE id = $2::uuid AND vendor_id = $1::uuid`,
    [vendorId, accountId]
  );
}
