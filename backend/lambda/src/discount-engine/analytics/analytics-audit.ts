import type { AnalyticsAudit, AnalyticsFilters, AnalyticsDomainFilter } from './types';
import { ANALYTICS_VERSION } from './analytics-configuration';
import { getAnalyticsMode } from './analytics-mode';
import { SETTLEMENT_VERSION } from '../settlement/settlement-preview';

export function buildAnalyticsAudit(params: {
  filters: AnalyticsFilters;
  domain: AnalyticsDomainFilter;
  promotionIds: string[];
  couponIds: string[];
  policyFingerprint: string;
  startedMs: number;
}): AnalyticsAudit {
  return {
    analyticsVersion: ANALYTICS_VERSION,
    policyFingerprint: params.policyFingerprint,
    settlementVersion: SETTLEMENT_VERSION,
    promotionIds: params.promotionIds,
    couponIds: params.couponIds,
    generatedAt: new Date().toISOString(),
    domain: params.domain,
    filters: params.filters,
    mode: getAnalyticsMode(),
    executionTimeMs: Date.now() - params.startedMs,
  };
}
