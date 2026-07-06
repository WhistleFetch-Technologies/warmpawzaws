/**
 * Vendor subscription tier commission lookup (vendor_tiers table).
 * Delegates to resolveVendorCommissionPolicy (Finance S2 authoritative resolver).
 */
import { resolveVendorCommissionPolicy } from '../finance/commission/resolve-vendor-commission-policy';

export async function getVendorTierCommission(vendorId: string): Promise<number> {
  const policy = await resolveVendorCommissionPolicy(vendorId);
  return policy.commissionRate;
}

export { resolveVendorCommissionPolicy } from '../finance/commission/resolve-vendor-commission-policy';
