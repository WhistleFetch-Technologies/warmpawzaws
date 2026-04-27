/**
 * Structured client errors → Allyticas via {@link trackError}.
 * Keeps payloads under ingest JSON size limits and avoids leaking full query strings in URLs.
 */

'use client';

import { trackError } from './analytics';
import { buildCustomerRouteKey } from './route-screen-label';

/** Margin under backend 16KB properties cap */
const MAX_PROPERTIES_JSON_BYTES = 15 * 1024;

let shellScreenRef: string | null = null;

/** Updated from shell flows (e.g. CustomerHomeWrapper) so uncaught errors include in-app screen. */
export function setClientShellScreenForErrors(screen: string | null): void {
  shellScreenRef = screen;
}

function asDim(v: unknown): string | number | boolean {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v;
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v).slice(0, 800);
  } catch {
    return '';
  }
}

function truncate(str: string | undefined, max: number): string {
  if (!str) return '';
  return str.length <= max ? str : `${str.slice(0, Math.max(0, max - 1))}…`;
}

export type ClientErrorReportPayload = {
  source: 'uncaught' | 'unhandled_rejection' | 'react_boundary';
  /** Short stable token — becomes Allyticas `error_code` via slug(label). */
  code: string;
  message: string;
  stack?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
};

function buildDims(payload: ClientErrorReportPayload): Record<string, string | number | boolean> {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const search = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
  const route_key = buildCustomerRouteKey(pathname, search);
  /** Privacy: omit query + hash from stored URL */
  const href_without_query =
    typeof window !== 'undefined' ? `${window.location.origin}${pathname}` : '';

  const dims: Record<string, string | number | boolean> = {
    message: truncate(payload.message, 2000),
    stack: truncate(payload.stack, 6000),
    componentStack: truncate(payload.componentStack, 2000),
    route_key: truncate(route_key, 512),
    shell_screen: truncate(shellScreenRef ?? '', 120),
    href_without_query: truncate(href_without_query, 512),
    error_source: payload.source,
  };

  if (payload.extra) {
    for (const [k, v] of Object.entries(payload.extra)) {
      if (k.length > 64) continue;
      dims[`extra_${k}`] = asDim(v);
    }
  }

  return dims;
}

function shrinkToLimit(dims: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  let cur = dims;
  for (let i = 0; i < 12; i++) {
    const n = JSON.stringify(cur).length;
    if (n <= MAX_PROPERTIES_JSON_BYTES) return cur;
    const m = typeof cur.message === 'string' ? cur.message : String(cur.message ?? '');
    const st = typeof cur.stack === 'string' ? cur.stack : String(cur.stack ?? '');
    const cs = typeof cur.componentStack === 'string' ? cur.componentStack : String(cur.componentStack ?? '');
    cur = {
      ...cur,
      message: truncate(m, Math.max(80, Math.floor(m.length * 0.5))),
      stack: truncate(st, Math.max(120, Math.floor(st.length * 0.5))),
      componentStack: truncate(cs, Math.max(80, Math.floor(cs.length * 0.5))),
    };
  }
  return {
    message: 'oversized_payload_truncated',
    error_source: String(cur.error_source ?? ''),
    route_key: String(cur.route_key ?? ''),
  };
}

/**
 * Reports a client error to Allyticas (`event_type=error`) with bounded `properties`.
 */
export function reportClientError(payload: ClientErrorReportPayload): void {
  try {
    const dims = shrinkToLimit(buildDims(payload));
    trackError(payload.source, payload.code, dims);
  } catch {
    trackError(payload.source, payload.code, {
      message: truncate(payload.message, 400),
      error_source: payload.source,
    });
  }
}

/** Registers window `error` + `unhandledrejection` once per tab. */
export function registerGlobalClientErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __warmpawz_client_error_handlers__?: boolean };
  if (w.__warmpawz_client_error_handlers__) return;
  w.__warmpawz_client_error_handlers__ = true;

  window.addEventListener(
    'error',
    (ev: ErrorEvent) => {
      if (ev.target != null && ev.target !== window) {
        return;
      }
      const msg = ev.message || 'Script error';
      const stack = ev.error instanceof Error ? ev.error.stack || '' : '';
      reportClientError({
        source: 'uncaught',
        code: 'js_uncaught',
        message: msg,
        stack,
      });
    },
    true
  );

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const reason = ev.reason;
    const message =
      reason instanceof Error
        ? reason.message || 'Error'
        : typeof reason === 'string'
          ? reason
          : (() => {
              try {
                return JSON.stringify(reason).slice(0, 500);
              } catch {
                return 'unhandled_rejection';
              }
            })();
    const stack = reason instanceof Error ? reason.stack || '' : '';
    reportClientError({
      source: 'unhandled_rejection',
      code: 'js_unhandled_rejection',
      message,
      stack,
    });
  });
}
