'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';
import { enqueueRouteScreenEnd } from '@/lib/allyticas-ingest';
import { humanizeCustomerRouteScreen } from '@/lib/route-screen-label';

function buildRouteKey(pathname: string | null, searchParams: ReturnType<typeof useSearchParams>): string {
  const path = pathname || '/';
  const qs = searchParams?.toString() ?? '';
  return qs ? `${path}?${qs}` : path;
}

type Dwell = {
  routeKey: string;
  screenLabel: string;
  /** `performance.now()` when current segment started; 0 if tab hidden after we already emitted `screen_end`. */
  segmentStart: number;
};

/**
 * Route-level Allyticas: `screen_view` on enter, `screen_end` + `duration_ms` when the session on that URL ends.
 *
 * Segments end on: SPA navigation, tab close (`pagehide`), or **switching away from the tab** (`visibilitychange`),
 * so time on Home still records when you open Admin in another tab without changing the customer URL.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dwellRef = useRef<Dwell>({
    routeKey: '',
    screenLabel: '',
    segmentStart: 0,
  });
  /** Avoid treating the first `visibilitychange` (visible-on-load) as “resume”; only resume after tab was hidden. */
  const pausedAfterHiddenRef = useRef(false);

  useEffect(() => {
    const key = buildRouteKey(pathname, searchParams);
    const qs = searchParams?.toString() ?? '';
    const screenLabel = humanizeCustomerRouteScreen(key);

    trackPageView({
      pageName: screenLabel,
      pageCategory: 'route',
      metadata: {
        ...(qs ? { query: qs } : {}),
        route_key: key,
      },
    });

    const now = performance.now();
    pausedAfterHiddenRef.current = false;
    dwellRef.current = {
      routeKey: key,
      screenLabel,
      segmentStart: now,
    };

    return () => {
      const d = dwellRef.current;
      if (!d.routeKey || !d.segmentStart) return;
      const ms = Math.round(performance.now() - d.segmentStart);
      enqueueRouteScreenEnd(d.routeKey, ms, d.screenLabel);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    const onPageHide = () => {
      const d = dwellRef.current;
      if (!d.routeKey || !d.segmentStart) return;
      enqueueRouteScreenEnd(d.routeKey, Math.round(performance.now() - d.segmentStart), d.screenLabel);
    };

    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const d = dwellRef.current;
      if (document.hidden) {
        if (!d.routeKey || !d.segmentStart) return;
        const ms = Math.round(performance.now() - d.segmentStart);
        enqueueRouteScreenEnd(d.routeKey, ms, d.screenLabel);
        dwellRef.current = { ...d, segmentStart: 0 };
        pausedAfterHiddenRef.current = true;
        return;
      }
      if (!pausedAfterHiddenRef.current) return;
      pausedAfterHiddenRef.current = false;
      const cur = dwellRef.current;
      if (!cur.routeKey) return;
      const now = performance.now();
      dwellRef.current = { ...cur, segmentStart: now };
      trackPageView({
        pageName: cur.screenLabel,
        pageCategory: 'route',
        metadata: { route_key: cur.routeKey, resumed: true },
      });
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return null;
}
