import type { CampaignAnalyticsSummary, PromotionUsageRow } from './types';
import { aggregatePromotionMetrics } from './analytics-aggregator';

/** Campaign analytics reuses promotion usage rows (platform spotlight / seasonal campaigns). */
export function buildCampaignAnalytics(usages: PromotionUsageRow[]): CampaignAnalyticsSummary {
  const promos = aggregatePromotionMetrics(usages);
  return {
    campaigns: promos.slice(0, 20).map((p) => ({
      id: p.promotionId,
      name: p.name,
      usageCount: p.usageCount,
      savings: p.savingsGenerated,
      conversionRate: p.conversionRate,
    })),
  };
}
