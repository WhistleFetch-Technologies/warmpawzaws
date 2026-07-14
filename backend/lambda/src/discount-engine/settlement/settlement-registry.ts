import { DiscountFunding } from '../enums/discount-funding';
import { DiscountOwner } from '../enums/discount-owner';
import type { AppliedDiscount } from '../models/discount-result';

/** Infer funding when candidate metadata omits explicit funding. */
export function resolveAppliedDiscountFunding(discount: AppliedDiscount): DiscountFunding {
  if (discount.funding) return discount.funding;

  if (discount.legacySource === 'vendor' || discount.owner === DiscountOwner.VENDOR) {
    return DiscountFunding.VENDOR;
  }
  if (discount.legacySource === 'platform' || discount.owner === DiscountOwner.PLATFORM) {
    return DiscountFunding.PLATFORM;
  }
  if (discount.legacySource === 'coupon') {
    const metaFunding = discount.metadata?.funding;
    if (metaFunding === DiscountFunding.VENDOR || metaFunding === 'VENDOR') {
      return DiscountFunding.VENDOR;
    }
    return DiscountFunding.PLATFORM;
  }

  return DiscountFunding.PLATFORM;
}

export function readSharedSplitOverride(
  discount: AppliedDiscount
): { platformPercent: number; vendorPercent: number } | undefined {
  const raw = discount.metadata?.sharedSplit as
    | { platformPercent?: number; vendorPercent?: number }
    | undefined;
  if (!raw) return undefined;
  const platformPercent = Number(raw.platformPercent);
  const vendorPercent = Number(raw.vendorPercent);
  if (!Number.isFinite(platformPercent) || !Number.isFinite(vendorPercent)) return undefined;
  if (platformPercent + vendorPercent <= 0) return undefined;
  return { platformPercent, vendorPercent };
}
