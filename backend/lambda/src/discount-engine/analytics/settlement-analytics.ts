import type { SettlementAnalyticsSummary, SettlementAnalyticsInput } from './types';
import type { SettlementPreview } from '../settlement/types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aggregates precomputed settlement previews — never recalculates settlement math.
 */
export function buildSettlementAnalytics(input: SettlementAnalyticsInput): SettlementAnalyticsSummary {
  const previews = input.previews ?? [];

  let vendorContribution = 0;
  let platformContribution = 0;
  let sharedContribution = 0;
  let settlementTotals = 0;

  const fundingBreakdown: SettlementAnalyticsSummary['fundingBreakdown'] = [];
  const trendMap = new Map<string, { vendor: number; platform: number; shared: number }>();

  for (const preview of previews) {
    vendorContribution += preview.vendorCost ?? preview.vendorDiscountShare ?? 0;
    platformContribution += preview.platformCost ?? preview.platformDiscountShare ?? 0;
    sharedContribution += preview.sharedDiscountShare?.total ?? 0;
    settlementTotals += preview.netSettlement ?? preview.vendorReceivable ?? 0;

    for (const line of preview.appliedFunding ?? []) {
      fundingBreakdown.push({
        discountId: line.discountId,
        name: line.name,
        vendorShare: line.vendorShare,
        platformShare: line.platformShare,
      });
    }

    const month = (preview.timestamp ?? new Date().toISOString()).slice(0, 7);
    const trend = trendMap.get(month) ?? { vendor: 0, platform: 0, shared: 0 };
    trend.vendor += preview.vendorDiscountShare ?? 0;
    trend.platform += preview.platformDiscountShare ?? 0;
    trend.shared += preview.sharedDiscountShare?.total ?? 0;
    trendMap.set(month, trend);
  }

  const fundingTrends = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, t]) => ({
      label,
      vendor: round2(t.vendor),
      platform: round2(t.platform),
      shared: round2(t.shared),
    }));

  return {
    vendorContribution: round2(vendorContribution),
    platformContribution: round2(platformContribution),
    sharedContribution: round2(sharedContribution),
    settlementTotals: round2(settlementTotals),
    fundingTrends,
    fundingBreakdown,
    previewCount: previews.length,
  };
}

/** Accept resolver-facing previews without transformation beyond field mapping. */
export function settlementPreviewFromAudit(preview: SettlementPreview): SettlementPreview {
  return preview;
}
