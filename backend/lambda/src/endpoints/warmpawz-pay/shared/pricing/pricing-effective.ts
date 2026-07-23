import type { PricingStatus } from '../../constants/merchant-pricing';
import { PRICING_STATUS } from '../../constants/merchant-pricing';

export interface PricingEffectiveInput {
  readonly status: PricingStatus;
  readonly effectiveFrom: Date;
  readonly effectiveUntil: Date | null;
  readonly discountValue: number;
}

export function isPricingCurrentlyEffective(
  input: PricingEffectiveInput,
  at: Date = new Date(),
): boolean {
  if (input.status !== PRICING_STATUS.ACTIVE) {
    return false;
  }

  if (input.effectiveFrom.getTime() > at.getTime()) {
    return false;
  }

  if (input.effectiveUntil && input.effectiveUntil.getTime() < at.getTime()) {
    return false;
  }

  return input.discountValue >= 0;
}

export function isPricingConfigured(input: PricingEffectiveInput | null | undefined): boolean {
  if (!input) {
    return false;
  }
  return isPricingCurrentlyEffective(input);
}
