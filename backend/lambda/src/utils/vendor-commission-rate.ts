import { resolveVendorCommissionPolicy } from '../finance/commission/resolve-vendor-commission-policy';
import { getPackageCommissionRate } from '../finance/commission/resolve-package-commission-policy';

/** Canonical package parent row: purchase anchor — per-session earnings accrue on children elsewhere. */
export function isCanonicalPackageParentBooking(booking: Record<string, unknown>): boolean {
  const pp = booking.package_purchase_id ?? booking.packagePurchaseId;
  const isChild = Boolean(booking.is_package_session ?? booking.isPackageSession);
  return Boolean(pp) && !isChild;
}

/** Package session child: fulfillment row. Vendor earnings must be a slice, not full parent price. */
export function isPackageSessionChildBooking(booking: Record<string, unknown>): boolean {
  const pp = booking.package_purchase_id ?? booking.packagePurchaseId;
  return Boolean(pp) && Boolean(booking.is_package_session ?? booking.isPackageSession);
}

/**
 * Commission rate for a vendor from active tier (`vendor_tiers` matched by `vendors.tier`).
 * Delegates to resolveVendorCommissionPolicy (Finance S2 authoritative resolver).
 */
export async function getVendorCommissionRate(vendorId: string): Promise<number> {
  const policy = await resolveVendorCommissionPolicy(vendorId);
  return policy.commissionRate;
}

export { resolveVendorCommissionPolicy, getPackageCommissionRate };
