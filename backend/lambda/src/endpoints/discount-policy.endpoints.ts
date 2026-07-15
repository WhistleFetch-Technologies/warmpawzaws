/**
 * Discount policy HTTP API — Policy Center V2 lifecycle (draft, publish, history, audit, simulate).
 */
import type { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { DiscountDomain } from '../discount-engine/enums/discount-domain';
import {
  buildDefaultPolicyBundle,
  ensureBusinessRules,
  syncBusinessRulesToEngine,
  type DiscountPolicyBundle,
} from '../discount-engine/config/business-rules-mapper';
import { loadRuntimePolicy } from '../discount-engine/policy/runtime-policy-loader';
import { getPolicyValidationEngine } from '../discount-engine/policy/policy-validation-engine';
import { computePolicyFingerprint } from '../discount-engine/policy/runtime-policy-fingerprint';
import {
  getActivePolicyBundle,
  getActivePolicyBundleSync,
  invalidatePolicyCache,
  loadDraftPolicyFromDb,
  loadPublishedPolicyFromDb,
} from '../discount-engine/policy/policy-persistence';
import { simulatePolicyWithResolver } from '../discount-engine/resolver/policy-simulator';
import type { SimulatorOfferInput } from '../discount-engine/resolver/policy-simulator';
import type { UnifiedResolverResponse } from '../discount-engine/resolver/unified-resolver-response';
import { query, insert } from '../database/rds-connection';

function normalizeBundle(raw: DiscountPolicyBundle): DiscountPolicyBundle {
  return syncBusinessRulesToEngine(raw, ensureBusinessRules(raw));
}

function bundleFingerprint(bundle: DiscountPolicyBundle): string {
  const runtime = loadRuntimePolicy(DiscountDomain.SERVICE, {
    priority: bundle.priority,
    stack: bundle.stack,
    funding: bundle.funding,
    limits: bundle.limits,
    businessRules: bundle.businessRules,
  });
  return runtime.policyFingerprint ?? computePolicyFingerprint(runtime);
}

async function appendAudit(event: {
  eventType: string;
  publishId?: string;
  actor?: string;
  fingerprint?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await insert('discount_policy_audit', {
      event_type: event.eventType,
      publish_id: event.publishId ?? null,
      actor: event.actor ?? 'system',
      fingerprint: event.fingerprint ?? null,
      details: event.details ?? {},
    });
  } catch (err) {
    console.warn('[discount-policy] audit append failed', err);
  }
}

export function registerDiscountPolicyEndpoints(app: Hono) {
  app.get('/admin/discount-policy/capabilities', (c) =>
    c.json({
      runtimeRead: true,
      draftRead: true,
      draftWrite: true,
      validate: true,
      publish: true,
      rollback: true,
      history: true,
      simulate: true,
      audit: true,
    })
  );

  app.get('/admin/discount-policy/runtime', async (c) => {
    const active = await getActivePolicyBundle();
    const runtime = loadRuntimePolicy(DiscountDomain.SERVICE, {
      publishId: active.publishId,
    });
    return c.json({
      bundle: active.bundle,
      fingerprint: active.fingerprint ?? runtime.policyFingerprint,
      publishedAt: active.publishedAt ?? runtime.mergedAt,
      publishedBy: active.publishedBy ?? null,
      status: active.publishId ? 'published' : 'default',
    });
  });

  app.get('/admin/discount-policy/runtime/diagnostics', async (c) => {
    const active = await getActivePolicyBundle();
    const rules = ensureBusinessRules(active.bundle);
    const runtime = loadRuntimePolicy(DiscountDomain.SERVICE, { publishId: active.publishId });
    return c.json({
      priorityVersion: runtime.priorityVersion,
      stackVersion: runtime.stackVersion,
      fundingVersion: runtime.fundingVersion,
      limitsVersion: runtime.limitsVersion,
      businessRulesVersion: rules.version,
      applicationStrategy: rules.applicationStrategy,
      winningStrategy: rules.winningStrategy ?? null,
      combinationMatrix: rules.combinationMatrix,
      policyFingerprint: active.fingerprint ?? runtime.policyFingerprint,
      publishId: active.publishId ?? null,
      publishedBy: active.publishedBy ?? null,
      publishedAt: active.publishedAt ?? runtime.mergedAt,
      status: active.publishId ? 'published' : 'default',
      resolverMode: process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE ?? 'OFF',
      settlementMode: process.env.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE ?? 'OFF',
      stackMode: process.env.DISCOUNT_ENGINE_V2_STACK_MODE ?? 'OFF',
      priorityMode: process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE ?? 'OFF',
    });
  });

  app.get('/admin/discount-policy/draft', async (c) => {
    const draft = await loadDraftPolicyFromDb();
    if (draft) return c.json({ bundle: draft });
    const active = await getActivePolicyBundle();
    return c.json({ bundle: active.bundle });
  });

  app.put('/admin/discount-policy/draft', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const bundle = normalizeBundle((body.bundle ?? body) as DiscountPolicyBundle);
    const actor = c.req.header('x-admin-user') ?? c.req.header('x-user-id') ?? 'admin';

    await query(
      `INSERT INTO discount_policy_draft (id, bundle, updated_at, updated_by)
       VALUES ('singleton', $1::jsonb, NOW(), $2)
       ON CONFLICT (id) DO UPDATE SET bundle = EXCLUDED.bundle, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(bundle), actor]
    );

    invalidatePolicyCache();
    await appendAudit({
      eventType: 'DRAFT_SAVED',
      actor,
      fingerprint: bundleFingerprint(bundle),
      details: { applicationStrategy: bundle.businessRules?.applicationStrategy },
    });

    return c.json({ success: true, bundle });
  });

  app.post('/admin/discount-policy/validate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const bundle = normalizeBundle((body.bundle ?? getActivePolicyBundleSync()) as DiscountPolicyBundle);
    const runtime = loadRuntimePolicy(DiscountDomain.SERVICE, {
      priority: bundle.priority,
      stack: bundle.stack,
      funding: bundle.funding,
      limits: bundle.limits,
      businessRules: bundle.businessRules,
    });
    const result = getPolicyValidationEngine().validate(runtime);
    return c.json({
      valid: result.isPublishable,
      isPublishable: result.isPublishable,
      errors: result.errors,
      warnings: result.warnings,
      suggestions: result.suggestions,
      findings: result.findings,
      validatedFingerprint: result.validatedFingerprint,
    });
  });

  app.post('/admin/discount-policy/publish', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const bundle = normalizeBundle(
      (body.bundle ?? (await loadDraftPolicyFromDb()) ?? buildDefaultPolicyBundle()) as DiscountPolicyBundle
    );
    const actor = c.req.header('x-admin-user') ?? c.req.header('x-user-id') ?? 'admin';
    const runtime = loadRuntimePolicy(DiscountDomain.SERVICE, {
      priority: bundle.priority,
      stack: bundle.stack,
      funding: bundle.funding,
      limits: bundle.limits,
      businessRules: bundle.businessRules,
    });
    const validation = getPolicyValidationEngine().validate(runtime);
    if (!validation.isPublishable) {
      return c.json(
        {
          success: false,
          error: 'Policy validation failed',
          validation,
        },
        400
      );
    }

    const publishId = randomUUID();
    const fingerprint = runtime.policyFingerprint ?? bundleFingerprint(bundle);

    await query(`UPDATE discount_policy_versions SET status = 'superseded' WHERE status = 'active'`);
    await insert('discount_policy_versions', {
      publish_id: publishId,
      bundle: JSON.stringify(bundle),
      fingerprint,
      published_by: actor,
      status: 'active',
      notes: body.notes ?? null,
    });

    invalidatePolicyCache();
    await loadPublishedPolicyFromDb();

    await appendAudit({
      eventType: 'PUBLISHED',
      publishId,
      actor,
      fingerprint,
      details: {
        applicationStrategy: bundle.businessRules?.applicationStrategy,
        winningStrategy: bundle.businessRules?.winningStrategy,
      },
    });

    return c.json({
      success: true,
      publishId,
      fingerprint,
      publishedAt: new Date().toISOString(),
      publishedBy: actor,
    });
  });

  app.post('/admin/discount-policy/rollback', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const publishId = String(body.publishId || '').trim();
    if (!publishId) return c.json({ success: false, error: 'publishId required' }, 400);

    const res = await query(
      `SELECT bundle, fingerprint FROM discount_policy_versions WHERE publish_id = $1 LIMIT 1`,
      [publishId]
    );
    const row = res.rows?.[0] as Record<string, unknown> | undefined;
    if (!row?.bundle) return c.json({ success: false, error: 'Version not found' }, 404);

    const actor = c.req.header('x-admin-user') ?? c.req.header('x-user-id') ?? 'admin';
    await query(`UPDATE discount_policy_versions SET status = 'superseded' WHERE status = 'active'`);
    await query(
      `UPDATE discount_policy_versions SET status = 'active', published_at = NOW(), published_by = $2 WHERE publish_id = $1`,
      [publishId, actor]
    );

    invalidatePolicyCache();
    await loadPublishedPolicyFromDb();

    await appendAudit({
      eventType: 'ROLLBACK',
      publishId,
      actor,
      fingerprint: String(row.fingerprint),
    });

    return c.json({ success: true, publishId });
  });

  app.get('/admin/discount-policy/history', async (c) => {
    const res = await query(
      `SELECT publish_id, fingerprint, published_at, published_by, status, notes
       FROM discount_policy_versions
       ORDER BY published_at DESC
       LIMIT 50`
    ).catch(() => ({ rows: [] }));

    const history = (res.rows ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.publish_id),
      version: String(row.publish_id).slice(0, 8),
      policyFingerprint: String(row.fingerprint),
      publishedBy: row.published_by ? String(row.published_by) : undefined,
      publishedAt: String(row.published_at),
      summary: row.notes ? String(row.notes) : undefined,
      rollbackAvailable: row.status !== 'active',
      status: String(row.status),
    }));

    return c.json({ history });
  });

  app.get('/admin/discount-policy/audit', async (c) => {
    const limit = Math.min(Number(c.req.query('limit') || 100), 500);
    const res = await query(
      `SELECT id, event_type, publish_id, actor, fingerprint, details, created_at
       FROM discount_policy_audit
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    ).catch(() => ({ rows: [] }));

    return c.json({
      events: res.rows ?? [],
      count: res.rows?.length ?? 0,
    });
  });

  app.post('/admin/discount-policy/simulate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const bundle = normalizeBundle(
      (body.bundle ?? getActivePolicyBundleSync()) as DiscountPolicyBundle
    );
    const servicePrice = Number(body.servicePrice ?? 1000);
    const offers = (Array.isArray(body.offers) ? body.offers : []) as SimulatorOfferInput[];

    const quote = simulatePolicyWithResolver(bundle, {
      servicePrice,
      offers,
      domain: String(body.domain ?? 'SERVICE'),
    });

    return c.json({
      success: true,
      mode: 'resolver',
      ...(quote as Omit<UnifiedResolverResponse, 'success'>),
      eligibleOffers: (quote.appliedOffers as unknown[]).concat(
        quote.rejectedOffers.map((r) => ({
          offerType: r.offerType ?? r.id,
          label: r.name ?? r.id,
          discountAmount: 0,
          eligible: false,
          reason: r.reason,
        }))
      ),
      winningOffer: quote.winningPromotion,
      ignoredOffers: quote.rejectedOffers,
      reason: quote.displayMessages.find((m) => m.type === 'success')?.message ?? quote.currentPolicy.applicationStrategy,
      customerPays: quote.savings.finalAmount,
      totalSavings: quote.savings.totalSavings,
      vendorFunds: quote.funding?.vendorCost ?? 0,
      platformFunds: quote.funding?.platformCost ?? 0,
      settlementPreview: quote.settlementPreview
        ? JSON.stringify(quote.settlementPreview)
        : 'Settlement preview unavailable',
      input: body,
    });
  });
}
