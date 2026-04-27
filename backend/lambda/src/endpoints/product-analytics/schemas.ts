/**
 * Allyticas product analytics — Zod schemas (ingest + admin query params).
 */
import { z } from 'zod';

export const ANALYTICS_APPS = ['customer_web', 'vendor_web'] as const;
export const ANALYTICS_ACTOR_TYPES = ['customer', 'vendor'] as const;
export const ANALYTICS_ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;

export const ANALYTICS_EVENT_TYPES = [
  'screen_view',
  'screen_end',
  'tap',
  'scroll',
  'filter',
  'tab_change',
  'search',
  'error',
  'api_timing',
  'notification_open',
  'notification_dismiss',
  'drop_off',
  'rage_click',
  'custom',
] as const;

export type AnalyticsApp = (typeof ANALYTICS_APPS)[number];
export type AnalyticsActorType = (typeof ANALYTICS_ACTOR_TYPES)[number];
export type AnalyticsEnvironment = (typeof ANALYTICS_ENVIRONMENTS)[number];
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

const MAX_PROPERTIES_JSON_BYTES = 16 * 1024;
const MAX_BATCH = 50;

export const singleEventSchema = z.object({
  event_type: z.enum(ANALYTICS_EVENT_TYPES),
  event_name: z.string().min(1).max(256),
  screen_name: z.string().max(512).nullable().optional(),
  duration_ms: z.number().int().min(0).max(86400000).nullable().optional(),
  api_name: z.string().max(512).nullable().optional(),
  error_code: z.string().max(256).nullable().optional(),
  version: z.number().int().min(1).max(32767).optional(),
  /** ISO-8601 string from client clock (optional skew diagnostics) */
  client_ts: z.string().max(40).nullable().optional(),
  actor_type: z.enum(ANALYTICS_ACTOR_TYPES).nullable().optional(),
  actor_id: z.string().uuid().nullable().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const ingestBodySchema = z.object({
  session_key: z.string().min(8).max(256),
  app: z.enum(ANALYTICS_APPS),
  environment: z.enum(ANALYTICS_ENVIRONMENTS),
  actor_type: z.enum(ANALYTICS_ACTOR_TYPES).nullable().optional(),
  actor_id: z.string().uuid().nullable().optional(),
  session_patch: z
    .object({
      device: z.record(z.string(), z.unknown()).optional(),
      context: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  events: z.array(singleEventSchema).min(1).max(MAX_BATCH),
});

export type IngestBody = z.infer<typeof ingestBodySchema>;

export function assertPropertiesSize(label: string, obj: Record<string, unknown> | undefined): void {
  const s = JSON.stringify(obj ?? {});
  if (s.length > MAX_PROPERTIES_JSON_BYTES) {
    throw new Error(`${label} exceeds ${MAX_PROPERTIES_JSON_BYTES} bytes`);
  }
}

export const DEFAULT_ADMIN_LIMIT = 1000;
export const MAX_ADMIN_LIMIT = 5000;
export const MAX_RAW_RANGE_DAYS = 93;

/** ISO timestamps: start inclusive, end exclusive recommended in API docs; we accept both inclusive with < end + 1day or use half-open — use explicit start/end as timestamptz */
export const adminDateRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
  app: z.enum(['all', ...ANALYTICS_APPS]).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(MAX_ADMIN_LIMIT).optional().default(DEFAULT_ADMIN_LIMIT),
});

export function parseIsoRange(start: string, end: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error('Invalid start or end datetime');
  }
  if (endMs <= startMs) {
    throw new Error('end must be after start');
  }
  const rangeDays = (endMs - startMs) / (86400 * 1000);
  if (rangeDays > MAX_RAW_RANGE_DAYS) {
    throw new Error(`Date range cannot exceed ${MAX_RAW_RANGE_DAYS} days`);
  }
  return { startMs, endMs };
}

export const ERROR_CASE_STATUSES = ['open', 'in_progress', 'resolved', 'ignored'] as const;
export const ERROR_CASE_PRIORITIES = ['p1', 'p2', 'p3', 'p4'] as const;

export const patchErrorCaseBodySchema = z.object({
  status: z.enum(ERROR_CASE_STATUSES).optional(),
  priority: z.enum(ERROR_CASE_PRIORITIES).optional(),
  /** ISO-8601 or null to clear */
  deadline_at: z.union([z.string(), z.null()]).optional(),
  assigned_admin_id: z.union([z.string().uuid(), z.null()]).optional(),
  notes: z.union([z.string().max(10000), z.null()]).optional(),
});
