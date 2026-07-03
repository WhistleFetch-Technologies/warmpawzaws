/** Mirrors backend discount-engine/analytics/types.ts — UI layer only. */

export type AnalyticsDomainFilter =
  | 'ALL'
  | 'SERVICE'
  | 'PACKAGE'
  | 'MEAL'
  | 'PHARMACY'
  | 'PRODUCT';

export interface AnalyticsFilters {
  domain?: AnalyticsDomainFilter;
  vendorId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface PromotionMetricRow {
  promotionId: string;
  name: string;
  promotionType: string;
  owner: 'platform' | 'vendor';
  usageCount: number;
  conversionRate: number | null;
  savingsGenerated: number;
  revenueInfluenced: number;
  fundingCost: number;
  settlementCost: number;
  averageDiscount: number;
  activeUsers: number;
  expiresAt?: string | null;
  roi: number | null;
}

export interface CouponMetricRow {
  couponId: string;
  code: string;
  owner: 'platform' | 'vendor';
  uses: number;
  remaining: number | null;
  savings: number;
  revenueInfluenced: number;
  averageOrderValue: number;
  conversionRate: number | null;
  expired: boolean;
  disabled: boolean;
}

export interface VendorAnalyticsRow {
  vendorId: string;
  vendorPromotions: number;
  vendorCoupons: number;
  vendorFundedDiscounts: number;
  platformFundedDiscounts: number;
  sharedFunding: number;
  totalSavings: number;
  promotionRevenue: number;
  couponRevenue: number;
  topOffers: { id: string; name: string; savings: number }[];
}

export interface SavingsAnalyticsSummary {
  totalSaved: number;
  promotionSavings: number;
  couponSavings: number;
  vendorSavings: number;
  platformSavings: number;
  byCategory: { category: string; amount: number }[];
  byMonth: { month: string; amount: number }[];
  topOffersUsed: { id: string; name: string; amount: number; kind: 'promotion' | 'coupon' }[];
}

export interface SettlementAnalyticsSummary {
  vendorContribution: number;
  platformContribution: number;
  sharedContribution: number;
  settlementTotals: number;
  previewCount: number;
  fundingTrends: { label: string; vendor: number; platform: number; shared: number }[];
  fundingBreakdown: {
    discountId: string;
    name: string;
    vendorShare: number;
    platformShare: number;
  }[];
}

export interface CampaignAnalyticsSummary {
  campaigns: { id: string; name: string; usageCount: number; savings: number; conversionRate: number | null }[];
}

export interface AnalyticsReport {
  audit?: {
    mode: string;
    policyFingerprint: string;
    generatedAt: string;
  };
  promotions: {
    rows: PromotionMetricRow[];
    topPromotions: PromotionMetricRow[];
    totals: { usageCount: number; savingsGenerated: number; averageDiscount: number };
  };
  coupons: {
    rows: CouponMetricRow[];
    mostUsed: CouponMetricRow[];
    leastUsed: CouponMetricRow[];
    totals: { uses: number; savings: number; averageOrderValue: number };
  };
  vendors: {
    rows: VendorAnalyticsRow[];
    topVendors: VendorAnalyticsRow[];
  };
  savings: SavingsAnalyticsSummary;
  settlement: SettlementAnalyticsSummary | null;
  campaigns: CampaignAnalyticsSummary;
}

export interface DiscountAnalyticsMode {
  mode: string;
  enabled: boolean;
  publiclyExposed: boolean;
}

export interface PromotionStatsLegacy {
  activePromotions: number;
  totalConversions: number;
  totalRevenue: number;
  avgDiscountGiven: number;
  engineStats?: {
    usageCount: number;
    savingsGenerated: number;
    averageDiscount: number;
  };
}

export type AnalyticsPreset = '24h' | '7d' | '30d' | '90d';
