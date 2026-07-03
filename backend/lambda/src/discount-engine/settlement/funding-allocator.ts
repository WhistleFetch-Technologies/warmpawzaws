import { DiscountFunding } from '../enums/discount-funding';
import type { AppliedDiscount } from '../models/discount-result';
import type { AppliedFundingLine, FundingAllocationResult, ResolvedSettlementPolicy } from './types';
import { readSharedSplitOverride, resolveAppliedDiscountFunding } from './settlement-registry';

function roundMoney(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Allocates each applied discount to platform / vendor shares per FundingConfiguration.
 */
export class FundingAllocator {
  allocate(
    applied: AppliedDiscount[],
    policy: ResolvedSettlementPolicy
  ): FundingAllocationResult {
    let platformShare = 0;
    let vendorShare = 0;
    const lines: AppliedFundingLine[] = [];

    for (const discount of applied) {
      const amount = Math.max(0, discount.discountAmount);
      if (amount <= 0) continue;

      const funding = resolveAppliedDiscountFunding(discount);
      let linePlatform = 0;
      let lineVendor = 0;
      let sharedSplit: { platformPercent: number; vendorPercent: number } | undefined;

      if (funding === DiscountFunding.PLATFORM) {
        linePlatform = amount;
      } else if (funding === DiscountFunding.VENDOR) {
        lineVendor = amount;
      } else {
        sharedSplit = readSharedSplitOverride(discount) ?? policy.sharedDefaultSplit;
        linePlatform = roundMoney(amount * (sharedSplit.platformPercent / 100), policy.roundTo);
        lineVendor = roundMoney(amount - linePlatform, policy.roundTo);
      }

      platformShare = roundMoney(platformShare + linePlatform, policy.roundTo);
      vendorShare = roundMoney(vendorShare + lineVendor, policy.roundTo);

      lines.push({
        discountId: discount.id,
        name: discount.name,
        funding,
        discountAmount: amount,
        platformShare: linePlatform,
        vendorShare: lineVendor,
        order: discount.order,
        sharedSplit,
      });
    }

    return { platformShare, vendorShare, lines };
  }
}

let defaultAllocator: FundingAllocator | null = null;

export function getFundingAllocator(): FundingAllocator {
  if (!defaultAllocator) defaultAllocator = new FundingAllocator();
  return defaultAllocator;
}

export function resetFundingAllocatorForTests(): void {
  defaultAllocator = new FundingAllocator();
}
