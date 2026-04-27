'use client';

import { enqueueVendor, flushVendor } from './allyticas-ingest';

function slug(s: string, max = 120): string {
  return s.replace(/[^\w\-:]+/g, '_').slice(0, max);
}

/**
 * Vendor portal analytics → Allyticas (RDS).
 * Set NEXT_PUBLIC_ANALYTICS_INGEST_URL to full API URL or API base (path /analytics/v1/events is appended).
 */
export function track(eventName: string, properties?: Record<string, unknown>) {
  enqueueVendor({
    event_type: 'custom',
    event_name: slug(eventName || 'event'),
    properties: properties ?? {},
  });
}

export function page(name: string, properties?: Record<string, unknown>) {
  enqueueVendor({
    event_type: 'screen_view',
    event_name: slug(`page_${name}`),
    screen_name: name,
    properties: properties ?? {},
  });
}

export function trackError(code: string, message?: string, properties?: Record<string, unknown> | undefined) {
  const props = { message, ...properties } as Record<string, unknown>;
  const routeKey = typeof props.route_key === 'string' ? props.route_key.trim() : '';
  const screenName =
    routeKey !== ''
      ? routeKey.slice(0, 512)
      : typeof window !== 'undefined'
        ? `${window.location.pathname || '/'}${window.location.search || ''}`.slice(0, 512)
        : slug(`error_${code}`).slice(0, 512);

  enqueueVendor({
    event_type: 'error',
    event_name: slug(`error_${code}`),
    error_code: slug(code, 80),
    screen_name: screenName,
    properties: props,
  });
}

export default {
  track,
  page,
  trackError,
  flush: () => flushVendor(false),
};
