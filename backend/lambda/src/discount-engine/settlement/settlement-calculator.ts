import type { DiscountContext } from '../models/discount-context';
import { DiscountFunding } from '../enums/discount-funding';
import type {
  FundingAllocationResult,
  ResolvedSettlementPolicy,
  SettlementFeeBreakdown,
  SharedDiscountShare,
} from './types';

function roundMoney(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function extractFeesFromContext(context: DiscountContext): SettlementFeeBreakdown {
  const fees = (context.metadata?.fees ?? context.metadata?.feeBreakdown) as
    | Record<string, unknown>
    | undefined;

  const num = (key: string): number => {
    const v = fees?.[key];
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };

  return {
    platformFees: num('platformFee') || num('platformFees'),
    convenienceFees: num('convenienceFee') || num('convenienceFees'),
    deliveryFees: num('deliveryFee') || num('deliveryFees'),
    packagingFees: num('packagingFee') || num('packagingFees'),
    taxes: num('tax') || num('taxes') || num('gst'),
  };
}

export interface SettlementCalculationInput {
  originalAmount: number;
  customerPayable: number;
  totalSavings: number;
  allocation: FundingAllocationResult;
  fees: SettlementFeeBreakdown;
  policy: ResolvedSettlementPolicy;
  /** Optional commission rate hint for netSettlement preview (0–100). */
  commissionRateHint?: number;
}

export interface SettlementCalculationResult {
  vendorDiscountShare: number;
  platformDiscountShare: number;
  sharedDiscountShare: SharedDiscountShare;
  vendorReceivable: number;
  platformCost: number;
  platformReceivable: number;
  netSettlement: number;
}

/**
 * Pure financial distribution from funding allocation + fees.
 * Does not call legacy commission services — optional rate hint only.
 */
export class SettlementCalculator {
  calculate(input: SettlementCalculationInput): SettlementCalculationResult {
    const { originalAmount, customerPayable, allocation, fees, policy, commissionRateHint } = input;
    const roundTo = policy.roundTo;

    const vendorDiscountShare = allocation.vendorShare;
    const platformDiscountShare = allocation.platformShare;

    const sharedTotal = roundMoney(
      allocation.lines
        .filter((l) => l.funding === DiscountFunding.SHARED)
        .reduce((s, l) => s + l.discountAmount, 0),
      roundTo
    );
    const sharedPlatform = roundMoney(
      allocation.lines
        .filter((l) => l.funding === DiscountFunding.SHARED)
        .reduce((s, l) => s + l.platformShare, 0),
      roundTo
    );
    const sharedVendor = roundMoney(sharedTotal - sharedPlatform, roundTo);

    const vendorReceivable = roundMoney(
      Math.max(0, originalAmount - vendorDiscountShare),
      roundTo
    );
    const platformCost = platformDiscountShare;

    const platformReceivable = roundMoney(
      Math.max(0, fees.platformFees + fees.convenienceFees + fees.deliveryFees + fees.packagingFees - platformCost),
      roundTo
    );

    let netSettlement = vendorReceivable;
    if (commissionRateHint != null && Number.isFinite(commissionRateHint) && commissionRateHint > 0) {
      const commission = roundMoney(vendorReceivable * (commissionRateHint / 100), roundTo);
      netSettlement = roundMoney(Math.max(0, vendorReceivable - commission), roundTo);
    }

    void customerPayable;

    return {
      vendorDiscountShare,
      platformDiscountShare,
      sharedDiscountShare: {
        platform: sharedPlatform,
        vendor: sharedVendor,
        total: sharedTotal,
      },
      vendorReceivable,
      platformCost,
      platformReceivable,
      netSettlement,
    };
  }
}

let defaultCalculator: SettlementCalculator | null = null;

export function getSettlementCalculator(): SettlementCalculator {
  if (!defaultCalculator) defaultCalculator = new SettlementCalculator();
  return defaultCalculator;
}

export function resetSettlementCalculatorForTests(): void {
  defaultCalculator = new SettlementCalculator();
}
