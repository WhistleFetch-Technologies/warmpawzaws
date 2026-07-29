'use client';

/**
 * Read-only Commerce Switch client for customer-web.
 * Fetches platform config at startup; supports reactive refresh when version changes.
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
let syncInflight: Promise<PublicCommerceConfiguration> | null = null;
let startupPrefetchStarted = false;
let syncGeneration = 0;
let pendingMinVersion = 0;

type CommerceConfigListener = (config: PublicCommerceConfiguration) => void;
const listeners = new Set<CommerceConfigListener>();

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

function notifyListeners(config: PublicCommerceConfiguration): void {
  for (const listener of listeners) {
    try {
      listener(config);
    } catch (err) {
      console.warn('[CommerceSwitch] listener error', err);
    }
  }
}

function storeConfig(config: PublicCommerceConfiguration): PublicCommerceConfiguration {
  cache = { config, fetchedAt: Date.now() };
  notifyListeners(config);
  return config;
}

export function subscribeCommerceSwitchConfiguration(
  listener: CommerceConfigListener
): () => void {
  listeners.add(listener);
  if (cache) listener(cache.config);
  return () => {
    listeners.delete(listener);
  };
}

export function clearCommerceSwitchCache(): void {
  cache = null;
  inflight = null;
  syncInflight = null;
  startupPrefetchStarted = false;
  syncGeneration = 0;
  pendingMinVersion = 0;
}

export function hasCommerceSwitchConfiguration(): boolean {
  return isFresh(cache);
}

export function getCommerceSwitchConfigurationVersion(): number {
  return readCachedConfig().version;
}

async function fetchCommerceSwitchConfigurationOnce(): Promise<PublicCommerceConfiguration> {
  try {
    const res = await apiClient.get<PublicCommerceConfiguration & { success?: boolean }>(
      COMMERCE_SWITCH_ENDPOINTS.CONFIG
    );
    const config = normalizeConfig(res);
    if (process.env.NODE_ENV === 'development') {
      console.log('[CommerceSwitch] loaded', config.activeModelId, 'v', config.version);
    }
    return storeConfig(config);
  } catch (err) {
    console.warn('[CommerceSwitch] config fetch failed, using marketplace default', err);
    const fallback = marketplaceFallback(true);
    return storeConfig(fallback);
  }
}

/**
 * Fetch GET /config/commerce-switch with in-memory cache and in-flight deduplication.
 */
export async function prefetchCommerceSwitchConfiguration(
  force = false
): Promise<PublicCommerceConfiguration> {
  if (!force && isFresh(cache)) return cache.config;

  if (!inflight) {
    inflight = fetchCommerceSwitchConfigurationOnce().finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

export async function refreshCommerceSwitchConfiguration(options?: {
  force?: boolean;
}): Promise<PublicCommerceConfiguration> {
  if (options?.force) {
    cache = null;
    inflight = null;
  }
  return prefetchCommerceSwitchConfiguration(Boolean(options?.force));
}

/**
 * Race-safe sync used by event-driven Commerce Switch updates.
 * Dedupes concurrent calls and rejects responses older than expectedMinVersion.
 */
export async function syncCommerceSwitchConfiguration(options?: {
  expectedMinVersion?: number;
  force?: boolean;
}): Promise<PublicCommerceConfiguration> {
  const minVersion = options?.expectedMinVersion ?? 0;
  if (minVersion > pendingMinVersion) {
    pendingMinVersion = minVersion;
  }

  const localVersion = readCachedConfig().version;
  if (
    !options?.force &&
    minVersion > 0 &&
    localVersion >= minVersion &&
    isFresh(cache)
  ) {
    return cache!.config;
  }

  if (syncInflight) {
    return syncInflight;
  }

  const generation = ++syncGeneration;
  syncInflight = refreshCommerceSwitchConfiguration({ force: true })
    .then((config) => {
      if (generation < syncGeneration && config.version < pendingMinVersion) {
        return config;
      }
      if (config.version >= pendingMinVersion) {
        pendingMinVersion = config.version;
      }
      return config;
    })
    .finally(() => {
      syncInflight = null;
    });

  return syncInflight;
}

/**
 * Invoke once from CustomerApp startup. Never throws; does not block render.
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
