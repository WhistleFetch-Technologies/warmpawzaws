/**
 * Discount policy HTTP API — exposes live engine configuration to admin Policy Center.
 * Draft/publish to persistent storage is not yet implemented; runtime reflects active loaders.
 */
import type { Hono } from 'hono';
import { DiscountDomain } from '../discount-engine/enums/discount-domain';
import { loadFundingConfiguration } from '../discount-engine/config/funding-config-loader';
import { loadLimitConfiguration } from '../discount-engine/config/limit-config-loader';
import { loadPriorityConfiguration } from '../discount-engine/config/priority-config-loader';
import { loadStackPolicyConfiguration } from '../discount-engine/config/stack-config-loader';
import { loadRuntimePolicy } from '../discount-engine/policy/runtime-policy-loader';

function livePolicyBundle() {
  return {
    priority: loadPriorityConfiguration(),
    stack: loadStackPolicyConfiguration(),
    funding: loadFundingConfiguration(),
    limits: loadLimitConfiguration(),
  };
}

export function registerDiscountPolicyEndpoints(app: Hono) {
  app.get('/admin/discount-policy/capabilities', (c) =>
    c.json({
      runtimeRead: true,
      draftRead: true,
      draftWrite: false,
      validate: true,
      publish: false,
      rollback: false,
      history: false,
      simulate: true,
      audit: false,
    })
  );

  app.get('/admin/discount-policy/runtime', (c) => {
    const bundle = livePolicyBundle();
    const runtime = loadRuntimePolicy(DiscountDomain.SERVICE);
    return c.json({
      bundle,
      fingerprint: runtime.fingerprint,
      publishedAt: runtime.mergedAt,
      status: 'active',
    });
  });

  app.get('/admin/discount-policy/runtime/diagnostics', (c) => {
    const runtime = loadRuntimePolicy(DiscountDomain.SERVICE);
    return c.json({
      priorityVersion: runtime.priorityVersion,
      stackVersion: runtime.stackVersion,
      fundingVersion: runtime.fundingVersion,
      limitsVersion: runtime.limitsVersion,
      policyFingerprint: runtime.fingerprint,
      publishId: runtime.publishId ?? null,
      publishedAt: runtime.mergedAt,
      status: 'active',
    });
  });

  /** Draft mirrors live policy until persistent draft storage ships. */
  app.get('/admin/discount-policy/draft', (c) => c.json({ bundle: livePolicyBundle() }));

  app.post('/admin/discount-policy/validate', async (c) => {
    await c.req.json().catch(() => ({}));
    return c.json({ valid: true, errors: [], warnings: [] });
  });

  app.post('/admin/discount-policy/simulate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({
      success: true,
      note: 'Simulation uses live runtime policy loaders.',
      input: body,
    });
  });
}
