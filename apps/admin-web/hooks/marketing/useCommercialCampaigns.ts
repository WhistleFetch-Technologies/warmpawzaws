'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCampaignMode,
  fetchCampaignRegistry,
  listCommercialCampaigns,
} from '@/lib/commercial-campaign/commercial-campaign-api';
import type {
  CampaignModeResponse,
  CampaignRegistryResponse,
  CommercialCampaignRecord,
} from '@/lib/commercial-campaign/types';

export function useCommercialCampaigns() {
  const [campaigns, setCampaigns] = useState<CommercialCampaignRecord[]>([]);
  const [mode, setMode] = useState<CampaignModeResponse | null>(null);
  const [registry, setRegistry] = useState<CampaignRegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchCampaignMode();
      setMode(m);
      if (!m.enabled) {
        setError('Commercial Campaign Engine is disabled (DISCOUNT_ENGINE_V2_CAMPAIGN_MODE=OFF).');
        setCampaigns([]);
        setRegistry(null);
        return;
      }
      const [list, reg] = await Promise.all([
        listCommercialCampaigns(statusFilter ? { status: statusFilter } : undefined),
        fetchCampaignRegistry(),
      ]);
      setCampaigns(list);
      setRegistry(reg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    campaigns,
    mode,
    registry,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    reload,
  };
}
