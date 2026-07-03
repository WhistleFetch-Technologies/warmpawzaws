import type { PromotionAnalyticsSummary, PromotionUsageRow } from './types';
import { aggregatePromotionMetrics, promotionTotals } from './analytics-aggregator';
import { DEFAULT_ANALYTICS_LIMIT } from './analytics-configuration';

export function buildPromotionAnalytics(
  usages: PromotionUsageRow[],
  limit = DEFAULT_ANALYTICS_LIMIT
): PromotionAnalyticsSummary {
  const rows = aggregatePromotionMetrics(usages);
  return {
    rows: rows.slice(0, limit),
    topPromotions: rows.slice(0, Math.min(10, limit)),
    totals: promotionTotals(rows),
  };
}
