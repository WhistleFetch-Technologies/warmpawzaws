/**
 * Action Sources (Triggers) Management Endpoints
 * 
 * CRUD for action_sources config that drives event emission (ActionOccurred)
 * Allows Admins to manage "when to emit" and "how to extract" for routes/jobs.
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { deleteRecord, insert, query, select, update } from 'src/database/rds-connection';
import { HandlerContext, HandlerResponse } from 'src/handler/base-handler';
import { BaseHandler } from 'src/handler/base-handler-enhanced';

// ============================================================================
// TYPES
// ============================================================================

type Json = Record<string, any>;

interface ActionSource {
	id?: string;
	source_type: 'http' | 'job' | 'db_outbox';
	route_pattern: string;
	method: string;
	status_min: number;
	status_max: number;
	success_predicate?: string | null;
	action_name: string;
	entity_resolver: string;
	entity_type?: 'customer' | 'vendor' | 'auto';
	amount_resolver?: string | null;
	reference_type?: string | null;
	reference_id_resolver?: string | null;
	metadata_resolvers?: Json;
	enabled: boolean;
	priority: number;
	dry_run: boolean;
	notes?: string | null;
	created_at?: string;
	updated_at?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']);
const VALID_SOURCE_TYPES = new Set(['http', 'job', 'db_outbox']);
const VALID_ENTITY_TYPES = new Set(['customer', 'vendor', 'auto']);

function validateCreateOrUpdate(body: any): { ok: boolean; message?: string } {
	if (!body) return { ok: false, message: 'Body required' };

	// Required
	if (!body.route_pattern || typeof body.route_pattern !== 'string') return { ok: false, message: 'route_pattern is required' };
	if (!body.method || typeof body.method !== 'string') return { ok: false, message: 'method is required' };
	if (!VALID_METHODS.has(String(body.method).toUpperCase())) return { ok: false, message: `Unsupported method: ${body.method}` };
	if (!body.action_name || typeof body.action_name !== 'string') return { ok: false, message: 'action_name is required' };
	const actionNameNorm = String(body.action_name).trim();
	if (!/^[a-z][a-z0-9_]*$/.test(actionNameNorm)) {
		return {
			ok: false,
			message:
				'action_name must be snake_case (lowercase, digits, underscores only) to match loyalty_action_rules.action_name — no hyphens',
		};
	}
	if (!body.entity_resolver || typeof body.entity_resolver !== 'string') return { ok: false, message: 'entity_resolver is required' };

	// Optionals with defaults
	if (body.source_type && !VALID_SOURCE_TYPES.has(body.source_type)) return { ok: false, message: `source_type must be one of: http, job, db_outbox` };
	if (body.entity_type && !VALID_ENTITY_TYPES.has(body.entity_type)) return { ok: false, message: `entity_type must be one of: customer, vendor, auto` };

	// Status range
	const statusMin = body.status_min ?? 200;
	const statusMax = body.status_max ?? 299;
	if (Number.isNaN(Number(statusMin)) || Number.isNaN(Number(statusMax))) return { ok: false, message: 'status_min/status_max must be numbers' };
	if (statusMin > statusMax) return { ok: false, message: 'status_min must be <= status_max' };

	// JSON object for metadata_resolvers if present
	if (body.metadata_resolvers && typeof body.metadata_resolvers !== 'object') {
		return { ok: false, message: 'metadata_resolvers must be an object' };
	}

	return { ok: true };
}

/** Columns that exist on action_sources — avoid SET id/created_at or stray client keys (prevents 500 on UPDATE). */
const ACTION_SOURCE_UPDATABLE_KEYS = new Set([
	'source_type',
	'route_pattern',
	'method',
	'status_min',
	'status_max',
	'success_predicate',
	'action_name',
	'entity_resolver',
	'entity_type',
	'amount_resolver',
	'reference_type',
	'reference_id_resolver',
	'metadata_resolvers',
	'enabled',
	'priority',
	'dry_run',
	'notes',
]);

function buildActionSourceUpdateRow(body: Partial<ActionSource>): Record<string, any> {
	const row: Record<string, any> = {};
	for (const key of ACTION_SOURCE_UPDATABLE_KEYS) {
		if (!(key in body)) continue;
		const v = (body as any)[key];
		if (v === undefined) continue;
		if (key === 'method') {
			row.method = String(v).toUpperCase();
			continue;
		}
		if (key === 'status_min' || key === 'status_max' || key === 'priority') {
			const n = Number(v);
			if (!Number.isNaN(n)) row[key] = n;
			continue;
		}
		if (key === 'metadata_resolvers') {
			if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
				row.metadata_resolvers = v;
			} else if (v === null) {
				row.metadata_resolvers = null;
			}
			continue;
		}
		row[key] = v;
	}
	return row;
}

// ============================================================================
// LIST
// ============================================================================

function firstQueryValue(v: string | string[] | undefined | null): string | undefined {
	if (v === undefined || v === null) return undefined;
	if (Array.isArray(v)) return v[0] !== undefined && v[0] !== null ? String(v[0]) : undefined;
	const s = String(v).trim();
	return s === '' ? undefined : s;
}

/** Shared method + route_pattern filters (same semantics as list). */
function actionSourceListFilterClause(method?: string, route?: string): { clause: string; params: any[] } {
	const params: any[] = [];
	const parts: string[] = [];
	if (method) {
		params.push(String(method).toUpperCase());
		parts.push(`method = $${params.length}`);
	}
	if (route) {
		const escaped = route.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
		params.push(`%${escaped}%`);
		parts.push(`route_pattern ILIKE $${params.length} ESCAPE '\\'`);
	}
	const clause = parts.length ? ` AND ${parts.join(' AND ')}` : '';
	return { clause, params };
}

class ListActionSourcesHandler extends BaseHandler {
	async handle(context: HandlerContext): Promise<HandlerResponse> {
		try {
			const qs = context.event.queryStringParameters || {};
			const method = firstQueryValue(qs.method as any);
			const route = firstQueryValue(qs.route as any);
			const enabledRaw = firstQueryValue(qs.enabled as any);

			const { clause, params: baseParams } = actionSourceListFilterClause(method, route);

			let enabledFilter: 'all' | true | false = 'all';
			if (enabledRaw !== undefined) {
				const e = enabledRaw.toLowerCase();
				if (e === 'true' || e === '1') enabledFilter = true;
				else if (e === 'false' || e === '0') enabledFilter = false;
			}

			const listParams = [...baseParams];
			let enabledSql = '';
			if (enabledFilter === true) {
				listParams.push(true);
				enabledSql = ` AND enabled = $${listParams.length}`;
			} else if (enabledFilter === false) {
				listParams.push(false);
				enabledSql = ` AND enabled = $${listParams.length}`;
			}

			const sql = `
        SELECT * FROM action_sources
        WHERE 1=1${clause}${enabledSql}
        ORDER BY priority DESC, updated_at DESC, route_pattern ASC`;

			const result = await query(sql, listParams);

			let hidden_disabled_count: number | undefined;
			if (enabledFilter === true) {
				const countParams = [...baseParams, false];
				const countSql = `
          SELECT COUNT(*)::int AS n FROM action_sources
          WHERE 1=1${clause} AND enabled = $${countParams.length}`;
				const cr = await query(countSql, countParams);
				hidden_disabled_count = parseInt(String(cr.rows?.[0]?.n ?? 0), 10);
			}

			return {
				statusCode: 200,
				body: JSON.stringify({
					success: true,
					sources: result.rows,
					total: result.rows.length,
					...(hidden_disabled_count !== undefined ? { hidden_disabled_count } : {}),
				}),
			};
		} catch (error: any) {
			console.error('[action-sources] list error:', error);
			return this.error('Failed to fetch action_sources', 500);
		}
	}
}

// ============================================================================
// GET BY ID
// ============================================================================

class GetActionSourceHandler extends BaseHandler {
	async handle(context: HandlerContext): Promise<HandlerResponse> {
		try {
			const { id } = context.event.pathParameters || {};
			if (!id) return this.error('ID is required', 400);

			const rows = await select('action_sources', { id });
			if (rows.length === 0) return this.error('Action source not found', 404);

			return {
				statusCode: 200,
				body: JSON.stringify({ success: true, source: rows[0] }),
			};
		} catch (error: any) {
			console.error('[action-sources] get error:', error);
			return this.error('Failed to fetch action_source', 500);
		}
	}
}

// ============================================================================
// CREATE
// ============================================================================

class CreateActionSourceHandler extends BaseHandler {
	async handle(context: HandlerContext): Promise<HandlerResponse> {
		try {
			const body = this.parseBody(context.event) as Partial<ActionSource>;
			const v = validateCreateOrUpdate(body);
			if (!v.ok) return this.error(v.message || 'Validation failed', 400);

			// Uniqueness: prevent exact duplicates on method+route_pattern+action_name
			const actionName = String(body.action_name).trim();
			const dup = await query(
				`SELECT id FROM action_sources WHERE method = $1 AND route_pattern = $2 AND action_name = $3`,
				[String(body.method).toUpperCase(), body.route_pattern, actionName]
			);
			if (dup.rows.length > 0) return this.error('Duplicate mapping exists for method+route_pattern+action_name', 409);

			const row = await insert('action_sources', {
				source_type: body.source_type || 'http',
				route_pattern: body.route_pattern,
				method: String(body.method).toUpperCase(),
				status_min: body.status_min ?? 200,
				status_max: body.status_max ?? 299,
				success_predicate: body.success_predicate || null,
				action_name: actionName,
				entity_resolver: body.entity_resolver,
				entity_type: body.entity_type || 'auto',
				amount_resolver: body.amount_resolver || null,
				reference_type: body.reference_type || null,
				reference_id_resolver: body.reference_id_resolver || null,
				metadata_resolvers: body.metadata_resolvers || {},
				enabled: body.enabled !== false,
				priority: body.priority ?? 100,
				dry_run: body.dry_run === true,
				notes: body.notes || null,
			});

			return {
				statusCode: 201,
				body: JSON.stringify({ success: true, source: row[0] }),
			};
		} catch (error: any) {
			console.error('[action-sources] create error:', error);
			return this.error('Failed to create action_source', 500);
		}
	}
}

// ============================================================================
// UPDATE
// ============================================================================

class UpdateActionSourceHandler extends BaseHandler {
	async handle(context: HandlerContext): Promise<HandlerResponse> {
		try {
			const { id } = context.event.pathParameters || {};
			if (!id) return this.error('ID is required', 400);
			const existing = await select('action_sources', { id });
			if (existing.length === 0) return this.error('Action source not found', 404);

			const body = this.parseBody(context.event) as Partial<ActionSource>;

			// Validate fields if present
			const merged = { ...existing[0], ...body };
			const v = validateCreateOrUpdate(merged);
			if (!v.ok) return this.error(v.message || 'Validation failed', 400);

			// If method/route_pattern/action_name changed, check duplicates
			if (
				(body.method && String(body.method).toUpperCase() !== existing[0].method) ||
				(body.route_pattern && body.route_pattern !== existing[0].route_pattern) ||
				(body.action_name && body.action_name !== existing[0].action_name)
			) {
				const dup = await query(
					`SELECT id FROM action_sources WHERE method = $1 AND route_pattern = $2 AND action_name = $3 AND id <> $4`,
					[
						String(merged.method).toUpperCase(),
						merged.route_pattern,
						merged.action_name,
						id,
					]
				);
				if (dup.rows.length > 0) return this.error('Duplicate mapping exists for method+route_pattern+action_name', 409);
			}

			const patch = buildActionSourceUpdateRow(body);
			patch.updated_at = new Date().toISOString();

			const updated = await update('action_sources', { id }, patch);

			return {
				statusCode: 200,
				body: JSON.stringify({ success: true, source: updated[0] }),
			};
		} catch (error: any) {
			const msg = error?.message || String(error);
			console.error('[action-sources] update error:', msg, error?.stack || '');
			const safe = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
			return this.error(`Failed to update action_source: ${safe}`, 500);
		}
	}
}

// ============================================================================
// DELETE
// ============================================================================

class DeleteActionSourceHandler extends BaseHandler {
	async handle(context: HandlerContext): Promise<HandlerResponse> {
		try {
			const { id } = context.event.pathParameters || {};
			if (!id) return this.error('ID is required', 400);
			const existing = await select('action_sources', { id });
			if (existing.length === 0) return this.error('Action source not found', 404);

			await deleteRecord('action_sources', { id });

			return {
				statusCode: 200,
				body: JSON.stringify({ success: true, message: 'Action source deleted successfully' }),
			};
		} catch (error: any) {
			console.error('[action-sources] delete error:', error);
			return this.error('Failed to delete action_source', 500);
		}
	}
}

// ============================================================================
// TEST MAPPING (Dry run)
// ============================================================================

/**
 * Request body:
 * {
 *   "request": { "method": "POST", "path": "/payments", "body": {...} },
 *   "response": { "status": 200, "body": {...} },
 *   "jwt": { "sub": "cust_1", "role": "customer" }
 * }
 */
class TestActionSourceHandler extends BaseHandler {
	async handle(context: HandlerContext): Promise<HandlerResponse> {
		try {
			const { id } = context.event.pathParameters || {};
			if (!id) return this.error('ID is required', 400);
			const rows = await select('action_sources', { id });
			if (rows.length === 0) return this.error('Action source not found', 404);

			const cfg = rows[0] as ActionSource;
			const body = this.parseBody(context.event) as {
				request?: { method?: string; path?: string; body?: any };
				response?: { status?: number; body?: any };
				jwt?: any;
			};

			const resStatus = body?.response?.status ?? 200;
			const inRange = resStatus >= (cfg.status_min ?? 200) && resStatus <= (cfg.status_max ?? 299);

			const wouldMatch = inRange && this.evaluatePredicate(cfg.success_predicate, body?.response?.body);

			if (!wouldMatch) {
				return {
					statusCode: 200,
					body: JSON.stringify({ success: true, wouldMatch: false }),
				};
			}

			// Resolve fields (very small safe resolver: res -> req -> jwt; only dot paths and || fallbacks)
			const ctx = { res: body?.response?.body || {}, req: body?.request?.body || {}, jwt: body?.jwt || {} };
			const resolve = (expr?: string | null): any => {
				if (!expr || typeof expr !== 'string') return undefined;
				const parts = expr.split('||').map(s => s.trim()).filter(Boolean);
				for (const p of parts) {
					const val = this.resolveDotPath(p, ctx);
					if (val !== undefined && val !== null && val !== '') return val;
				}
				return undefined;
			};

			const entityId = resolve(cfg.entity_resolver);
			const entityType = cfg.entity_type || 'auto';
			const amount = resolve(cfg.amount_resolver || undefined);
			const referenceId = resolve(cfg.reference_id_resolver || undefined);
			const metadata: Record<string, any> = {};
			if (cfg.metadata_resolvers && typeof cfg.metadata_resolvers === 'object') {
				for (const [k, v] of Object.entries(cfg.metadata_resolvers)) {
					metadata[k] = resolve(String(v));
				}
			}

			const eventPreview = {
				eventId: randomUUID(),
				eventType: 'ActionOccurred',
				occurredAt: new Date().toISOString(),
				actionName: cfg.action_name,
				entity: { type: entityType, id: entityId },
				actor: { type: entityType, id: entityId },
				amount,
				reference: cfg.reference_type ? { type: cfg.reference_type, id: referenceId } : undefined,
				metadata,
			};

			return {
				statusCode: 200,
				body: JSON.stringify({ success: true, wouldMatch: true, event: eventPreview }),
			};
		} catch (error: any) {
			console.error('[action-sources] test error:', error);
			return this.error('Failed to test action_source mapping', 500);
		}
	}

	private evaluatePredicate(predicate?: string | null, resBody?: any): boolean {
		if (!predicate || !predicate.trim()) return true;
		// Very small safe evaluator: supports "$.field == value" and $.field truthy checks
		try {
			// Equality
			const m = predicate.match(/^\s*\$\.(.+?)\s*==\s*["']?(.+?)["']?\s*$/);
			if (m) {
				const path = m[1];
				const expected = m[2];
				const actual = this.resolveDotPath(`$.${path}`, { res: resBody || {} });
				return String(actual) === expected;
			}
			// Truthy check: e.g., "$.success"
			if (predicate.startsWith('$.')) {
				const actual = this.resolveDotPath(predicate, { res: resBody || {} });
				return !!actual;
			}
			// Fallback: if unsupported, default to false to be safe
			return false;
		} catch {
			return false;
		}
	}

	private resolveDotPath(expr: string, ctx: { res: any; req: any; jwt: any }): any {
		// Supports prefixes: $.field → res, $.body.field → req, $.jwt.sub → jwt
		const trimmed = expr.trim();
		if (!trimmed.startsWith('$.')) return undefined;

		// Determine root
		if (trimmed.startsWith('$.jwt.')) {
			return this.getByPath(ctx.jwt, trimmed.substring('$.jwt.'.length));
		}
		if (trimmed.startsWith('$.body.')) {
			return this.getByPath(ctx.req, trimmed.substring('$.body.'.length));
		}
		// Default root "res"
		return this.getByPath(ctx.res, trimmed.substring('$.'.length));
	}

	private getByPath(obj: any, path: string): any {
		if (!obj || !path) return undefined;
		return path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
	}
}

// ============================================================================
// HELPERS FOR HONO INTEGRATION
// ============================================================================

function createApiGatewayEvent(req: any): any {
	const headers: Record<string, string> = {};
	if (req.headers && req.headers.entries) {
		try {
			Object.assign(headers, Object.fromEntries(req.headers.entries()));
		} catch {
			if (req.headers) {
				Object.keys(req.headers).forEach(key => { headers[key] = req.headers[key]; });
			}
		}
	}
	return {
		httpMethod: req.method,
		path: req.url ? req.url.split('?')[0] : '',
		pathParameters: {},
		queryStringParameters: {},
		headers,
		body: JSON.stringify(req.body || {}),
		isBase64Encoded: false,
	};
}

function createLambdaContext(): any {
	return {
		functionName: 'loyalty-action-sources-management',
		functionVersion: '$LATEST',
		awsRequestId: randomUUID(),
	};
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerLoyaltyActionSourcesManagementEndpoints(app: Hono) {
	const listHandler = new ListActionSourcesHandler();
	const getHandler = new GetActionSourceHandler();
	const createHandler = new CreateActionSourceHandler();
	const updateHandler = new UpdateActionSourceHandler();
	const deleteHandler = new DeleteActionSourceHandler();
	const testHandler = new TestActionSourceHandler();

	// CRUD
	app.get('/admin/action-sources', async (c) => {
		const event = createApiGatewayEvent(c.req);
		try {
			const queryObj = c.req.query();
			event.queryStringParameters = queryObj ? Object.fromEntries(Object.entries(queryObj)) : {};
		} catch {
			event.queryStringParameters = {};
		}
		const context = createLambdaContext();
		const result: any = await listHandler.execute(event, context);
		return c.json(JSON.parse(result.body), result.statusCode);
	});

	app.get('/admin/action-sources/:id', async (c) => {
		const event = createApiGatewayEvent(c.req);
		event.pathParameters = { id: c.req.param('id') };
		const context = createLambdaContext();
		const result: any = await getHandler.execute(event, context);
		return c.json(JSON.parse(result.body), result.statusCode);
	});

	app.post('/admin/action-sources', async (c) => {
		const event = createApiGatewayEvent(c.req);
		event.body = JSON.stringify(await c.req.json());
		const context = createLambdaContext();
		const result: any = await createHandler.execute(event, context);
		return c.json(JSON.parse(result.body), result.statusCode);
	});

	app.put('/admin/action-sources/:id', async (c) => {
		const event = createApiGatewayEvent(c.req);
		event.pathParameters = { id: c.req.param('id') };
		event.body = JSON.stringify(await c.req.json());
		const context = createLambdaContext();
		const result: any = await updateHandler.execute(event, context);
		return c.json(JSON.parse(result.body), result.statusCode);
	});

	app.delete('/admin/action-sources/:id', async (c) => {
		const event = createApiGatewayEvent(c.req);
		event.pathParameters = { id: c.req.param('id') };
		const context = createLambdaContext();
		const result: any = await deleteHandler.execute(event, context);
		return c.json(JSON.parse(result.body), result.statusCode);
	});

	// Dry-run tester
	app.post('/admin/action-sources/:id/test', async (c) => {
		const event = createApiGatewayEvent(c.req);
		event.pathParameters = { id: c.req.param('id') };
		event.body = JSON.stringify(await c.req.json());
		const context = createLambdaContext();
		const result: any = await testHandler.execute(event, context);
		return c.json(JSON.parse(result.body), result.statusCode);
	});
}

