import type { DiscountDomain } from '../enums/discount-domain';
import type { SettlementPreview } from '../settlement/types';
import type { AnalyticsMode } from './analytics-mode';

/** Domain filter for analytics queries — maps to promotion_usages / booking domains. */
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
  customerId?: string;
  from?: string;
  to?: string;
  promotionIds?: string[];
  couponIds?: string[];
  limit?: number;
}

export interface AnalyticsAudit {
  analyticsVersion: string;
  policyFingerprint: string;
  settlementVersion: string;
  promotionIds: string[];
  couponIds: string[];
  generatedAt: string;
  domain: AnalyticsDomainFilter;
  filters: AnalyticsFilters;
  mode: AnalyticsMode;
  executionTimeMs: number;
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
  expiresAt: string | null;
  /** Live window from promo tables (enriched after aggregation). */
  startDate?: string | null;
  /** True when promo is currently live (active + published + date window). */
  isActive?: boolean;
  published?: boolean;
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
  topOffers: Array<{ id: string; name: string; savings: number }>;
}

export interface SavingsAnalyticsSummary {
  totalSaved: number;
  promotionSavings: number;
  couponSavings: number;
  vendorSavings: number;
  platformSavings: number;
  byCategory: Array<{ category: string; amount: number }>;
  byMonth: Array<{ month: string; amount: number }>;
  topOffersUsed: Array<{ id: string; name: string; amount: number; kind: 'promotion' | 'coupon' }>;
}

export interface SettlementAnalyticsSummary {
  vendorContribution: number;
  platformContribution: number;
  sharedContribution: number;
  settlementTotals: number;
  fundingTrends: Array<{ label: string; vendor: number; platform: number; shared: number }>;
  fundingBreakdown: Array<{ discountId: string; name: string; vendorShare: number; platformShare: number }>;
  previewCount: number;
}

export interface CampaignAnalyticsSummary {
  campaigns: Array<{
    id: string;
    name: string;
    usageCount: number;
    savings: number;
    conversionRate: number | null;
  }>;
}

export interface PromotionAnalyticsSummary {
  rows: PromotionMetricRow[];
  topPromotions: PromotionMetricRow[];
  totals: {
    usageCount: number;
    savingsGenerated: number;
    averageDiscount: number;
  };
}

export interface CouponAnalyticsSummary {
  rows: CouponMetricRow[];
  mostUsed: CouponMetricRow[];
  leastUsed: CouponMetricRow[];
  totals: {
    uses: number;
    savings: number;
    averageOrderValue: number;
  };
}

export interface VendorAnalyticsSummary {
  rows: VendorAnalyticsRow[];
  topVendors: VendorAnalyticsRow[];
}

export interface AnalyticsReport {
  audit: AnalyticsAudit;
  promotions: PromotionAnalyticsSummary;
  coupons: CouponAnalyticsSummary;
  vendors: VendorAnalyticsSummary;
  savings: SavingsAnalyticsSummary;
  settlement: SettlementAnalyticsSummary | null;
  campaigns: CampaignAnalyticsSummary;
}

/** Raw usage row from read repository — no recalculation of discounts. */
export interface PromotionUsageRow {
  id: string;
  promotionId: string;
  promotionType: string;
  bookingId: string | null;
  orderId: string | null;
  customerId: string | null;
  discountAmount: number;
  originalAmount: number | null;
  finalAmount: number | null;
  createdAt: string;
  promotionName?: string;
  vendorId?: string | null;
}

export interface CouponUsageRow {
  id: string;
  couponId: string;
  code: string;
  customerId: string | null;
  bookingId: string | null;
  orderId: string | null;
  usedAt: string;
  maxUses: number | null;
  isActive: boolean;
  endDate: string | null;
  discountAmount?: number;
}

export interface AnalyticsDataSnapshot {
  promotionUsages: PromotionUsageRow[];
  couponUsages: CouponUsageRow[];
  activePromotionCount: number;
}

export interface SettlementAnalyticsInput {
  /** Precomputed settlement previews — engine aggregates only, never recalculates. */
  previews: SettlementPreview[];
}

export type DomainAdapterContext = {
  filters: AnalyticsFilters;
  snapshot: AnalyticsDataSnapshot;
};

export interface DomainAnalyticsAdapter {
  readonly domain: AnalyticsDomainFilter;
  filterPromotionUsages(rows: PromotionUsageRow[]): PromotionUsageRow[];
  filterCouponUsages(rows: CouponUsageRow[]): CouponUsageRow[];
}
