/**
 * Commerce-aware package commission: Marketplace vs Warmpawz Pay publication tier.
 * Does not change GST or customer selling price.
 */
import {
  resolveVendorCommissionPolicy,
  type VendorCommissionPolicy,
} from './resolve-vendor-commission-policy';
import { resolveWpayPublicationCommission } from './resolve-wpay-publication-commission';
import {
  MARKETPLACE_PACKAGE_COMMERCE_MODE,
  WARMPAWZ_PAY_PACKAGE_COMMERCE_MODE,
  normalizePackageCommerceMode,
  type PackageCommerceMode,
} from '../../utils/vendor-service-is-package';

export type PackageCommissionPolicy = VendorCommissionPolicy & {
  commerceMode: PackageCommerceMode;
  commissionSource: 'marketplace_tier' | 'wpay_publication_tier' | 'fallback';
};

export async function resolvePackageCommissionPolicy(
  vendorId: string,
  commerceModeRaw?: unknown
): Promise<PackageCommissionPolicy> {
  const commerceMode = normalizePackageCommerceMode(commerceModeRaw);

  if (commerceMode === WARMPAWZ_PAY_PACKAGE_COMMERCE_MODE) {
    const wpay = await resolveWpayPublicationCommission(vendorId);
    return {
      vendorId,
      commissionRate: wpay.commissionRate,
      tier: {
        id: wpay.tierId,
        name: wpay.tierName,
        displayName: wpay.tierName,
        tierLevel: null,
      },
      subscription: { active: false, tierId: null, tierName: null, expiresAt: null },
      tierSource: wpay.found ? 'vendor_tier' : 'fallback',
      subscriptionSource: 'none',
      fallbackSource: wpay.found ? null : 'wpay_publication_tier_missing',
      commerceMode: WARMPAWZ_PAY_PACKAGE_COMMERCE_MODE,
      commissionSource: wpay.found ? 'wpay_publication_tier' : 'fallback',
    };
  }

  const marketplace = await resolveVendorCommissionPolicy(vendorId);
  return {
    ...marketplace,
    commerceMode: MARKETPLACE_PACKAGE_COMMERCE_MODE,
    commissionSource:
      marketplace.tierSource === 'fallback' ? 'fallback' : 'marketplace_tier',
  };
}

export async function getPackageCommissionRate(
  vendorId: string,
  commerceModeRaw?: unknown
): Promise<number> {
  const policy = await resolvePackageCommissionPolicy(vendorId, commerceModeRaw);
  return policy.commissionRate;
}
