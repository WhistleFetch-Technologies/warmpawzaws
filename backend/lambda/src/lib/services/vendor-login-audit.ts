/**
 * Pure helpers for vendor login audit_logs read/write (unit-testable).
 */

export type VendorLoginEvent = {
  id: string;
  loggedInAt: string;
  ip?: string;
  userAgent?: string;
  method?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidVendorUuid(id: string | undefined | null): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function isTempOrInvalidAuditId(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') return true;
  if (id.startsWith('temp_')) return true;
  return !isValidVendorUuid(id);
}

function parseAuditJson(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export type LoginAuditRowInput = {
  id: string;
  created_at: string | Date;
  payload?: unknown;
  changes?: unknown;
  details?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
};

/** Map audit_logs row to API login event (supports changes, details, or column fallbacks). */
export function mapLoginAuditRow(row: LoginAuditRowInput): VendorLoginEvent {
  const payload =
    row.payload !== undefined && row.payload !== null
      ? parseAuditJson(row.payload)
      : { ...parseAuditJson(row.changes), ...parseAuditJson(row.details) };

  const ip =
    (typeof payload.ip === 'string' && payload.ip) ||
    (row.ip_address != null ? String(row.ip_address) : undefined);
  const userAgent =
    (typeof payload.userAgent === 'string' && payload.userAgent) ||
    (row.user_agent != null ? String(row.user_agent) : undefined);
  const method =
    (typeof payload.method === 'string' && payload.method) || 'otp';

  const loggedInAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at);

  return {
    id: String(row.id),
    loggedInAt,
    ip: ip || undefined,
    userAgent: userAgent || undefined,
    method,
  };
}

export function isPgMissingColumnError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === '42703' || /column .* does not exist/i.test(String(e?.message || ''));
}

export function buildLoginAuditDetailsPayload(details: {
  ip?: string;
  userAgent?: string;
  method?: string;
}): Record<string, string | null> {
  return {
    ip: details.ip || null,
    userAgent: details.userAgent || null,
    method: details.method || 'otp',
  };
}
