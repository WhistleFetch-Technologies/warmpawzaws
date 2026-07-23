'use client';

/**
 * Read-only Commerce Switch client for vendor-web (PR-7).
 * Fetches platform config once at startup; no booking, payment, or routing logic.
 */
import { apiClient } from '@/lib/api-client';
import {
  COMMERCE_SWITCH_ENDPOINTS,
  DEFAULT_COMMERCE_MODEL_ID,
  type CommerceModelId,
  type PublicCommerceConfiguration,
} from '@warmpawz/commerce-switch-contracts';

type CacheState = {
  config: PublicCommerceConfiguration;
  fetchedAt: number;
};

const CACHE_TTL_MS = 300_000;

let cache: CacheState | null = null;
let inflight: Promise<PublicCommerceConfiguration> | null = null;
let startupPrefetchStarted = false;

function isFresh(entry: CacheState | null): entry is CacheState {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function normalizeConfig(
  raw: Partial<PublicCommerceConfiguration> & { success?: boolean }
): PublicCommerceConfiguration {
  return {
    activeModelId: raw.activeModelId ?? DEFAULT_COMMERCE_MODEL_ID,
    version: raw.version ?? 1,
    schemaVersion: raw.schemaVersion ?? '1.0',
    availableModels: raw.availableModels ?? [DEFAULT_COMMERCE_MODEL_ID],
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
    degraded: raw.degraded,
  };
}

function marketplaceFallback(degraded: boolean): PublicCommerceConfiguration {
  return {
    activeModelId: DEFAULT_COMMERCE_MODEL_ID,
    version: cache?.config.version ?? 1,
    schemaVersion: '1.0',
    availableModels: [DEFAULT_COMMERCE_MODEL_ID],
    updatedAt: new Date().toISOString(),
    degraded,
  };
}

function readCachedConfig(): PublicCommerceConfiguration {
  if (isFresh(cache)) return cache.config;
  return marketplaceFallback(false);
}

export function clearCommerceSwitchCache(): void {
  cache = null;
  inflight = null;
  startupPrefetchStarted = false;
}

export function hasCommerceSwitchConfiguration(): boolean {
  return isFresh(cache);
}

async function fetchCommerceSwitchConfigurationOnce(): Promise<PublicCommerceConfiguration> {
  try {
    const res = await apiClient.get<PublicCommerceConfiguration & { success?: boolean }>(
      COMMERCE_SWITCH_ENDPOINTS.CONFIG
    );
    const config = normalizeConfig(res);
    cache = { config, fetchedAt: Date.now() };
    if (process.env.NODE_ENV === 'development') {
      console.log('[CommerceSwitch] loaded', config.activeModelId, 'v', config.version);
    }
    return config;
  } catch (err) {
    console.warn('[CommerceSwitch] config fetch failed, using marketplace default', err);
    const fallback = marketplaceFallback(true);
    cache = { config: fallback, fetchedAt: Date.now() };
    return fallback;
  }
}

/**
 * Fetch GET /config/commerce-switch with in-memory cache and in-flight deduplication.
 */
export async function prefetchCommerceSwitchConfiguration(): Promise<PublicCommerceConfiguration> {
  if (isFresh(cache)) return cache.config;

  if (!inflight) {
    inflight = fetchCommerceSwitchConfigurationOnce().finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

/**
 * Invoke once from VendorApp startup. Never throws; does not block render.
 */
export function prefetchCommerceSwitchConfigurationOnStartup(): void {
  if (startupPrefetchStarted) return;
  startupPrefetchStarted = true;
  void prefetchCommerceSwitchConfiguration().catch(() => {
    // Errors are handled inside fetch; startup must never fail.
  });
}

export async function getCommerceSwitchConfiguration(): Promise<PublicCommerceConfiguration> {
  return prefetchCommerceSwitchConfiguration();
}

/** Sync read from cache; defaults to marketplace before prefetch completes. */
export function getActiveCommerceModel(): CommerceModelId {
  return readCachedConfig().activeModelId;
}

export async function getActiveCommerceModelAsync(): Promise<CommerceModelId> {
  const config = await prefetchCommerceSwitchConfiguration();
  return config.activeModelId;
}

export function isMarketplace(): boolean {
  return getActiveCommerceModel() === 'marketplace';
}

export function isWarmpawzPay(): boolean {
  return getActiveCommerceModel() === 'warmpawz_pay';
}

export function getAvailableModels(): CommerceModelId[] {
  return [...readCachedConfig().availableModels];
}

export async function getAvailableModelsAsync(): Promise<CommerceModelId[]> {
  const config = await prefetchCommerceSwitchConfiguration();
  return [...config.availableModels];
}

export function isCommerceSwitchDegraded(): boolean {
  return readCachedConfig().degraded === true;
}
