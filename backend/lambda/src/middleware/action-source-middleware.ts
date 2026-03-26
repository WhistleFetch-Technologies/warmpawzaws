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

async function getMappings(): Promise<Record<string, ActionSource[]>> {
	const now = Date.now();
	if (now - cache.at < CACHE_TTL_MS && Object.keys(cache.byMethod).length > 0) return cache.byMethod;

	const res = await query(
		`SELECT * FROM action_sources WHERE enabled = true ORDER BY priority DESC, updated_at DESC`
	);
	const rows = Array.isArray(res) ? res : (res as any).rows || [];
	const byMethod: Record<string, ActionSource[]> = {};
	for (const row of rows as ActionSource[]) {
		const method = (row.method || 'POST').toUpperCase();
		(byMethod[method] ||= []).push(row);
	}

	cache = { at: now, byMethod };
	return byMethod;
}

function getByPath(obj: any, path: string) {
	if (!obj || !path) return undefined;
	return path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function resolveDotPath(expr: string, ctx: { res: any; req: any; jwt: any; param?: any }) {
	const t = (expr || '').trim();
	if (!t.startsWith('$.')) return undefined;
	if (t.startsWith('$.param.')) return getByPath(ctx.param || {}, t.substring('$.param.'.length));
	if (t.startsWith('$.jwt.')) return getByPath(ctx.jwt, t.substring('$.jwt.'.length));
	if (t.startsWith('$.body.')) return getByPath(ctx.req, t.substring('$.body.'.length));
	return getByPath(ctx.res, t.substring('$.'.length));
}

function resolveExpr(expr: string | null | undefined, ctx: { res: any; req: any; jwt: any; param?: any }) {
	if (!expr || typeof expr !== 'string') return undefined;
	const parts = expr.split('||').map(s => s.trim()).filter(Boolean);
	for (const p of parts) {
		const val = resolveDotPath(p, ctx);
		if (val !== undefined && val !== null && val !== '') return val;
	}
	return undefined;
}

function evalPredicate(predicate: string | null | undefined, resBody: any): boolean {
	if (!predicate || !predicate.trim()) return true;
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

// EventBridge publisher
async function publishActionOccurred(evt: EventPayload): Promise<void> {
	try {
		const { EventBridgeClient, PutEventsCommand } = await import('@aws-sdk/client-eventbridge');
		const eb = new EventBridgeClient({});
		await eb.send(
			new PutEventsCommand({
				Entries: [
					{
						Source: 'app.warmpawz',
						DetailType: 'ActionOccurred',
						Detail: JSON.stringify(evt),
						EventBusName: process.env.EVENT_BUS_NAME || 'default',
					},
				],
			})
		);
	} catch (e: any) {
		console.warn('[ActionOccurred] publish failed (non-blocking):', e?.message || e);
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
				return pathToRegex(m.route_pattern).test(path);
			});
			if (candidates.length === 0) return;

			// Response JSON — always clone to avoid consuming the original body
			let responseJson: any = {};
			try {
				if (typeof c.res?.clone === 'function') {
					const clone = c.res.clone();
					const txt = await clone.text();
					responseJson = txt ? JSON.parse(txt) : {};
				}
			} catch {
				// ignore non-JSON or clone failures
			}

			let requestJson: any = {};
			try {
				requestJson = c.env?.parsedBody || {};
			} catch { /* ignore */ }

			const jwt: any = {};
			try {
				const event = c.env?.event;
				const claims = event?.requestContext?.authorizer?.claims || {};
				Object.assign(jwt, claims);
			} catch { /* ignore */ }

			const matched = candidates.find(m => evalPredicate(m.success_predicate, responseJson));
			if (!matched) return;

			// Extract URL path params from the matched route pattern.
			const param: any = {};
			try {
				const patternParts = (matched.route_pattern || '').split('/');
				const pathParts = path.split('/');
				for (let i = 0; i < patternParts.length; i++) {
					if (patternParts[i].startsWith(':') && pathParts[i]) {
						param[patternParts[i].substring(1)] = pathParts[i];
					}
				}
			} catch { /* ignore */ }

			const ctx = { res: responseJson, req: requestJson, jwt, param };
			const entityId = String(resolveExpr(matched.entity_resolver, ctx) || '');
			if (!entityId) return;

			const entityType = (matched.entity_type || 'auto') as 'customer' | 'vendor' | 'auto';
			const amountVal = resolveExpr(matched.amount_resolver || undefined, ctx);
			const referenceId = resolveExpr(matched.reference_id_resolver || undefined, ctx);

			const metadata: Json = {};
			if (matched.metadata_resolvers && typeof matched.metadata_resolvers === 'object') {
				for (const [k, v] of Object.entries(matched.metadata_resolvers)) {
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
				reference: matched.reference_type ? { type: matched.reference_type, id: referenceId ? String(referenceId) : undefined } : undefined,
				metadata,
			};

			if (matched.dry_run) {
				console.log('[ActionOccurred][dry-run]', JSON.stringify(evt).substring(0, 800));
				return;
			}
			await publishActionOccurred(evt);
		} catch (e: any) {
			// Never block or alter the response
		}
	};
}

