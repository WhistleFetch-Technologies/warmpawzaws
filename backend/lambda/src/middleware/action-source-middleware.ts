/**
* Action Source Middleware
*
* - Reads enabled mappings from action_sources (cached for 60s)
* - After a route handler completes, matches route/method/status and success_predicate
* - Resolves entity/amount/reference/metadata using simple JSONPath-like resolvers
* - Publishes a canonical ActionOccurred event (non-blocking)
*/

import { randomUUID } from 'crypto';
import { query } from '../database/rds-connection';

type Json = Record<string, any>;

type ActionSource = {
	id: string;
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
	metadata_resolvers?: Json | null;
	enabled: boolean;
	priority: number;
	dry_run: boolean;
	updated_at?: string;
};

type EventPayload = {
	eventId: string;
	eventType: 'ActionOccurred';
	occurredAt: string;
	actionName: string;
	entity: { type: 'customer' | 'vendor' | 'auto'; id: string };
	actor: { type: 'customer' | 'vendor' | 'auto'; id: string };
	amount?: number;
	reference?: { type: string; id?: string };
	metadata?: Json;
};

const CACHE_TTL_MS = 60_000;
let cache: { at: number; byMethod: Record<string, ActionSource[]> } = { at: 0, byMethod: {} };

function pathToRegex(pattern: string): RegExp {
	const re = '^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$';
	return new RegExp(re);
}

/** Multiple paths in one row: newline-separated patterns (migration 637 buy_medicine). */
function routePatternsFromStoredPattern(stored: string): string[] {
	if (!stored || !stored.trim()) return [];
	return stored
		.split(/\r?\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}

function routePatternMatchesPath(storedPattern: string, path: string): boolean {
	return routePatternsFromStoredPattern(storedPattern).some((p) => pathToRegex(p).test(path));
}

async function getMappings(): Promise<Record<string, ActionSource[]>> {
	const now = Date.now();
	if (now - cache.at < CACHE_TTL_MS && Object.keys(cache.byMethod).length > 0) return cache.byMethod;

	try {
		const res = await query(
			`SELECT * FROM action_sources WHERE enabled = true ORDER BY priority DESC, updated_at DESC`
		);
		const byMethod: Record<string, ActionSource[]> = {};
		for (const row of res.rows as ActionSource[]) {
			const method = (row.method || 'POST').toUpperCase();
			(byMethod[method] ||= []).push(row);
		}
		cache = { at: now, byMethod };
		return byMethod;
	} catch (e: any) {
		console.warn('[action-source-middleware] getMappings failed (local DB or missing table):', e?.message || e);
		cache = { at: now, byMethod: {} };
		return cache.byMethod;
	}
}

function getByPath(obj: any, path: string) {
	if (!obj || !path) return undefined;
	return path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function resolveDotPath(expr: string, ctx: { res: any; req: any; jwt: any; param?: any }) {
	const t = (expr || '').trim();
	if (!t.startsWith('$.')) return undefined;
	if (t.startsWith('$.jwt.')) return getByPath(ctx.jwt, t.substring('$.jwt.'.length));
	if (t.startsWith('$.body.')) return getByPath(ctx.req, t.substring('$.body.'.length));
	if (t.startsWith('$.param.')) return getByPath((ctx as any).param || {}, t.substring('$.param.'.length));
	return getByPath(ctx.res, t.substring('$.'.length));
}

function resolveExpr(expr: string | null | undefined, ctx: { res: any; req: any; jwt: any; param: any }) {
	if (!expr || typeof expr !== 'string') return undefined;
	const parts = expr.split('||').map(s => s.trim()).filter(Boolean);
	for (const p of parts) {
		const val = resolveDotPath(p, ctx);
		if (val !== undefined && val !== null && val !== '') return val;
	}
	return undefined;
}

/** So `$.a && ($.b || $.c)` works: after split on `&&`, inner `||` is not corrupted by stray `(` `)`. */
function stripOuterParensBalanced(expr: string): string {
	let s = expr.trim();
	while (s.startsWith('(') && s.endsWith(')')) {
		s = s.slice(1, -1).trim();
	}
	return s;
}

function  evalPredicate(predicate: string | null | undefined, resBody: any): boolean {
	if (!predicate || !predicate.trim()) return true;
	const trimmed = predicate.trim().toLowerCase();
	// Literal booleans
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;
	// Numeric truthiness
	if (trimmed === '1') return true;
	if (trimmed === '0') return false;
	// Support conjunctions: "$.a == 'x' && $.b == 'y'"
	if (trimmed.includes('&&')) {
		return predicate
			.split('&&')
			.map(p => p.trim())
			.filter(Boolean)
			.every(p => evalPredicate(stripOuterParensBalanced(p), resBody));
	}
	// Support disjunctions: "$.a == 'x' || $.b == 'y'"
	if (trimmed.includes('||')) {
		return predicate
			.split('||')
			.map(p => p.trim())
			.filter(Boolean)
			.some(p => evalPredicate(stripOuterParensBalanced(p), resBody));
	}
	// Equality: "$.field == 'value'"
	const m = predicate.match(/^\s*\$\.(.+?)\s*==\s*["']?(.+?)["']?\s*$/);
	if (m) {
		const path = m[1];
		const expected = m[2];
		const actual = resolveDotPath(`$.${path}`, { res: resBody, req: {}, jwt: {} });
		return String(actual) === expected;
	}
	// Truthy: "$.success"
	if (predicate.startsWith('$.')) {
		const actual = resolveDotPath(predicate, { res: resBody, req: {}, jwt: {} });
		return !!actual;
	}
	return false;
}

function resolveRepeatArrayItems(
	matched: ActionSource,
	responseJson: any
): Array<{ petId?: string; id?: string; [key: string]: unknown }> {
	const meta = matched.metadata_resolvers;
	if (!meta || typeof meta !== 'object') return [];
	const repeatPath = meta._repeatArrayPath;
	if (!repeatPath || typeof repeatPath !== 'string') return [];
	const arr = resolveDotPath(repeatPath, { res: responseJson, req: {}, jwt: {} });
	return Array.isArray(arr) ? arr : [];
}

async function publishMappingEvents(
	matched: ActionSource,
	ctx: { res: any; req: any; jwt: any; param: any }
): Promise<void> {
	const entityId = String(resolveExpr(matched.entity_resolver, ctx) || '');
	if (!entityId) {
		console.warn('[action-source-middleware] skip mapping: empty entityId', {
			mappingId: matched.id,
			action: matched.action_name,
		});
		return;
	}
	const entityType = (matched.entity_type || 'auto') as 'customer' | 'vendor' | 'auto';
	const amountVal = resolveExpr(matched.amount_resolver || undefined, ctx);
	const repeatItems = resolveRepeatArrayItems(matched, ctx.res);
	const repeatIdField =
		(matched.metadata_resolvers?._repeatIdField as string | undefined) || 'petId';

	const publishOne = async (referenceId?: string) => {
		const metadata: Json = {};
		if (matched.metadata_resolvers && typeof matched.metadata_resolvers === 'object') {
			for (const [k, v] of Object.entries(matched.metadata_resolvers)) {
				if (k.startsWith('_repeat')) continue;
				metadata[k] = resolveExpr(String(v), ctx);
			}
		}
		const evt: EventPayload = {
			eventId: randomUUID(),
			eventType: 'ActionOccurred',
			occurredAt: new Date().toISOString(),
			actionName: matched.action_name,
			entity: { type: entityType, id: entityId },
			actor: { type: entityType, id: entityId },
			amount: amountVal !== undefined ? Number(amountVal) : undefined,
			reference: matched.reference_type
				? {
						type: matched.reference_type,
						id: referenceId ? String(referenceId) : undefined,
					}
				: undefined,
			metadata,
		};
		if (matched.dry_run) {
			console.log('[ActionOccurred][dry-run]', JSON.stringify(evt).substring(0, 800));
			return;
		}
		await publishActionOccurred(evt);
	};

	if (repeatItems.length > 0) {
		for (const item of repeatItems) {
			const refId =
				(item && typeof item === 'object'
					? (item as Record<string, unknown>)[repeatIdField] ??
						(item as Record<string, unknown>).petId ??
						(item as Record<string, unknown>).id
					: undefined) ?? resolveExpr(matched.reference_id_resolver || undefined, ctx);
			await publishOne(refId ? String(refId) : undefined);
		}
		return;
	}

	const referenceId = resolveExpr(matched.reference_id_resolver || undefined, ctx);
	await publishOne(referenceId ? String(referenceId) : undefined);
}

// EventBridge publisher
async function publishActionOccurred(evt: EventPayload): Promise<void> {
	const bus = process.env.EVENT_BUS_NAME || 'default';
	try {
		const { EventBridgeClient, PutEventsCommand } = await import('@aws-sdk/client-eventbridge');
		const eb = new EventBridgeClient({});
		const out = await eb.send(
			new PutEventsCommand({
				Entries: [
					{
						Source: 'app.warmpawz',
						DetailType: 'ActionOccurred',
						Detail: JSON.stringify(evt),
						EventBusName: bus,
					},
				],
			})
		);
		const ent = out.Entries?.[0];
		const failed = (out.FailedEntryCount ?? 0) > 0;
		if (failed || ent?.ErrorCode) {
			console.warn('[ActionOccurred] PutEvents rejected entry', {
				bus,
				actionName: evt.actionName,
				eventId: evt.eventId,
				errorCode: ent?.ErrorCode,
				errorMessage: ent?.ErrorMessage,
				failedEntryCount: out.FailedEntryCount,
			});
		} else {
			console.log('[ActionOccurred] PutEvents ok', {
				bus,
				actionName: evt.actionName,
				eventId: evt.eventId,
				awsEventId: ent?.EventId,
			});
		}
	} catch (e: any) {
		console.warn('[ActionOccurred] publish failed (non-blocking):', { bus, message: e?.message || String(e) });
	}
}

export function actionSourceMiddleware() {
	return async (c: any, next: any) => {
		// Execute handler first
		await next();

		try {
			const method = (c.req.method || 'POST').toUpperCase();
			const path = c.req.path || c.req.url || '/';
			const status = c.res.status || 200;
			const mappingsByMethod = await getMappings();
			const candidates = (mappingsByMethod[method] || []).filter(m => {
				if (status < (m.status_min ?? 200) || status > (m.status_max ?? 299)) return false;
				return routePatternMatchesPath(m.route_pattern, path);
			});
			try {
				console.log('[ASDIAG] routeMatch', JSON.stringify({
					method,
					path,
					status,
					candidates: candidates.map(m => ({ id: m.id, action: m.action_name, route: m.route_pattern }))
				}));
			} catch { /* ignore */ }
			if (candidates.length === 0) return;

			// Response JSON: only read from a clone so the handler/outbound path can still read c.res body.
			if (!c.res || typeof c.res.clone !== 'function') {
				return;
			}
			let responseJson: any = {};
			try {
				const clone = c.res.clone();
				const txt = await clone.text();
				responseJson = txt ? JSON.parse(txt) : {};
			} catch {
				/* ignore */
			}


			// Request JSON
			let requestJson: any = {};
			try {
				requestJson = c.env?.parsedBody || {};
			} catch { /* ignore */ }


			// JWT claims (optional)
			const jwt: any = {};
			try {
				const event = c.env?.event;
				const claims = event?.requestContext?.authorizer?.claims || {};
				Object.assign(jwt, claims);
			} catch { /* ignore */ }

			// Filter mappings based on success predicate
			const matchedMappings = candidates.filter(m => evalPredicate(m.success_predicate, responseJson));
			if (matchedMappings.length === 0) return;	


			// Diagnostics: predicate-level matches
			try {
				console.log('[ASDIAG] predicateMatch', JSON.stringify({
					method,
					path,
					matched: matchedMappings.map(m => ({ id: m.id, action: m.action_name }))
				}));
			} catch { /* ignore */ }


			const routeParams = (() => {
				try {
					return c.req.param?.() || {};
				} catch {
					return {};
				}
			})();

			const ctx = { res: responseJson, req: requestJson, jwt, param: routeParams };

			// Diagnostics: params
			try {
				console.log('[ASDIAG] routeParams', JSON.stringify(routeParams));
			} catch { /* ignore */ }


			for (const matched of matchedMappings) {
				try {
					try {
						console.log('[ASDIAG] mappingEnter', JSON.stringify({
							mappingId: matched.id,
							action: matched.action_name,
							route: matched.route_pattern,
							entity_resolver: matched.entity_resolver,
							reference_id_resolver: matched.reference_id_resolver
						}));
					} catch { /* ignore */ }
					await publishMappingEvents(matched, ctx);
				} catch (mappingErr: any) {
					console.warn('[action-source-middleware] mapping failed (continuing):', {
						mappingId: matched.id,
						action: matched.action_name,
						error: mappingErr?.message || String(mappingErr),
					});
				}
			}
		} catch (e: any) {
			console.warn('[action-source-middleware] error (non-blocking):', e?.message || e);
			// Never block or alter the response
		}
	};
}

