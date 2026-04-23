'use client';

import { useEffect } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { buildCustomerRouteKey } from '@/lib/route-screen-label';
import { composeShellAnalyticsLabel } from '@/lib/shell-screen-label';
import { enqueueAllyticasEvent, flushAllyticas } from '@/lib/allyticas-ingest';

function slug(base: string, max = 120): string {
  const x = base.replace(/[^\w\-:]+/g, '_').slice(0, max).trim();
  return x.length > 0 ? x : 'shell_event';
}

/** Minimum segment length before we emit `screen_end` (dev Strict Mode churn). */
const MIN_SHELL_DWELL_MS = 80;

/**
 * Tracks CustomerHomeWrapper **inner screens** (`currentScreen`) together with the **URL** (`pathname` + query).
 * Route-only {@link AnalyticsRouteTracker} still records URL changes; this hook adds component/shell granularity on the same path.
 */
export function useCustomerShellAnalytics(
  currentScreen: string,
  pathname: string | null,
  searchParams: ReadonlyURLSearchParams | null
): void {
  const qs = searchParams?.toString() ?? '';

  useEffect(() => {
    const routeKey = buildCustomerRouteKey(pathname, qs);
    const label = composeShellAnalyticsLabel(pathname, qs, currentScreen);
    const startedAt = performance.now();

    enqueueAllyticasEvent({
      event_type: 'screen_view',
      event_name: slug(`shell_view_${routeKey}_${currentScreen}`),
      screen_name: label,
      properties: {
        analytics_layer: 'shell',
        shell_screen: currentScreen,
        route_key: routeKey,
      },
    });
    void flushAllyticas(false);

    return () => {
      const ms = Math.round(performance.now() - startedAt);
      if (ms < MIN_SHELL_DWELL_MS) return;

      enqueueAllyticasEvent({
        event_type: 'screen_end',
        event_name: slug(`shell_end_${routeKey}_${currentScreen}`),
        screen_name: label,
        duration_ms: Math.min(ms, 86_400_000),
        properties: {
          analytics_layer: 'shell',
          shell_screen: currentScreen,
          route_key: routeKey,
        },
      });
      void flushAllyticas(false);
    };
  }, [currentScreen, pathname, qs]);
}
