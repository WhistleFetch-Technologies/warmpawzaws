/**
 * Pick ecommerce cart/PDP discount outcome using published ECOMMERCE Policy Center stack rules.
 * Default: Best Offer (allowPlatformWithVendor=false) → single higher discount.
 * When allowPlatformWithVendor=true → sum vendor+admin; primary source = larger funder.
 */

import { DiscountDomain } from '../discount-engine/enums/discount-domain';
import { loadPublishedPolicyFromDb } from '../discount-engine/policy/policy-persistence';
import { loadRuntimePolicy } from '../discount-engine/policy/runtime-policy-loader';

export type EcommercePromoSource = 'vendor' | 'admin';

export interface EcommercePromoWinnerInput {
  vendorDiscount: number;
  adminDiscount: number;
  /** When stack is off and discounts tie, prefer this source (default vendor — matches prior apply path). */
  tieBreak?: EcommercePromoSource;
}

export interface EcommercePromoWinnerResult {
  discountAmount: number;
  /** Primary funder for settlement / promotion_source (single-id schema). */
  promotionSource: EcommercePromoSource | null;
  /** True when policy allows both and both discounts are > 0. */
  stacked: boolean;
  vendorApplied: number;
  adminApplied: number;
  allowPlatformWithVendor: boolean;
}

function sanitize(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/**
 * Sync selection using cached/default policy. Prefer {@link selectEcommercePromotionWinnerAsync}
 * on request paths so published Policy Center is loaded first.
 */
export function selectEcommercePromotionWinner(
  input: EcommercePromoWinnerInput,
): EcommercePromoWinnerResult {
  const vendorDiscount = sanitize(input.vendorDiscount);
  const adminDiscount = sanitize(input.adminDiscount);
  const tieBreak = input.tieBreak ?? 'vendor';

  const policy = loadRuntimePolicy(DiscountDomain.ECOMMERCE);
  const allowPlatformWithVendor = Boolean(policy.stack?.global?.allowPlatformWithVendor);

  if (vendorDiscount <= 0 && adminDiscount <= 0) {
    return {
      discountAmount: 0,
      promotionSource: null,
      stacked: false,
      vendorApplied: 0,
      adminApplied: 0,
      allowPlatformWithVendor,
    };
  }

  if (allowPlatformWithVendor && vendorDiscount > 0 && adminDiscount > 0) {
    const discountAmount = vendorDiscount + adminDiscount;
    const promotionSource: EcommercePromoSource =
      adminDiscount > vendorDiscount
        ? 'admin'
        : vendorDiscount > adminDiscount
          ? 'vendor'
          : tieBreak;
    return {
      discountAmount,
      promotionSource,
      stacked: true,
      vendorApplied: vendorDiscount,
      adminApplied: adminDiscount,
      allowPlatformWithVendor,
    };
  }

  // Best Offer: single winner
  let promotionSource: EcommercePromoSource | null = null;
  let discountAmount = 0;
  if (adminDiscount > vendorDiscount) {
    promotionSource = 'admin';
    discountAmount = adminDiscount;
  } else if (vendorDiscount > adminDiscount) {
    promotionSource = 'vendor';
    discountAmount = vendorDiscount;
  } else if (vendorDiscount > 0) {
    promotionSource = tieBreak;
    discountAmount = vendorDiscount;
  }

  return {
    discountAmount,
    promotionSource,
    stacked: false,
    vendorApplied: promotionSource === 'vendor' ? vendorDiscount : 0,
    adminApplied: promotionSource === 'admin' ? adminDiscount : 0,
    allowPlatformWithVendor,
  };
}

export async function selectEcommercePromotionWinnerAsync(
  input: EcommercePromoWinnerInput,
): Promise<EcommercePromoWinnerResult> {
  await loadPublishedPolicyFromDb();
  return selectEcommercePromotionWinner(input);
}
