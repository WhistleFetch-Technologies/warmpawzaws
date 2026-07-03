import { apiClient } from '@/lib/api-client';
import type {
  AnalyticsFilters,
  AnalyticsReport,
  DiscountAnalyticsMode,
  PromotionStatsLegacy,
} from './types';

function buildQuery(filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  if (filters.domain) params.set('domain', filters.domain);
  if (filters.vendorId) params.set('vendorId', filters.vendorId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.limit) params.set('limit', String(filters.limit));
  const q = params.toString();
  return q ? `?${q}` : '';
}

export async function fetchDiscountAnalyticsMode(): Promise<DiscountAnalyticsMode> {
  const res = await apiClient.get<{
    success: boolean;
    mode: string;
    enabled: boolean;
    publiclyExposed: boolean;
  }>('/admin/analytics/discount-engine/mode');
  return {
    mode: res.mode,
    enabled: res.enabled,
    publiclyExposed: res.publiclyExposed,
  };
}

export async function fetchDiscountAnalyticsOverview(
  filters: AnalyticsFilters
): Promise<AnalyticsReport | null> {
  try {
    const res = await apiClient.get<{ success: boolean; report: AnalyticsReport }>(
      `/admin/analytics/discount-engine/overview${buildQuery(filters)}`
    );
    return res.report ?? null;
  } catch {
    return null;
  }
}

export async function fetchPromotionStats(): Promise<PromotionStatsLegacy | null> {
  try {
    const res = await apiClient.get<{ success: boolean; stats: PromotionStatsLegacy }>(
      '/admin/promotions/stats'
    );
    return res.stats ?? null;
  } catch {
    return null;
  }
}

export async function fetchCampaignAnalyticsForMarketing(
  campaignId?: string
): Promise<unknown | null> {
  if (!campaignId) return null;
  try {
    return await apiClient.get(`/admin/commercial-campaigns/${campaignId}/analytics`);
  } catch {
    return null;
  }
}
