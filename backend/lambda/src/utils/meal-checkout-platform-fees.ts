/**
 * Meal checkout platform + convenience fees — uses admin Finance overrides (nutritionist / order).
 * Delivery for meals stays on computePolicyDeliveryFeeForOrder (distance policy), not feeCalculator delivery.
 */

import { calculateFinalFees } from './feeCalculator';

export async function computeNutritionistMealCheckoutFees(subtotalInr: number): Promise<{
  platformFee: number;
  convenienceFee: number;
}> {
  const amount = Math.max(0, Number(subtotalInr) || 0);
  const fees = await calculateFinalFees({
    amount,
    type: 'order',
    businessServiceType: 'nutritionist',
  });
  return {
    platformFee: fees.platformFee,
    convenienceFee: fees.convenienceFee,
  };
}
