'use client';

import { useMemo } from 'react';
import {
  CommercialCampaignHub,
  type CampaignApiClient,
  type CampaignSurface,
  type CommercialCampaignRecord,
} from '@warmpawz/commercial-campaign-ui';
import { apiClient } from '@/lib/api-client';

function createVendorCampaignApi(vendorId: string): CampaignApiClient {
  const base = `/vendor/${vendorId}/commercial-campaigns`;
  return {
    fetchMode: async () => {
      const res = await apiClient.get<{ mode: string; enabled: boolean; authoritative: boolean }>(
        `${base}/mode`
      );
      return {
        mode: res.mode,
        enabled: res.enabled,
        authoritative: res.authoritative,
      };
    },
    listCampaigns: async (filters) => {
      const params = new URLSearchParams();
      if (filters?.discountDomain) params.set('discount_domain', filters.discountDomain);
      if (filters?.surface) params.set('surface', filters.surface);
      if (filters?.status) params.set('status', filters.status);
      const q = params.toString() ? `?${params}` : '';
      const res = await apiClient.get<{ campaigns: CommercialCampaignRecord[] }>(`${base}${q}`);
      return res.campaigns ?? [];
    },
    getCampaign: async (id) => {
      try {
        const res = await apiClient.get<{ campaign: CommercialCampaignRecord }>(`${base}/${id}`);
        return res.campaign ?? null;
      } catch {
        return null;
      }
    },
    fetchAnalytics: async (id) => {
      const res = await apiClient.get<{ analytics: unknown }>(`${base}/${id}/analytics`);
      return res.analytics;
    },
    fetchHealth: async (id) => {
      try {
        const res = await apiClient.get<{ health: CommercialCampaignRecord['health'] }>(
          `${base}/${id}/health`
        );
        return res.health ?? null;
      } catch {
        return null;
      }
    },
    // Participants: no create/duplicate/orchestrate. Lifecycle only if owner (403 if not).
    transitionLifecycle: async (id, status) => {
      const res = await apiClient.post<{ campaign: CommercialCampaignRecord }>(
        `${base}/${id}/lifecycle/${status}`,
        {}
      );
      return res.campaign;
    },
  };
}

export function VendorCommercialCampaigns({
  vendorId,
  surface = 'marketing',
  className,
}: {
  vendorId: string;
  surface?: CampaignSurface;
  className?: string;
}) {
  const api = useMemo(() => createVendorCampaignApi(vendorId), [vendorId]);

  return (
    <CommercialCampaignHub
      surface={surface}
      readOnly
      participantVendorId={vendorId}
      api={api}
      className={className}
      title={surface === 'ecommerce' ? 'Seller Campaigns' : 'Service Campaigns'}
      subtitle={
        surface === 'ecommerce'
          ? 'Platform and owned marketplace campaigns you participate in'
          : 'Platform and owned service campaigns you participate in'
      }
    />
  );
}
