import { apiClient } from '@/lib/api-client';
import type {
  CampaignModeResponse,
  CampaignOrchestrationResult,
  CampaignRegistryResponse,
  CommercialCampaignRecord,
  CreateCampaignInput,
  OrchestrateCampaignInput,
  CampaignLifecycleStatus,
} from './types';

const BASE = '/admin/commercial-campaigns';

export async function fetchCampaignMode(): Promise<CampaignModeResponse & { success?: boolean }> {
  return apiClient.get(`${BASE}/mode`);
}

export async function fetchCampaignRegistry(surface?: 'marketing' | 'ecommerce'): Promise<CampaignRegistryResponse> {
  const params = new URLSearchParams();
  if (surface) params.set('surface', surface);
  const q = params.toString() ? `?${params}` : '';
  const res = await apiClient.get<{ templates: CampaignRegistryResponse['templates']; campaignTypes: CampaignRegistryResponse['campaignTypes'] }>(`${BASE}/registry${q}`);
  return { templates: res.templates ?? [], campaignTypes: res.campaignTypes ?? {} };
}

export async function listCommercialCampaigns(filters?: {
  status?: string;
  vendorId?: string;
  discountDomain?: 'SERVICE' | 'ECOMMERCE';
  surface?: 'marketing' | 'ecommerce';
}): Promise<CommercialCampaignRecord[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.vendorId) params.set('vendorId', filters.vendorId);
  if (filters?.discountDomain) params.set('discount_domain', filters.discountDomain);
  if (filters?.surface) params.set('surface', filters.surface);
  const q = params.toString() ? `?${params}` : '';
  const res = await apiClient.get<{ campaigns: CommercialCampaignRecord[] }>(`${BASE}${q}`);
  return res.campaigns ?? [];
}

export async function getCommercialCampaign(id: string): Promise<CommercialCampaignRecord | null> {
  try {
    const res = await apiClient.get<{ campaign: CommercialCampaignRecord }>(`${BASE}/${id}`);
    return res.campaign ?? null;
  } catch {
    return null;
  }
}

export async function createCommercialCampaign(
  input: CreateCampaignInput
): Promise<CommercialCampaignRecord> {
  const res = await apiClient.post<{ campaign: CommercialCampaignRecord }>(BASE, input);
  return res.campaign;
}

export async function createCampaignFromTemplate(
  templateId: string,
  overrides: Partial<CreateCampaignInput> = {}
): Promise<CommercialCampaignRecord> {
  const res = await apiClient.post<{ campaign: CommercialCampaignRecord }>(
    `${BASE}/from-template/${templateId}`,
    overrides
  );
  return res.campaign;
}

export async function orchestrateCommercialCampaign(
  id: string,
  input: OrchestrateCampaignInput = {}
): Promise<CampaignOrchestrationResult> {
  return apiClient.post(`${BASE}/${id}/orchestrate`, input);
}

export async function transitionCampaignLifecycle(
  id: string,
  status: CampaignLifecycleStatus
): Promise<CommercialCampaignRecord> {
  const res = await apiClient.post<{ campaign: CommercialCampaignRecord }>(
    `${BASE}/${id}/lifecycle/${status}`
  );
  return res.campaign;
}

export async function fetchCampaignAnalytics(id: string): Promise<unknown> {
  const res = await apiClient.get<{ analytics: unknown }>(`${BASE}/${id}/analytics`);
  return res.analytics;
}

export async function fetchCampaignSettlementAttribution(id: string): Promise<unknown> {
  const res = await apiClient.get<{ attribution: unknown }>(`${BASE}/${id}/settlement-attribution`);
  return res.attribution;
}

export async function attachCampaignOffers(
  id: string,
  body: { promotionIds?: string[]; couponIds?: string[] }
): Promise<{ campaign: CommercialCampaignRecord; links: CampaignOrchestrationResult['links'] }> {
  return apiClient.post(`${BASE}/${id}/links`, body);
}

export async function detachCampaignOffer(
  id: string,
  opts: { promotionId?: string; couponId?: string }
): Promise<void> {
  const params = new URLSearchParams();
  if (opts.promotionId) params.set('promotionId', opts.promotionId);
  if (opts.couponId) params.set('couponId', opts.couponId);
  const q = params.toString() ? `?${params}` : '';
  await apiClient.delete(`${BASE}/${id}/links${q}`);
}

export async function listNotificationCampaigns(): Promise<Array<{ id: string; name?: string; title?: string; status?: string }>> {
  try {
    const res = await apiClient.get<{ campaigns?: unknown[]; data?: unknown[] }>(
      '/admin/notifications/campaigns'
    );
    const rows = (res.campaigns ?? res.data ?? res) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name ?? r.title ?? r.id),
      status: r.status != null ? String(r.status) : undefined,
    }));
  } catch {
    return [];
  }
}
