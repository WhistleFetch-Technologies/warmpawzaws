import { query } from '../database/rds-connection';

/** Canonical package parent row: purchase anchor — per-session earnings accrue on children elsewhere. */
export function isCanonicalPackageParentBooking(booking: Record<string, unknown>): boolean {
  const pp = booking.package_purchase_id ?? booking.packagePurchaseId;
  const isChild = Boolean(booking.is_package_session ?? booking.isPackageSession);
  return Boolean(pp) && !isChild;
}

/**
 * Commission rate for a vendor from active tier (`vendor_tiers` matched by `vendors.tier`).
 * Percentage number e.g. 15 for 15%. Default 15% when tier missing.
 */
export async function getVendorCommissionRate(vendorId: string): Promise<number> {
  try {
    const tierResult = await query(
      `SELECT vt.commission_rate
       FROM vendors v
       LEFT JOIN vendor_tiers vt ON vt.is_active = true
         AND (TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name)))
       WHERE v.id = $1
       LIMIT 1`,
      [vendorId]
    );

    const commissionRate = tierResult.rows?.[0]?.commission_rate;

    if (commissionRate != null && !isNaN(Number(commissionRate))) {
      return Number(commissionRate);
    }

    console.warn(`⚠️ [COMMISSION] No tier found for vendor ${vendorId}, using default 15%`);
    return 15;
  } catch (error: unknown) {
    console.error(`❌ [COMMISSION] Error getting commission rate for vendor ${vendorId}:`, error);
    return 15;
  }
}
