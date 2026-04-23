/**
 * Allyticas batch ingest client (customer_web → POST /analytics/v1/events).
 */

import { getApiBaseUrl } from './api-client';

export type AllyticasApp = 'customer_web' | 'vendor_web';
export type AllyticasEnv = 'dev' | 'staging' | 'prod';

const MAX_QUEUE = 50;
/** Flush this long after the *last* event (resets on each click) so data shows up quickly. */
const FLUSH_DEBOUNCE_MS = 600;

function resolveIngestUrl(): string | null {
  /** Prefer explicit analytics URL; else same base as REST API client (includes `window.__NEXT_PUBLIC_API_BASE_URL__`). */
  let u =
    (
      process.env.NEXT_PUBLIC_ANALYTICS_INGEST_URL ||
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      ''
    ).trim() || '';

  if (!u && typeof window !== 'undefined') {
    try {
      u = getApiBaseUrl().trim();
    } catch {
      u = '';
    }
  }

  if (!u) return null;
  if (u.includes('/analytics/v1/events')) return u;
  return u.replace(/\/$/, '') + '/analytics/v1/events';
}

function resolveEnv(): AllyticasEnv {
  const e = (process.env.NEXT_PUBLIC_ANALYTICS_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || '')
    .toLowerCase();
  if (e === 'production' || e === 'prod') return 'prod';
  if (e === 'preview' || e === 'staging' || e === 'stage') return 'staging';
  if (process.env.NODE_ENV === 'development') return 'dev';
  return 'prod';
}

/** Maps existing customer-web track() payloads to Allyticas enums */
export type LegacyTrackInput = {
  category: string;
  action: string;
  label?: string;
  value?: number;
  customDimensions?: Record<string, string | number | boolean>;
};

function slug(s: string, max = 120): string {
  return s.replace(/[^\w\-:]+/g, '_').slice(0, max);
}

/** Backend requires non-empty event_name */
function named(base: string): string {
  const x = slug(base).trim();
  return x.length > 0 ? x : 'event';
}

export function mapLegacyTrackToAllyticas(ev: LegacyTrackInput): IngestEventRow | null {
  const dims = ev.customDimensions ? { ...ev.customDimensions } : {};
  switch (ev.category) {
    case 'page_view': {
      const event_name = named(`page_${ev.action}_${ev.label || 'view'}`);
      const labeled =
        ev.label != null && String(ev.label).trim() !== '' ? String(ev.label).slice(0, 512) : event_name;
      return {
        event_type: 'screen_view',
        event_name,
        /** Never omit screen_name — admin /screens groups on it (NULL broke that tab before COALESCE fallback). */
        screen_name: labeled,
        properties: dims,
      };
    }
    case 'booking_flow':
      return {
        event_type: 'custom',
        event_name: named(`booking_${ev.action}`),
        properties: { step: ev.action, label: ev.label, ...dims },
      };
    case 'search':
      return {
        event_type: 'search',
        event_name: named(`search_${ev.action}`),
        properties: { query: ev.label, count: ev.value, ...dims },
      };
    case 'filter':
      return {
        event_type: 'filter',
        event_name: named(`filter_${ev.action}`),
        properties: { label: ev.label, ...dims },
      };
    case 'click':
      return {
        event_type: 'tap',
        event_name: named(`click_${ev.action}_${ev.label || 'target'}`),
        properties: dims,
      };
    case 'conversion':
      return {
        event_type: 'custom',
        event_name: named(`conversion_${ev.action}`),
        properties: { value: ev.value, ...dims },
      };
    case 'error':
      return {
        event_type: 'error',
        event_name: named(`error_${ev.action}`),
        error_code: slug(ev.label || ev.action || 'unknown', 80) || 'unknown',
        properties: dims,
      };
    case 'navigation':
      return {
        event_type: 'custom',
        event_name: named(`nav_${ev.action}`),
        properties: { label: ev.label, ...dims },
      };
    case 'engagement':
      return {
        event_type: 'custom',
        event_name: named(`engage_${ev.action}`),
        properties: dims,
      };
    default:
      return {
        event_type: 'custom',
        event_name: named(`${ev.category}_${ev.action}`),
        properties: { category: ev.category, ...dims },
      };
  }
}

export type IngestEventRow = {
  event_type: string;
  event_name: string;
  screen_name?: string | null;
  duration_ms?: number | null;
  api_name?: string | null;
  error_code?: string | null;
  properties?: Record<string, unknown>;
  client_ts?: string;
};

let queue: IngestEventRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAllyticas(false);
  }, FLUSH_DEBOUNCE_MS);
}

/** Dedupe cleanup + pagehide firing two ends for the same navigation/close (~same ms). */
let lastRouteScreenEndAt = 0;
let lastRouteScreenEndKey = '';

/**
 * Emit when leaving a route (SPA navigation), closing the tab, or hiding the page —
 * pairs with route-level `screen_view`.
 *
 * @param routeKey Stable route identity for dedupe (`/shop?x=1`), not the human label.
 * @param screenDisplayName Human-readable label from {@link humanizeCustomerRouteScreen}; stored as `screen_name`.
 */
export function enqueueRouteScreenEnd(
  routeKey: string,
  durationMs: number,
  screenDisplayName: string
): void {
  const dedupeKey = routeKey.trim().slice(0, 512);
  if (!dedupeKey) return;

  const dm = Math.min(Math.max(0, Math.round(durationMs)), 86_400_000);

  const now = performance.now();
  if (
    dedupeKey === lastRouteScreenEndKey &&
    now - lastRouteScreenEndAt < 800
  ) {
    return;
  }
  lastRouteScreenEndKey = dedupeKey;
  lastRouteScreenEndAt = now;

  const sn = screenDisplayName.trim().slice(0, 512) || dedupeKey;

  enqueueAllyticasEvent({
    event_type: 'screen_end',
    event_name: named(`page_end_${sn}`),
    screen_name: sn,
    duration_ms: dm,
    properties: { route_key: dedupeKey },
  });
  /** Send immediately with any queued `screen_view` — avoids waiting on debounce when user switches tabs quickly. */
  void flushAllyticas(false);
}

export function enqueueAllyticasEvent(ev: IngestEventRow): void {
  const url = resolveIngestUrl();
  if (!url || typeof window === 'undefined') {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(
        '[Allyticas] No ingest URL — set NEXT_PUBLIC_ANALYTICS_INGEST_URL or NEXT_PUBLIC_API_BASE_URL'
      );
    }
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    const w = window as Window & { __warmpawzLoggedIngestOnce?: boolean };
    if (!w.__warmpawzLoggedIngestOnce) {
      w.__warmpawzLoggedIngestOnce = true;
      console.info('[Allyticas] POST events to', url);
    }
  }

  queue.push(ev);
  if (queue.length >= MAX_QUEUE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushAllyticas(false);
    return;
  }
  scheduleFlush();
}

export async function flushAllyticas(useBeacon: boolean): Promise<void> {
  const url = resolveIngestUrl();
  if (!url || typeof window === 'undefined' || queue.length === 0) return;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = queue.splice(0, MAX_QUEUE);
  const sessionKey =
    sessionStorage.getItem('warmpawz_session_id') ||
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  sessionStorage.setItem('warmpawz_session_id', sessionKey);

  const customerId = localStorage.getItem('warmpawz_customer_id');
  const actorId = customerId && /^[0-9a-f-]{36}$/i.test(customerId) ? customerId : null;

  const body = JSON.stringify({
    session_key: sessionKey,
    app: 'customer_web' satisfies AllyticasApp,
    environment: resolveEnv(),
    actor_type: actorId ? 'customer' : null,
    actor_id: actorId,
    session_patch: {
      device: {
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        mobile: typeof navigator !== 'undefined' ? /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) : false,
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
      const msg = `[Allyticas] Ingest failed ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 300)}` : ''}`;
      if (process.env.NODE_ENV === 'development') {
        console.error(msg);
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.debug('[Allyticas] Ingest OK', batch.length, 'events');
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Allyticas] Ingest network error (CORS, offline, or blocked):', e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushAllyticas(true));
  window.addEventListener('pagehide', () => flushAllyticas(true));
}
