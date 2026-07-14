import { resolveSettlementPolicy } from './settlement-policy';
import { getFundingAllocator } from './funding-allocator';
import { extractFeesFromContext, getSettlementCalculator } from './settlement-calculator';
import { buildSettlementPreview, toDiscountSettlementPreview } from './settlement-preview';
import { getSettlementMode } from './settlement-mode';
import type { SettlementDecision, SettlementEngineInput } from './types';
import type { DiscountSettlementPreview } from '../models/discount-result';

/**
 * Pure Settlement Engine — funding allocation and preview only.
 * No DB writes, payouts, or Razorpay.
 */
export class DefaultSettlementEngine {
  settle(input: SettlementEngineInput): SettlementDecision {
    const started = Date.now();
    const { context, applied, originalAmount, customerPayable, totalSavings, runtimePolicy, policyFingerprint } =
      input;

    const policy = resolveSettlementPolicy(context.domain, runtimePolicy.funding);
    const allocation = getFundingAllocator().allocate(applied, policy);
    const fees = extractFeesFromContext(context);

    const commissionRateHint =
      typeof context.metadata?.commissionRate === 'number'
        ? context.metadata.commissionRate
        : typeof context.metadata?.commissionRateHint === 'number'
          ? context.metadata.commissionRateHint
          : undefined;

    const calc = getSettlementCalculator().calculate({
      originalAmount,
      customerPayable,
      totalSavings,
      allocation,
      fees,
      policy,
      commissionRateHint,
    });

    const { preview, audit } = buildSettlementPreview(
      {
        mode: getSettlementMode(),
        policyFingerprint,
        originalAmount,
        customerPaid: customerPayable,
        totalDiscount: totalSavings,
        vendorDiscountShare: calc.vendorDiscountShare,
        platformDiscountShare: calc.platformDiscountShare,
        sharedDiscountShare: calc.sharedDiscountShare,
        vendorReceivable: calc.vendorReceivable,
        platformCost: calc.platformCost,
        platformReceivable: calc.platformReceivable,
        netSettlement: calc.netSettlement,
        appliedFunding: allocation.lines,
        fees,
        executionTimeMs: 0,
      },
      started
    );

    return { preview, audit };
  }

  /** Contract-compatible compute for DiscountEngineResult assembly. */
  computeFromApplied(
    input: SettlementEngineInput
  ): DiscountSettlementPreview {
    return toDiscountSettlementPreview(this.settle(input).preview);
  }
}

let defaultEngine: DefaultSettlementEngine | null = null;

export function getSettlementEngine(): DefaultSettlementEngine {
  if (!defaultEngine) defaultEngine = new DefaultSettlementEngine();
  return defaultEngine;
}

export function resetSettlementEngineForTests(): void {
  defaultEngine = new DefaultSettlementEngine();
}
