'use client';

import { apiClient } from '@/lib/api-client';
import {
  COMMERCE_SWITCH_ENDPOINTS,
  COMMERCE_SWITCH_SYNC,
  DEFAULT_COMMERCE_MODEL_ID,
  type CommerceModelDescriptor,
  type CommerceModelId,
  type CommerceConfiguration,
  type PublicCommerceConfiguration,
} from '@warmpawz/commerce-switch-contracts';

type CacheState = {
  config: PublicCommerceConfiguration;
  fetchedAt: number;
};

const CACHE_TTL_MS = 300_000;
let cache: CacheState | null = null;
let inflight: Promise<PublicCommerceConfiguration | null> | null = null;

function isFresh(entry: CacheState | null): entry is CacheState {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

export function clearCommerceSwitchCache(): void {
  cache = null;
  inflight = null;
}

export async function fetchCommerceSwitchConfiguration(): Promise<PublicCommerceConfiguration> {
  if (isFresh(cache)) return cache.config;

  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await apiClient.get<PublicCommerceConfiguration & { success?: boolean }>(
          COMMERCE_SWITCH_ENDPOINTS.CONFIG
        );
        const config: PublicCommerceConfiguration = {
          activeModelId: res.activeModelId ?? DEFAULT_COMMERCE_MODEL_ID,
          version: res.version ?? 1,
          schemaVersion: res.schemaVersion ?? '1.0',
          availableModels: res.availableModels ?? [DEFAULT_COMMERCE_MODEL_ID],
          updatedAt: res.updatedAt ?? new Date(0).toISOString(),
          degraded: res.degraded,
        };
        cache = { config, fetchedAt: Date.now() };
        return config;
      } catch (err) {
        console.warn('[CommerceSwitch] admin fetch failed', err);
        const fallback: PublicCommerceConfiguration = {
          activeModelId: DEFAULT_COMMERCE_MODEL_ID,
          version: cache?.config.version ?? 1,
          schemaVersion: '1.0',
          availableModels: [DEFAULT_COMMERCE_MODEL_ID],
          updatedAt: new Date().toISOString(),
          degraded: true,
        };
        return fallback;
      } finally {
        inflight = null;
      }
    })();
  }

  const result = await inflight;
  return result ?? cache?.config ?? {
    activeModelId: DEFAULT_COMMERCE_MODEL_ID,
    version: 1,
    schemaVersion: '1.0',
    availableModels: [DEFAULT_COMMERCE_MODEL_ID],
    updatedAt: new Date(0).toISOString(),
  };
}

export async function fetchAdminCommerceConfiguration(): Promise<CommerceConfiguration> {
  const res = await apiClient.get<{ success: boolean; configuration: CommerceConfiguration }>(
    COMMERCE_SWITCH_ENDPOINTS.ADMIN_CONFIGURATION
  );
  return res.configuration;
}

export async function fetchAdminCommerceModels(): Promise<CommerceModelDescriptor[]> {
  const res = await apiClient.get<{ success: boolean; models: CommerceModelDescriptor[] }>(
    COMMERCE_SWITCH_ENDPOINTS.ADMIN_MODELS
  );
  return res.models ?? [];
}

export async function saveAdminCommerceConfiguration(input: {
  activeModelId: CommerceModelId;
  availableModels: CommerceModelId[];
  expectedVersion?: number;
}): Promise<CommerceConfiguration> {
  const res = await apiClient.put<{ success: boolean; configuration: CommerceConfiguration }>(
    COMMERCE_SWITCH_ENDPOINTS.ADMIN_CONFIGURATION,
    input
  );
  clearCommerceSwitchCache();
  try {
    await apiClient.post('/admin/governance/propagate', { type: 'platform_settings_change' });
  } catch (err) {
    console.warn('[CommerceSwitch] governance propagate failed (config saved):', err);
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(COMMERCE_SWITCH_SYNC.BROADCAST_CHANNEL);
      channel.postMessage({
        type: COMMERCE_SWITCH_SYNC.DATA_TYPE,
        configurationVersion: res.configuration.version,
        activeModelId: res.configuration.activeModelId,
        updatedAt: res.configuration.updatedAt,
      });
      channel.close();
    } catch (err) {
      console.warn('[CommerceSwitch] same-browser broadcast failed (non-fatal):', err);
    }
  }

  return res.configuration;
}
