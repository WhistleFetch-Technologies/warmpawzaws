import type { SavingsAnalyticsSummary, PromotionUsageRow, CouponUsageRow } from './types';
import { aggregateSavings } from './analytics-aggregator';

export function buildSavingsAnalytics(
  promotionUsages: PromotionUsageRow[],
  couponUsages: CouponUsageRow[]
): SavingsAnalyticsSummary {
  return aggregateSavings(promotionUsages, couponUsages);
}
