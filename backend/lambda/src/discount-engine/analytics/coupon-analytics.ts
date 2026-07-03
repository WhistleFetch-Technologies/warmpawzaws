import type { CouponAnalyticsSummary, CouponUsageRow } from './types';
import { aggregateCouponMetrics, couponTotals } from './analytics-aggregator';
import { DEFAULT_ANALYTICS_LIMIT } from './analytics-configuration';

export function buildCouponAnalytics(
  usages: CouponUsageRow[],
  limit = DEFAULT_ANALYTICS_LIMIT
): CouponAnalyticsSummary {
  const rows = aggregateCouponMetrics(usages);
  const active = rows.filter((r) => !r.expired && !r.disabled);
  return {
    rows: rows.slice(0, limit),
    mostUsed: rows.slice(0, Math.min(10, limit)),
    leastUsed: [...active].sort((a, b) => a.uses - b.uses).slice(0, Math.min(10, limit)),
    totals: couponTotals(rows),
  };
}
