'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isoRangeFromPreset } from '@/hooks/product-analytics/useProductAnalyticsRange';
import {
  fetchDiscountAnalyticsMode,
  fetchDiscountAnalyticsOverview,
  fetchPromotionStats,
} from '@/lib/marketing-analytics/discount-analytics-api';
import type {
  AnalyticsDomainFilter,
  AnalyticsPreset,
  AnalyticsReport,
  DiscountAnalyticsMode,
  PromotionStatsLegacy,
} from '@/lib/marketing-analytics/types';

const FILTERS_KEY = 'warmpawz.marketing-analytics.filters';

export function useDiscountAnalytics() {
  const [preset, setPreset] = useState<AnalyticsPreset>('30d');
  const [domain, setDomain] = useState<AnalyticsDomainFilter>('ALL');
  const [vendorId, setVendorId] = useState('');
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [legacyStats, setLegacyStats] = useState<PromotionStatsLegacy | null>(null);
  const [mode, setMode] = useState<DiscountAnalyticsMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { preset?: AnalyticsPreset; domain?: AnalyticsDomainFilter; vendorId?: string };
      if (saved.preset) setPreset(saved.preset);
      if (saved.domain) setDomain(saved.domain);
      if (saved.vendorId) setVendorId(saved.vendorId);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ preset, domain, vendorId }));
  }, [preset, domain, vendorId]);

  const filters = useMemo(() => {
    const { start, end } = isoRangeFromPreset(preset);
    return {
      domain,
      from: start,
      to: end,
      vendorId: vendorId.trim() || undefined,
      limit: 50,
    };
  }, [preset, domain, vendorId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetchDiscountAnalyticsMode();
      setMode(m);

      if (!m.enabled) {
        setError('Discount analytics engine is disabled (DISCOUNT_ENGINE_V2_ANALYTICS_MODE=OFF).');
        setReport(null);
        return;
      }
      if (!m.publiclyExposed) {
        setError(
          'Analytics is in SHADOW mode — data is generated server-side but not exposed via HTTP. Set DISCOUNT_ENGINE_V2_ANALYTICS_MODE=AUTHORITATIVE on dev Lambda.'
        );
        setReport(null);
        return;
      }

      const [overview, stats] = await Promise.all([
        fetchDiscountAnalyticsOverview(filters),
        fetchPromotionStats(),
      ]);
      if (!overview) {
        setError('Failed to load analytics overview.');
        setReport(null);
      } else {
        setReport(overview);
      }
      setLegacyStats(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    preset,
    setPreset,
    domain,
    setDomain,
    vendorId,
    setVendorId,
    filters,
    report,
    legacyStats,
    mode,
    loading,
    error,
    reload,
  };
}
