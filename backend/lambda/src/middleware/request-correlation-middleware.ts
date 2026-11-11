/**
 * Batch 4 — Request correlation ID middleware.
 *
 * - Prefers a server-generated UUID.
 * - Accepts inbound x-request-id / x-correlation-id only when format/length are valid.
 * - Never derives IDs from PII.
 * - Sets Hono context + response header for end-to-end diagnostics.
 */
import type { Context, Next } from 'hono';
import { randomUUID } from 'crypto';

export const CORRELATION_HEADER = 'x-request-id';
export const CORRELATION_HEADER_ALT = 'x-correlation-id';

/**
 * Shared Hono variable map for request correlation (and compatible auth fields).
 * Runtime source of truth mirrors `src/types/hono-variables.d.ts` ContextVariableMap.
 */
export type WarmpawzRequestVariables = {
  requestId: string;
  correlationId: string;
  userId?: string;
  userRole?: string;
  userGroups?: string[];
  isAdmin?: boolean;
  isVendor?: boolean;
  isCustomer?: boolean;
  isUAT?: boolean;
};

/** UUID (any version) or opaque token: 8–64 chars of [A-Za-z0-9._-] */
const INBOUND_ID_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9._-]{8,64})$/i;

export function isValidCorrelationId(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (/[\s,;]|@|\+|phone|otp|bearer/i.test(trimmed)) return false;
  return INBOUND_ID_RE.test(trimmed);
}

export function resolveCorrelationId(inbound?: string | null): string {
  if (inbound && isValidCorrelationId(inbound)) {
    return inbound.trim();
  }
  return randomUUID();
}

export function getCorrelationIdFromContext(c: Context<{ Variables: WarmpawzRequestVariables } | any>): string {
  const existing = c.get('requestId') || c.get('correlationId');
  if (typeof existing === 'string' && isValidCorrelationId(existing)) return existing.trim();
  return 'unknown';
}

/**
 * Resolve a trusted request ID for logs/response headers.
 * Prefer validated context; otherwise validate inbound header or generate.
 */
export function resolveRequestIdForError(
  c: Context<{ Variables: WarmpawzRequestVariables } | any>,
): string {
  const fromContext = getCorrelationIdFromContext(c);
  if (fromContext !== 'unknown') return fromContext;

  const inbound =
    c.req.header(CORRELATION_HEADER) ||
    c.req.header('X-Request-Id') ||
    c.req.header(CORRELATION_HEADER_ALT) ||
    c.req.header('X-Correlation-Id') ||
    null;
  return resolveCorrelationId(inbound);
}

/**
 * Early middleware: assign correlation id and echo on response.
 */
export function requestCorrelationMiddleware() {
  return async (c: Context, next: Next) => {
    const inbound =
      c.req.header(CORRELATION_HEADER) ||
      c.req.header('X-Request-Id') ||
      c.req.header(CORRELATION_HEADER_ALT) ||
      c.req.header('X-Correlation-Id') ||
      null;

    const requestId = resolveCorrelationId(inbound);
    c.set('requestId', requestId);
    c.set('correlationId', requestId);

    await next();

    try {
      c.header(CORRELATION_HEADER, requestId);
    } catch {
      // Response may already be finalized; ignore.
    }
  };
}
