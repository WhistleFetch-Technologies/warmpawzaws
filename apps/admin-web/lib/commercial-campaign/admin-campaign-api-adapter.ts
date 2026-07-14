import {
  createCampaignFromTemplate,
  createCommercialCampaign,
  fetchCampaignAnalytics,
  fetchCampaignMode,
  fetchCampaignRegistry,
  fetchCampaignSettlementAttribution,
  getCommercialCampaign,
  listCommercialCampaigns,
  orchestrateCommercialCampaign,
  transitionCampaignLifecycle,
} from '@/lib/commercial-campaign/commercial-campaign-api';
import { apiClient } from '@/lib/api-client';
import type {
  CampaignApiClient,
  CampaignHealthReport,
  CampaignPublishValidation,
  CampaignSurface,
  CommercialCampaignRecord,
} from '@warmpawz/commercial-campaign-ui';

const BASE = '/admin/commercial-campaigns';

export function createAdminCampaignApi(): CampaignApiClient {
  return {
    fetchMode: async () => {
      const m = await fetchCampaignMode();
      return { mode: m.mode, enabled: m.enabled, authoritative: m.authoritative };
    },
    fetchRegistry: (surface?: CampaignSurface) => fetchCampaignRegistry(surface),
    listCampaigns: (filters) => listCommercialCampaigns(filters),
    getCampaign: getCommercialCampaign,
    fetchAnalytics: fetchCampaignAnalytics,
    fetchSettlement: fetchCampaignSettlementAttribution,
    fetchHealth: async (id) => {
      try {
        const res = await apiClient.get<{ health: CampaignHealthReport }>(`${BASE}/${id}/health`);
        return res.health ?? null;
      } catch {
        return null;
      }
    },
    validatePublish: async (id) => {
      try {
        const res = await apiClient.get<{ validation: CampaignPublishValidation }>(
          `${BASE}/${id}/validate`
        );
        return res.validation ?? null;
      } catch {
        return null;
      }
    },
    transitionLifecycle: transitionCampaignLifecycle,
    duplicateCampaign: async (id, opts) => {
      const res = await apiClient.post<{ campaign: CommercialCampaignRecord }>(
        `${BASE}/${id}/duplicate`,
        opts ?? {}
      );
      return res.campaign;
    },
    createCampaign: createCommercialCampaign,
    createFromTemplate: createCampaignFromTemplate,
    orchestrate: orchestrateCommercialCampaign,
  };
}
