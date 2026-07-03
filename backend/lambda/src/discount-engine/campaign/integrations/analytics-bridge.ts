import {
  getAnalyticsEngine,
  type AnalyticsFilters,
  isAnalyticsEnabled,
} from '../../analytics';
import type { CommercialCampaignRecord } from '../types';
import type { CampaignPromotionLink } from '../types';

export interface CampaignAnalyticsBridgeResult {
  available: boolean;
  campaignId: string;
  promotionIds: string[];
  couponIds: string[];
  report?: Record<string, unknown> | null;
}

/**
 * Filters Phase 9 analytics by campaign-linked promotion/coupon IDs.
 * Does not modify Analytics Engine internals.
 */
export async function fetchCampaignAnalytics(
  campaign: CommercialCampaignRecord,
  links: CampaignPromotionLink[],
  filters: AnalyticsFilters = {}
): Promise<CampaignAnalyticsBridgeResult> {
  const promotionIds = links.filter((l) => l.promotionId).map((l) => l.promotionId!);
  const couponIds = links.filter((l) => l.couponId).map((l) => l.couponId!);

  if (!isAnalyticsEnabled()) {
    return {
      available: false,
      campaignId: campaign.id,
      promotionIds,
      couponIds,
      report: null,
    };
  }

  const engine = getAnalyticsEngine();
  const report = await engine.generateReport(filters);

  if (!report) {
    return { available: false, campaignId: campaign.id, promotionIds, couponIds, report: null };
  }

  const filteredPromotions = report.promotions.rows.filter((p) =>
    promotionIds.includes(p.promotionId)
  );
  const filteredCoupons = report.coupons.rows.filter((c) => couponIds.includes(c.couponId));

  return {
    available: true,
    campaignId: campaign.id,
    promotionIds,
    couponIds,
    report: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      funding: campaign.funding,
      promotions: filteredPromotions,
      coupons: filteredCoupons,
      savings: report.savings,
      settlement: report.settlement,
      mode: report.audit.mode,
    },
  };
}
