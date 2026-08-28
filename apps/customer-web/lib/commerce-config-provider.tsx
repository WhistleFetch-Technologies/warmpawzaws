'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  COMMERCE_SWITCH_ENDPOINTS,
  COMMERCE_SWITCH_FALLBACK_POLL_MS,
  DEFAULT_COMMERCE_MODEL_ID,
  type CommerceModelId,
  type PublicCommerceConfiguration,
} from '@warmpawz/commerce-switch-contracts';
import { apiClient } from '@/lib/api-client';
import {
  getCommerceSwitchConfiguration,
  getHydratedCommerceConfiguration,
  isCommerceSwitchCacheStale,
  prefetchCommerceSwitchConfigurationOnStartup,
  shouldAcceptCommerceConfig,
  subscribeCommerceSwitchConfiguration,
  syncCommerceSwitchConfiguration,
} from '@/lib/commerce-switch-client';
import {
  ensureCommerceSwitchSyncListeners,
  requestCommerceSwitchSync,
} from '@/lib/commerce-switch-sync';

export type CommerceConfigContextValue = {
  config: PublicCommerceConfiguration;
  activeModelId: CommerceModelId;
  isMarketplace: boolean;
  isWarmpawzPay: boolean;
  isLoaded: boolean;
  isDegraded: boolean;
  refresh: () => Promise<void>;
};

const defaultConfig: PublicCommerceConfiguration = {
  activeModelId: DEFAULT_COMMERCE_MODEL_ID,
  version: 0,
  schemaVersion: '1.0',
  availableModels: [DEFAULT_COMMERCE_MODEL_ID],
  updatedAt: new Date(0).toISOString(),
};

const CommerceConfigContext = createContext<CommerceConfigContextValue | null>(null);

async function fetchRemoteConfigurationVersion(): Promise<number | null> {
  try {
    const res = await apiClient.get<{ configurationVersion?: number; version?: number }>(
      COMMERCE_SWITCH_ENDPOINTS.CONFIG_HEALTH
    );
    const version = res.configurationVersion ?? res.version;
    return typeof version === 'number' ? version : null;
  } catch {
    return null;
  }
}

function configsEqual(
  a: PublicCommerceConfiguration,
  b: PublicCommerceConfiguration
): boolean {
  return a.version === b.version && a.activeModelId === b.activeModelId;
}

export function CommerceConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicCommerceConfiguration>(() => {
    return getHydratedCommerceConfiguration() ?? defaultConfig;
  });
  const [isLoaded, setIsLoaded] = useState(() => getHydratedCommerceConfiguration() != null);

  const applyConfigIfChanged = useCallback((next: PublicCommerceConfiguration) => {
    setConfig((prev) => {
      if (configsEqual(prev, next)) return prev;
      if (prev.version > 0 && !shouldAcceptCommerceConfig(next, prev)) return prev;
      return next;
    });
    setIsLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    const next = await syncCommerceSwitchConfiguration({ force: true });
    applyConfigIfChanged(next);
  }, [applyConfigIfChanged]);

  const runFallbackVersionCheck = useCallback(async () => {
    const remoteVersion = await fetchRemoteConfigurationVersion();
    if (remoteVersion == null) return;
    if (isCommerceSwitchCacheStale()) {
      void syncCommerceSwitchConfiguration({ force: true }).then(applyConfigIfChanged);
      return;
    }
    if (!isLoaded || remoteVersion > config.version) {
      requestCommerceSwitchSync({ configurationVersion: remoteVersion }, 'fallback');
    }
  }, [applyConfigIfChanged, config.version, isLoaded]);

  useEffect(() => {
    prefetchCommerceSwitchConfigurationOnStartup();
    void getCommerceSwitchConfiguration()
      .then(applyConfigIfChanged)
      .catch(() => {
        setIsLoaded(true);
      });

    const unsubscribeClient = subscribeCommerceSwitchConfiguration(applyConfigIfChanged);
    const detachSyncListeners = ensureCommerceSwitchSyncListeners();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runFallbackVersionCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const fallbackTimer = window.setInterval(() => {
      void runFallbackVersionCheck();
    }, COMMERCE_SWITCH_FALLBACK_POLL_MS);

    return () => {
      unsubscribeClient();
      detachSyncListeners();
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(fallbackTimer);
    };
  }, [applyConfigIfChanged, runFallbackVersionCheck]);

  const value = useMemo<CommerceConfigContextValue>(
    () => ({
      config,
      activeModelId: config.activeModelId,
      isMarketplace: config.activeModelId === 'marketplace',
      isWarmpawzPay: config.activeModelId === 'warmpawz_pay',
      isLoaded,
      isDegraded: config.degraded === true,
      refresh,
    }),
    [config, isLoaded, refresh]
  );

  return <CommerceConfigContext.Provider value={value}>{children}</CommerceConfigContext.Provider>;
}

export function useCommerceConfig(): CommerceConfigContextValue {
  const ctx = useContext(CommerceConfigContext);
  if (!ctx) {
    throw new Error('useCommerceConfig must be used within CommerceConfigProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside the provider (e.g. warmpawz-pay routes). */
export function useCommerceConfigOptional(): CommerceConfigContextValue | null {
  return useContext(CommerceConfigContext);
}
