import {
  getAnalyticsEngine,
  type AnalyticsFilters,
  isAnalyticsEnabled,
} from '../../analytics';
import type { CommercialCampaignRecord, CampaignPromotionLink } from '../types';

export interface CampaignAnalyticsBridgeResult {
  available: boolean;
  campaignId: string;
  discountDomain: string;
  surface: string;
  promotionIds: string[];
  couponIds: string[];
  kpis: {
    redemptions: number;
    discountSpend: number;
    platformSpend: number;
    vendorSpend: number;
    orders: number;
    conversions: number;
    revenue: number | null;
    roi: number | null;
    budgetCap: number | null;
    budgetSpent: number;
    budgetRemaining: number | null;
    status: string;
  };
  topOffers: Array<Record<string, unknown>>;
  report?: Record<string, unknown> | null;
}

function fundingShares(campaign: CommercialCampaignRecord): {
  platformPct: number;
  vendorPct: number;
} {
  const type = String(campaign.funding.type).toUpperCase();
  if (type === 'PLATFORM') return { platformPct: 100, vendorPct: 0 };
  if (type === 'VENDOR') return { platformPct: 0, vendorPct: 100 };
  const split = campaign.funding.split;
  if (split) {
    return {
      platformPct: Number(split.platformPercent ?? 50),
      vendorPct: Number(split.vendorPercent ?? 50),
    };
  }
  return { platformPct: 50, vendorPct: 50 };
}

/**
 * Builds first-class campaign KPIs from linked offers via Analytics Engine.
 * Does not proxy "top promotions as campaigns".
 */
export async function fetchCampaignAnalytics(
  campaign: CommercialCampaignRecord,
  links: CampaignPromotionLink[],
  filters: AnalyticsFilters = {}
): Promise<CampaignAnalyticsBridgeResult> {
  const promotionIds = links.filter((l) => l.promotionId).map((l) => l.promotionId!);
  const couponIds = links.filter((l) => l.couponId).map((l) => l.couponId!);
  const budgetCap = campaign.budgetCap ?? null;
  const budgetSpent = Number(campaign.budgetSpent ?? 0);
  const budgetRemaining =
    budgetCap != null && Number.isFinite(budgetCap)
      ? Math.max(0, Number(budgetCap) - budgetSpent)
      : null;

  const emptyKpis = {
    redemptions: 0,
    discountSpend: 0,
    platformSpend: 0,
    vendorSpend: 0,
    orders: 0,
    conversions: 0,
    revenue: null as number | null,
    roi: null as number | null,
    budgetCap,
    budgetSpent,
    budgetRemaining,
    status: campaign.status,
  };

  if (!isAnalyticsEnabled()) {
    return {
      available: false,
      campaignId: campaign.id,
      discountDomain: campaign.discountDomain,
      surface: campaign.surface,
      promotionIds,
      couponIds,
      kpis: emptyKpis,
      topOffers: [],
      report: null,
    };
  }

  const engine = getAnalyticsEngine();
  const report = await engine.generateReport(filters);

  if (!report) {
    return {
      available: false,
      campaignId: campaign.id,
      discountDomain: campaign.discountDomain,
      surface: campaign.surface,
      promotionIds,
      couponIds,
      kpis: emptyKpis,
      topOffers: [],
      report: null,
    };
  }

  const filteredPromotions = report.promotions.rows.filter((p) =>
    promotionIds.includes(p.promotionId)
  );
  const filteredCoupons = report.coupons.rows.filter((c) => couponIds.includes(c.couponId));

  const promoRedemptions = filteredPromotions.reduce(
    (sum, p) => sum + Number((p as { usageCount?: number; redemptions?: number }).usageCount ?? (p as { redemptions?: number }).redemptions ?? 0),
    0
  );
  const couponRedemptions = filteredCoupons.reduce(
    (sum, c) => sum + Number((c as { usageCount?: number; redemptions?: number }).usageCount ?? (c as { redemptions?: number }).redemptions ?? 0),
    0
  );
  const redemptions = promoRedemptions + couponRedemptions;

  const discountSpend =
    filteredPromotions.reduce(
      (sum, p) =>
        sum +
        Number(
          (p as { totalDiscount?: number; savings?: number }).totalDiscount ??
            (p as { savings?: number }).savings ??
            0
        ),
      0
    ) +
    filteredCoupons.reduce(
      (sum, c) =>
        sum +
        Number(
          (c as { totalDiscount?: number; savings?: number }).totalDiscount ??
            (c as { savings?: number }).savings ??
            0
        ),
      0
    );

  const { platformPct, vendorPct } = fundingShares(campaign);
  const platformSpend = (discountSpend * platformPct) / 100;
  const vendorSpend = (discountSpend * vendorPct) / 100;
  const revenueRaw = (report.savings as { grossRevenue?: number } | undefined)?.grossRevenue;
  const revenue = typeof revenueRaw === 'number' ? revenueRaw : null;
  const roi =
    platformSpend > 0 && revenue != null ? (revenue - platformSpend) / platformSpend : null;

  const topOffers = [
    ...filteredPromotions.map((p) => ({ kind: 'promotion', ...p })),
    ...filteredCoupons.map((c) => ({ kind: 'coupon', ...c })),
  ].slice(0, 10);

  const kpis = {
    redemptions,
    discountSpend,
    platformSpend,
    vendorSpend,
    orders: redemptions,
    conversions: redemptions,
    revenue,
    roi,
    budgetCap,
    budgetSpent,
    budgetRemaining,
    status: campaign.status,
  };

  return {
    available: true,
    campaignId: campaign.id,
    discountDomain: campaign.discountDomain,
    surface: campaign.surface,
    promotionIds,
    couponIds,
    kpis,
    topOffers,
    report: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      discountDomain: campaign.discountDomain,
      surface: campaign.surface,
      funding: campaign.funding,
      promotions: filteredPromotions,
      coupons: filteredCoupons,
      savings: report.savings,
      settlement: report.settlement,
      mode: report.audit.mode,
      kpis,
    },
  };
}
