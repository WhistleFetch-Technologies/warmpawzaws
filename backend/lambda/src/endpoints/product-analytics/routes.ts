/**
 * Allyticas — HTTP ingest + admin read APIs (RDS Postgres).
 */
import { Hono } from 'hono';
import { rateLimit } from '../../middleware/rate-limit-middleware';
import { requireAdminAuth } from '../admin/endpoints/admin.controller';
import { query } from '../../database/rds-connection';
import {
  ingestBodySchema,
  parseIsoRange,
  DEFAULT_ADMIN_LIMIT,
  MAX_ADMIN_LIMIT,
  MAX_RAW_RANGE_DAYS,
  patchErrorCaseBodySchema,
  ERROR_CASE_STATUSES,
  ERROR_CASE_PRIORITIES,
} from './schemas';
import { ingestProductAnalyticsBatch } from './service-ingest';

function adminBadDate(c: any, message: string) {
  return c.json({ success: false, error: message }, 400);
}

function parseRequiredRange(c: any): { startIso: string; endIso: string; appFilter: string | null; limit: number } | Response {
  const start = c.req.query('start') || c.req.query('date_from');
  const end = c.req.query('end') || c.req.query('date_to');
  const app = c.req.query('app') || 'all';
  const limitRaw = c.req.query('limit');

  if (!start || !end) {
    return adminBadDate(c, 'Required query params: start and end (ISO-8601 timestamps)');
  }

  try {
    parseIsoRange(start, end);
  } catch (e: any) {
    return adminBadDate(c, e?.message || 'Invalid date range');
  }

  let limit = DEFAULT_ADMIN_LIMIT;
  if (limitRaw != null && limitRaw !== '') {
    const n = parseInt(limitRaw, 10);
    if (Number.isNaN(n) || n < 1) {
      return adminBadDate(c, 'limit must be a positive integer');
    }
    limit = Math.min(n, MAX_ADMIN_LIMIT);
  }

  const appFilter =
    app === 'all' || app === '' ? null : app === 'customer_web' || app === 'vendor_web' ? app : null;
  if (appFilter === null && app !== 'all' && app !== '') {
    return adminBadDate(c, 'app must be all, customer_web, or vendor_web');
  }

  return { startIso: start, endIso: end, appFilter, limit };
}

export function registerProductAnalyticsEndpoints(app: Hono) {
  /** Public ingest — rate limited */
  app.post(
    '/analytics/v1/events',
    rateLimit({ windowMs: 60_000, maxRequests: 120, keyPrefix: 'allyticas-ingest' }),
    async (c) => {
      try {
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ success: false, error: 'Invalid JSON body' }, 400);
        }

        const parsed = ingestBodySchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            { success: false, error: 'Validation failed', details: parsed.error.flatten() },
            400
          );
        }

        const result = await ingestProductAnalyticsBatch(parsed.data);
        return c.json({ success: true, sessionId: result.sessionId, inserted: result.inserted });
      } catch (e: any) {
        console.error('[product-analytics ingest]', e);
        return c.json({ success: false, error: e?.message || 'Ingest failed' }, 500);
      }
    }
  );

  /** ----- Admin (requireAdminAuth + mandatory date range) ----- */

  app.get('/admin/analytics/product/summary', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const params: unknown[] = [r.startIso, r.endIso];
    let appClause = '';
    if (r.appFilter) {
      params.push(r.appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }

    try {
      const agg = await query(
        `SELECT 
           COUNT(*)::bigint AS total_events,
           COUNT(DISTINCT session_id)::bigint AS distinct_sessions,
           COUNT(*) FILTER (WHERE event_type = 'error')::bigint AS error_events,
           COUNT(*) FILTER (WHERE event_type = 'screen_view')::bigint AS screen_views,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL AND event_type IN ('screen_end', 'api_timing')) AS p95_duration_ms
         FROM analytics_events
         WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz ${appClause}`,
        params
      );

      const row = agg.rows[0] || {};
      return c.json({
        success: true,
        data: {
          totalEvents: Number(row.total_events ?? 0),
          distinctSessions: Number(row.distinct_sessions ?? 0),
          errorEvents: Number(row.error_events ?? 0),
          screenViews: Number(row.screen_views ?? 0),
          p95DurationMs: row.p95_duration_ms != null ? Number(row.p95_duration_ms) : null,
          range: { start: r.startIso, end: r.endIso, app: r.appFilter ?? 'all' },
        },
      });
    } catch (e: any) {
      console.error('[product-analytics summary]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/product/events', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const params: unknown[] = [r.startIso, r.endIso];
    let appClause = '';
    if (r.appFilter) {
      params.push(r.appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }

    const eventType = c.req.query('event_type');
    let typeClause = '';
    if (eventType && eventType !== '') {
      params.push(eventType);
      typeClause = ` AND event_type = $${params.length}::analytics_event_type_enum`;
    }

    params.push(r.limit);
    const limitParam = `$${params.length}`;

    try {
      const res = await query(
        `SELECT id, session_id, actor_type, actor_id, app, event_type, event_name, screen_name,
                duration_ms, api_name, error_code, environment, version, occurred_at, client_ts
         FROM analytics_events
         WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz ${appClause} ${typeClause}
         ORDER BY occurred_at DESC
         LIMIT ${limitParam}`,
        params
      );
      return c.json({ success: true, data: res.rows, limit: r.limit });
    } catch (e: any) {
      console.error('[product-analytics events]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/product/screens', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const params: unknown[] = [r.startIso, r.endIso];
    let appClause = '';
    if (r.appFilter) {
      params.push(r.appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }
    params.push(r.limit);

    try {
      const res = await query(
        `SELECT COALESCE(NULLIF(TRIM(screen_name), ''), NULLIF(TRIM(event_name), ''), '(unknown)') AS screen_name,
                COUNT(*) FILTER (WHERE event_type = 'screen_view')::bigint AS views,
                COALESCE(
                  SUM(duration_ms) FILTER (
                    WHERE event_type = 'screen_end' AND duration_ms IS NOT NULL
                  ),
                  0
                )::bigint AS total_duration_ms,
                AVG(duration_ms) FILTER (
                  WHERE event_type = 'screen_end' AND duration_ms IS NOT NULL
                )::float8 AS avg_duration_ms
         FROM analytics_events
         WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz
           AND event_type IN ('screen_view', 'screen_end')
           ${appClause}
         GROUP BY 1
         ORDER BY COALESCE(
                   SUM(duration_ms) FILTER (
                     WHERE event_type = 'screen_end' AND duration_ms IS NOT NULL
                   ),
                   0
                 ) DESC,
                  COUNT(*) FILTER (WHERE event_type = 'screen_view') DESC
         LIMIT $${params.length}`,
        params
      );
      return c.json({ success: true, data: res.rows });
    } catch (e: any) {
      console.error('[product-analytics screens]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/product/errors', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const params: unknown[] = [r.startIso, r.endIso];
    let appClause = '';
    if (r.appFilter) {
      params.push(r.appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }
    params.push(r.limit);

    try {
      const res = await query(
        `SELECT COALESCE(error_code, '(none)') AS error_code,
                COUNT(*)::bigint AS cnt,
                MAX(event_name) AS sample_event_name
         FROM analytics_events
         WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz
           AND event_type = 'error'
           ${appClause}
         GROUP BY error_code
         ORDER BY cnt DESC
         LIMIT $${params.length}`,
        params
      );
      return c.json({ success: true, data: res.rows });
    } catch (e: any) {
      console.error('[product-analytics errors]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/product/performance', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const params: unknown[] = [r.startIso, r.endIso];
    let appClause = '';
    if (r.appFilter) {
      params.push(r.appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }

    try {
      const res = await query(
        `SELECT api_name,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
                COUNT(*)::bigint AS samples
         FROM analytics_events
         WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz
           AND event_type = 'api_timing'
           AND api_name IS NOT NULL
           AND duration_ms IS NOT NULL
           ${appClause}
         GROUP BY api_name
         ORDER BY samples DESC
         LIMIT 50`,
        params
      );
      return c.json({ success: true, data: res.rows });
    } catch (e: any) {
      console.error('[product-analytics performance]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  /** Funnel: pass steps as comma-separated event_names (ordered) */
  app.get('/admin/analytics/product/funnel', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const stepsRaw = c.req.query('steps') || '';
    const stepNames = stepsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (stepNames.length < 2) {
      return c.json({ success: false, error: 'Provide steps=comma-separated event_name list (min 2)' }, 400);
    }

    /** Per-step: distinct sessions that fired event_name at least once in range */
    try {
      const stepCounts: { step: string; sessions: number }[] = [];
      for (const step of stepNames) {
        const qparams: unknown[] = [r.startIso, r.endIso];
        let ac = '';
        if (r.appFilter) {
          qparams.push(r.appFilter);
          ac = ` AND e.app = $${qparams.length}::analytics_app_enum`;
        }
        qparams.push(step);
        const stepIdx = qparams.length;
        const q = await query(
          `SELECT COUNT(DISTINCT e.session_id)::bigint AS cnt
           FROM analytics_events e
           WHERE e.occurred_at >= $1::timestamptz AND e.occurred_at <= $2::timestamptz
             AND e.event_name = $${stepIdx}::text
             ${ac}`,
          qparams
        );
        stepCounts.push({ step, sessions: Number(q.rows[0]?.cnt ?? 0) });
      }
      return c.json({ success: true, data: { steps: stepCounts } });
    } catch (e: any) {
      console.error('[product-analytics funnel]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  /** Top paths: consecutive screen_view event_name pairs */
  app.get('/admin/analytics/product/flows', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const depth = Math.min(parseInt(c.req.query('depth') || '2', 10) || 2, 4);
    const params: unknown[] = [r.startIso, r.endIso];
    let appClause = '';
    if (r.appFilter) {
      params.push(r.appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }
    params.push(r.limit);

    try {
      if (depth === 2) {
        const res = await query(
          `WITH ordered AS (
             SELECT session_id, event_name, occurred_at,
                    LEAD(event_name) OVER (PARTITION BY session_id ORDER BY occurred_at) AS next_name
             FROM analytics_events
             WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz
               AND event_type = 'screen_view'
               AND event_name IS NOT NULL
               ${appClause}
           )
           SELECT event_name || ' -> ' || next_name AS path, COUNT(*)::bigint AS cnt
           FROM ordered
           WHERE next_name IS NOT NULL
           GROUP BY event_name, next_name
           ORDER BY cnt DESC
           LIMIT $${params.length}`,
          params
        );
        return c.json({ success: true, data: res.rows });
      }

      return c.json({
        success: true,
        data: [],
        message: 'depth>2 not implemented in MVP; use depth=2',
      });
    } catch (e: any) {
      console.error('[product-analytics flows]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/product/search', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const r = parseRequiredRange(c);
    if (r instanceof Response) return r;

    const params: unknown[] = [r.startIso, r.endIso];
    let appClause = '';
    if (r.appFilter) {
      params.push(r.appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }
    params.push(r.limit);

    try {
      const res = await query(
        `SELECT event_name,
                COUNT(*)::bigint AS searches
         FROM analytics_events
         WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz
           AND event_type = 'search'
           ${appClause}
         GROUP BY event_name
         ORDER BY searches DESC
         LIMIT $${params.length}`,
        params
      );
      return c.json({ success: true, data: res.rows });
    } catch (e: any) {
      console.error('[product-analytics search]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/product/retention', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const start = c.req.query('start') || c.req.query('date_from');
    const end = c.req.query('end') || c.req.query('date_to');
    if (!start || !end) {
      return adminBadDate(c, 'Required query params: start and end');
    }

    /** Cohort window: allow longer than 93d for retention only */
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return adminBadDate(c, 'Invalid start/end');
    }
    const rangeDays = (endMs - startMs) / (86400 * 1000);
    if (rangeDays > MAX_RAW_RANGE_DAYS * 4) {
      return adminBadDate(c, `Retention cohort range cannot exceed ${MAX_RAW_RANGE_DAYS * 4} days`);
    }

    const app = c.req.query('app') || 'all';
    const appFilter =
      app === 'all' || app === '' ? null : app === 'customer_web' || app === 'vendor_web' ? app : null;
    if (appFilter === null && app !== 'all' && app !== '') {
      return adminBadDate(c, 'app must be all, customer_web, or vendor_web');
    }

    const params: unknown[] = [start, end];
    let appClause = '';
    if (appFilter) {
      params.push(appFilter);
      appClause = ` AND app = $${params.length}::analytics_app_enum`;
    }

    try {
      /** Return users with screen_view in window (proxy for active); D1/D7/D30 follow-up requires cohort anchor — MVP returns placeholder counts */
      const active = await query(
        `SELECT COUNT(DISTINCT actor_id)::bigint AS active_users
         FROM analytics_events
         WHERE occurred_at >= $1::timestamptz AND occurred_at <= $2::timestamptz
           AND actor_id IS NOT NULL
           AND event_type = 'screen_view'
           ${appClause}`,
        params
      );
      return c.json({
        success: true,
        data: {
          note: 'MVP: active_users with screen_view in range; extend with cohort anchor for D1/D7/D30',
          activeUsersInRange: Number(active.rows[0]?.active_users ?? 0),
          range: { start, end, app: appFilter ?? 'all' },
        },
      });
    } catch (e: any) {
      console.error('[product-analytics retention]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  /** ----- Error triage cases ----- */

  app.get('/admin/analytics/error-cases/assignees', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    try {
      const res = await query(
        `SELECT id, email, name
         FROM admins
         WHERE is_active = true
         ORDER BY COALESCE(name, '') ASC, email ASC`
      );
      return c.json({ success: true, data: res.rows });
    } catch (e: any) {
      console.error('[product-analytics error-cases assignees]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/error-cases', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }

    const start = c.req.query('start');
    const end = c.req.query('end');
    const status = c.req.query('status');
    const priority = c.req.query('priority');
    const assignedAdminId = c.req.query('assigned_admin_id');
    const qRaw = c.req.query('q');

    if ((start && !end) || (!start && end)) {
      return adminBadDate(c, 'Provide both start and end for last_seen filter or neither');
    }
    if (start && end) {
      try {
        parseIsoRange(start, end);
      } catch (e: any) {
        return adminBadDate(c, e?.message || 'Invalid date range');
      }
    }

    if (status && !(ERROR_CASE_STATUSES as readonly string[]).includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }
    if (priority && !(ERROR_CASE_PRIORITIES as readonly string[]).includes(priority)) {
      return c.json({ success: false, error: 'Invalid priority' }, 400);
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') || '50', 10) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (start && end) {
      params.push(start, end);
      conditions.push(
        `c.last_seen_at >= $${params.length - 1}::timestamptz AND c.last_seen_at <= $${params.length}::timestamptz`
      );
    }

    if (status) {
      params.push(status);
      conditions.push(`c.status = $${params.length}::analytics_error_case_status_enum`);
    }

    if (priority) {
      params.push(priority);
      conditions.push(`c.priority = $${params.length}::analytics_error_case_priority_enum`);
    }

    if (assignedAdminId) {
      if (!/^[0-9a-f-]{36}$/i.test(assignedAdminId)) {
        return c.json({ success: false, error: 'assigned_admin_id must be a UUID' }, 400);
      }
      params.push(assignedAdminId);
      conditions.push(`c.assigned_admin_id = $${params.length}::uuid`);
    }

    if (qRaw && qRaw.trim()) {
      params.push(`%${qRaw.trim()}%`);
      conditions.push(`(c.title ILIKE $${params.length} OR c.fingerprint ILIKE $${params.length})`);
    }

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    try {
      const res = await query(
        `SELECT c.id,
                c.fingerprint,
                c.title,
                c.status,
                c.priority,
                c.deadline_at,
                c.assigned_admin_id,
                c.notes,
                c.first_seen_at,
                c.last_seen_at,
                c.created_at,
                c.updated_at,
                (SELECT COUNT(*)::bigint FROM error_case_occurrences o WHERE o.case_id = c.id) AS occurrence_count,
                a.email AS assignee_email,
                a.name AS assignee_name,
                COUNT(*) OVER()::bigint AS _full_count
         FROM product_error_cases c
         LEFT JOIN admins a ON a.id = c.assigned_admin_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY c.last_seen_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
      );

      const total = res.rows.length > 0 ? Number(res.rows[0]._full_count ?? 0) : 0;
      const rows = res.rows.map((row: Record<string, unknown>) => {
        const { _full_count, ...rest } = row;
        return rest;
      });

      return c.json({
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (e: any) {
      console.error('[product-analytics error-cases list]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.get('/admin/analytics/error-cases/:id', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return c.json({ success: false, error: 'Invalid id' }, 400);
    }

    try {
      const caseRow = await query(
        `SELECT c.id,
                c.fingerprint,
                c.title,
                c.status,
                c.priority,
                c.deadline_at,
                c.assigned_admin_id,
                c.notes,
                c.first_seen_at,
                c.last_seen_at,
                c.created_at,
                c.updated_at,
                (SELECT COUNT(*)::bigint FROM error_case_occurrences o WHERE o.case_id = c.id) AS occurrence_count,
                a.email AS assignee_email,
                a.name AS assignee_name
         FROM product_error_cases c
         LEFT JOIN admins a ON a.id = c.assigned_admin_id
         WHERE c.id = $1::uuid`,
        [id]
      );

      if (caseRow.rows.length === 0) {
        return c.json({ success: false, error: 'Not found' }, 404);
      }

      const occ = await query(
        `SELECT o.id AS occurrence_id,
                o.created_at AS linked_at,
                e.id AS event_id,
                e.occurred_at,
                e.screen_name,
                e.properties,
                e.environment,
                e.app,
                e.event_name,
                e.error_code,
                e.session_id,
                e.actor_id,
                e.client_ts
         FROM error_case_occurrences o
         JOIN analytics_events e ON e.id = o.event_id
         WHERE o.case_id = $1::uuid
         ORDER BY e.occurred_at DESC
         LIMIT 500`,
        [id]
      );

      return c.json({
        success: true,
        data: {
          case: caseRow.rows[0],
          occurrences: occ.rows,
        },
      });
    } catch (e: any) {
      console.error('[product-analytics error-cases detail]', e);
      return c.json({ success: false, error: e?.message || 'Query failed' }, 500);
    }
  });

  app.patch('/admin/analytics/error-cases/:id', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return c.json({ success: false, error: 'Invalid id' }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const parsed = patchErrorCaseBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        400
      );
    }

    const p = parsed.data;
    const hasUpdate =
      p.status !== undefined ||
      p.priority !== undefined ||
      p.deadline_at !== undefined ||
      p.assigned_admin_id !== undefined ||
      p.notes !== undefined;

    if (!hasUpdate) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    if (p.assigned_admin_id !== undefined && p.assigned_admin_id !== null) {
      try {
        const chk = await query('SELECT 1 FROM admins WHERE id = $1::uuid LIMIT 1', [p.assigned_admin_id]);
        if (chk.rows.length === 0) {
          return c.json({ success: false, error: 'Unknown assignee admin id' }, 400);
        }
      } catch (e: any) {
        console.error('[product-analytics error-cases patch verify admin]', e);
        return c.json({ success: false, error: e?.message || 'Lookup failed' }, 500);
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (p.status !== undefined) {
      vals.push(p.status);
      sets.push(`status = $${vals.length}::analytics_error_case_status_enum`);
    }
    if (p.priority !== undefined) {
      vals.push(p.priority);
      sets.push(`priority = $${vals.length}::analytics_error_case_priority_enum`);
    }
    if (p.deadline_at !== undefined) {
      if (p.deadline_at === null) {
        sets.push('deadline_at = NULL');
      } else {
        const t = Date.parse(p.deadline_at);
        if (Number.isNaN(t)) {
          return c.json({ success: false, error: 'deadline_at must be a valid ISO datetime' }, 400);
        }
        vals.push(new Date(t).toISOString());
        sets.push(`deadline_at = $${vals.length}::timestamptz`);
      }
    }
    if (p.assigned_admin_id !== undefined) {
      if (p.assigned_admin_id === null) {
        sets.push('assigned_admin_id = NULL');
      } else {
        vals.push(p.assigned_admin_id);
        sets.push(`assigned_admin_id = $${vals.length}::uuid`);
      }
    }
    if (p.notes !== undefined) {
      if (p.notes === null) {
        sets.push('notes = NULL');
      } else {
        vals.push(p.notes);
        sets.push(`notes = $${vals.length}`);
      }
    }

    sets.push('updated_at = now()');
    vals.push(id);

    try {
      const upd = await query(
        `UPDATE product_error_cases SET ${sets.join(', ')} WHERE id = $${vals.length}::uuid RETURNING *`,
        vals
      );
      if (upd.rows.length === 0) {
        return c.json({ success: false, error: 'Case not found' }, 404);
      }
      return c.json({ success: true, data: upd.rows[0] });
    } catch (e: any) {
      console.error('[product-analytics error-cases patch]', e);
      return c.json({ success: false, error: e?.message || 'Update failed' }, 500);
    }
  });
}
