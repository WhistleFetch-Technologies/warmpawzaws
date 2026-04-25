'use client';

import { getApiBaseUrl } from './api-client';

type AllyticasEnv = 'dev' | 'staging' | 'prod';

const MAX_QUEUE = 50;
const FLUSH_DEBOUNCE_MS = 600;

function resolveIngestUrl(): string | null {
  const explicitOverride = (
    process.env.NEXT_PUBLIC_ANALYTICS_INGEST_URL ||
    process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT ||
    ''
  ).trim();
  if (explicitOverride) {
    return explicitOverride.includes('/analytics/v1/events')
      ? explicitOverride
      : explicitOverride.replace(/\/$/, '') + '/analytics/v1/events';
  }

  let base = '';
  if (typeof window !== 'undefined') {
    try {
      base = getApiBaseUrl().trim();
    } catch {
      base = '';
    }
  }
  if (!base && typeof process !== 'undefined') {
    base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
    if (!base && process.env.NEXT_PUBLIC_ENVIRONMENT === 'production') {
      base = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
    } else if (!base) {
      base = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
    }
  }
  if (!base) return null;
  if (base.includes('/analytics/v1/events')) return base;
  return base.replace(/\/$/, '') + '/analytics/v1/events';
}

function resolveEnv(): AllyticasEnv {
  const e = (process.env.NEXT_PUBLIC_ANALYTICS_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || '')
    .toLowerCase();
  if (e === 'production' || e === 'prod') return 'prod';
  if (e === 'preview' || e === 'staging' || e === 'stage') return 'staging';
  if (process.env.NODE_ENV === 'development') return 'dev';
  return 'prod';
}

export type VendorIngestRow = {
  event_type:
    | 'screen_view'
    | 'tap'
    | 'error'
    | 'custom'
    | 'filter'
    | 'search';
  event_name: string;
  screen_name?: string | null;
  duration_ms?: number | null;
  api_name?: string | null;
  error_code?: string | null;
  properties?: Record<string, unknown>;
};

let queue: VendorIngestRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleVendorFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushVendor(false);
  }, FLUSH_DEBOUNCE_MS);
}

export function enqueueVendor(ev: VendorIngestRow): void {
  const url = resolveIngestUrl();
  if (!url || typeof window === 'undefined') {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(
        '[Allyticas/vendor] No ingest URL — set NEXT_PUBLIC_ANALYTICS_INGEST_URL or NEXT_PUBLIC_API_BASE_URL'
      );
    }
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    const w = window as Window & { __warmpawzVendorLoggedIngestOnce?: boolean };
    if (!w.__warmpawzVendorLoggedIngestOnce) {
      w.__warmpawzVendorLoggedIngestOnce = true;
      console.info('[Allyticas/vendor] POST events to', url);
    }
  }

  queue.push(ev);
  if (queue.length >= MAX_QUEUE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushVendor(false);
    return;
  }
  scheduleVendorFlush();
}

export async function flushVendor(useBeacon: boolean): Promise<void> {
  const url = resolveIngestUrl();
  if (!url || typeof window === 'undefined' || queue.length === 0) return;

  const batch = queue.splice(0, MAX_QUEUE);
  const storageKey = 'warmpawz_vendor_session_id';
  let sessionKey = sessionStorage.getItem(storageKey) || '';
  if (!sessionKey) {
    sessionKey = `vs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(storageKey, sessionKey);
  }

  const vendorUuid = localStorage.getItem('warmpawz_vendor_id');
  const actorId =
    vendorUuid && /^[0-9a-f-]{36}$/i.test(vendorUuid)
      ? vendorUuid
      : localStorage.getItem('warmpawz_vendor_uuid');

  const actorUuid =
    actorId && /^[0-9a-f-]{36}$/i.test(actorId) ? actorId : null;

  const body = JSON.stringify({
    session_key: sessionKey,
    app: 'vendor_web',
    environment: resolveEnv(),
    actor_type: actorUuid ? 'vendor' : null,
    actor_id: actorUuid,
    session_patch: {
      device: {
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      },
      context: {
        href: typeof window !== 'undefined' ? window.location.href : '',
      },
    },
    events: batch.map((e) => ({
      ...e,
      properties: e.properties ?? {},
    })),
  });

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const msg = `[Allyticas/vendor] Ingest failed ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 300)}` : ''}`;
      if (process.env.NODE_ENV === 'development') {
        console.error(msg);
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.debug('[Allyticas/vendor] Ingest OK', batch.length, 'events');
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Allyticas/vendor] Ingest network error:', e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushVendor(true));
  window.addEventListener('pagehide', () => flushVendor(true));
}
