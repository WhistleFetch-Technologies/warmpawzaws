import type {
  AnalyticsFilters,
  AnalyticsReport,
  AnalyticsDomainFilter,
  SettlementAnalyticsInput,
} from './types';
import { getAnalyticsMode, isAnalyticsEnabled } from './analytics-mode';
import { buildAnalyticsAudit } from './analytics-audit';
import {
  getDomainAdapter,
  applyAnalyticsFilters,
  applyCouponFilters,
} from './analytics-registry';
import { buildPromotionAnalytics } from './promotion-analytics';
import { buildCouponAnalytics } from './coupon-analytics';
import { buildVendorAnalytics } from './vendor-analytics';
import { buildSavingsAnalytics } from './savings-analytics';
import { buildCampaignAnalytics } from './campaign-analytics';
import { buildSettlementAnalytics } from './settlement-analytics';
import { DEFAULT_ANALYTICS_LIMIT } from './analytics-configuration';
import { getUsageReadRepository, type UsageReadRepository } from './repositories/usage-read-repository';
import { loadRuntimePolicy } from '../policy/runtime-policy-loader';
import { attachPolicyFingerprint } from '../policy/runtime-policy-fingerprint';
import { DiscountDomain } from '../enums/discount-domain';

export interface AnalyticsEngineOptions {
  repository?: UsageReadRepository;
  settlementInput?: SettlementAnalyticsInput | null;
  policyFingerprint?: string;
}

/**
 * Read-only Analytics Engine — consumes usage data and settlement previews.
 * Never modifies booking, payment, resolver, or settlement production flows.
 */
export class AnalyticsEngine {
  private readonly repository: UsageReadRepository;

  constructor(repository?: UsageReadRepository) {
    this.repository = repository ?? getUsageReadRepository();
  }

  /**
   * Returns null when analytics mode is OFF.
   * In SHADOW mode, generates report and logs summary (no public exposure via HTTP layer).
   */
  async generateReport(
    filters: AnalyticsFilters = {},
    options: AnalyticsEngineOptions = {}
  ): Promise<AnalyticsReport | null> {
    if (!isAnalyticsEnabled()) {
      return null;
    }

    const started = Date.now();
    const domain: AnalyticsDomainFilter = filters.domain ?? 'ALL';
    const limit = filters.limit ?? DEFAULT_ANALYTICS_LIMIT;

    const snapshot = await (options.repository ?? this.repository).loadSnapshot(filters);
    const adapter = getDomainAdapter(domain);

    let promotionUsages = adapter.filterPromotionUsages(snapshot.promotionUsages);
    promotionUsages = applyAnalyticsFilters(promotionUsages, filters);

    let couponUsages = adapter.filterCouponUsages(snapshot.couponUsages);
    couponUsages = applyCouponFilters(couponUsages, filters);

    if (filters.vendorId) {
      promotionUsages = promotionUsages.filter(
        (u) => !u.vendorId || u.vendorId === filters.vendorId
      );
    }

    const promotions = buildPromotionAnalytics(promotionUsages, limit);
    const coupons = buildCouponAnalytics(couponUsages, limit);
    const vendors = buildVendorAnalytics(promotionUsages, limit);
    const savings = buildSavingsAnalytics(promotionUsages, couponUsages);
    const campaigns = buildCampaignAnalytics(promotionUsages);
    const settlement = options.settlementInput
      ? buildSettlementAnalytics(options.settlementInput)
      : null;

    const policyFingerprint =
      options.policyFingerprint ??
      attachPolicyFingerprint(loadRuntimePolicy(DiscountDomain.SERVICE)).policyFingerprint;

    const audit = buildAnalyticsAudit({
      filters,
      domain,
      promotionIds: [...new Set(promotionUsages.map((u) => u.promotionId))],
      couponIds: [...new Set(couponUsages.map((u) => u.couponId))],
      policyFingerprint,
      startedMs: started,
    });

    const report: AnalyticsReport = {
      audit,
      promotions,
      coupons,
      vendors,
      savings,
      settlement,
      campaigns,
    };

    if (getAnalyticsMode() === 'SHADOW') {
      console.info('[discount-analytics:shadow]', {
        mode: 'SHADOW',
        domain,
        promotionUsages: promotionUsages.length,
        couponUsages: couponUsages.length,
        totalSaved: savings.totalSaved,
        executionTimeMs: audit.executionTimeMs,
      });
    }

    return report;
  }
}

let defaultEngine: AnalyticsEngine | null = null;

export function getAnalyticsEngine(): AnalyticsEngine {
  if (!defaultEngine) defaultEngine = new AnalyticsEngine();
  return defaultEngine;
}

export function resetAnalyticsEngineForTests(): void {
  defaultEngine = new AnalyticsEngine();
}
