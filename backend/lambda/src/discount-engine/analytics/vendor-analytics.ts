import type { VendorAnalyticsSummary, PromotionUsageRow } from './types';
import { aggregateVendorMetrics } from './analytics-aggregator';
import { DEFAULT_ANALYTICS_LIMIT } from './analytics-configuration';

export function buildVendorAnalytics(
  usages: PromotionUsageRow[],
  limit = DEFAULT_ANALYTICS_LIMIT
): VendorAnalyticsSummary {
  const rows = aggregateVendorMetrics(usages);
  return {
    rows: rows.slice(0, limit),
    topVendors: rows.slice(0, Math.min(10, limit)),
  };
}
