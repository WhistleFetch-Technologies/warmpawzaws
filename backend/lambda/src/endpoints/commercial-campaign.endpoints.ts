/**
 * Commercial Campaign Engine HTTP endpoints.
 * Gated by DISCOUNT_ENGINE_V2_CAMPAIGN_MODE.
 */
import type { Hono } from 'hono';
import {
  getCampaignEngine,
  getCampaignMode,
  isCampaignEnabled,
  isCampaignAuthoritative,
  listCampaignTemplates,
  CAMPAIGN_TYPE_REGISTRY,
  globalCampaignRegistry,
  parseCampaignDiscountDomain,
  listParticipantCampaigns,
  assertParticipantAccess,
  canVendorMutateCampaign,
  type CreateCampaignInput,
  type CampaignLifecycleStatus,
  type OrchestrateCampaignInput,
  type AttachCampaignOffersInput,
  type CampaignDiscountDomain,
} from '../discount-engine/campaign';

function disabledResponse() {
  return {
    success: false,
    error: 'Commercial campaign engine is disabled',
    mode: getCampaignMode(),
  };
}

export function registerCommercialCampaignEndpoints(app: Hono): void {
  app.get('/admin/commercial-campaigns/mode', (c) => {
    return c.json({
      success: true,
      mode: getCampaignMode(),
      enabled: isCampaignEnabled(),
      authoritative: isCampaignAuthoritative(),
      rollout: {
        path: ['OFF', 'SHADOW', 'AUTHORITATIVE'],
        terraformKeys: {
          dev: 'infra/envs/dev/main.tf → DISCOUNT_ENGINE_V2_CAMPAIGN_MODE',
          prod: 'infra/envs/prod/main.tf → DISCOUNT_ENGINE_V2_CAMPAIGN_MODE',
        },
      },
    });
  });

  app.get('/admin/commercial-campaigns/registry', (c) => {
    const discountDomain = parseCampaignDiscountDomain(
      c.req.query('discount_domain') || c.req.query('discountDomain') || c.req.query('domain')
    );
    const surface = String(c.req.query('surface') || '').toLowerCase();
    let templates = listCampaignTemplates();
    if (discountDomain === 'ECOMMERCE' || surface === 'ecommerce') {
      templates = templates.filter((t) => {
        const type = String(t.campaignType || '').toLowerCase();
        return (
          type.includes('market') ||
          type.includes('seller') ||
          type.includes('product') ||
          type.includes('vendor') ||
          Boolean((t as { domain?: string }).domain === 'ecommerce')
        );
      });
    } else if (discountDomain === 'SERVICE' || surface === 'marketing') {
      templates = templates.filter((t) => {
        const type = String(t.campaignType || '').toLowerCase();
        return !(
          type.includes('market') ||
          type.includes('seller') ||
          type.includes('product')
        );
      });
    }
    return c.json({
      success: true,
      campaignTypes: CAMPAIGN_TYPE_REGISTRY,
      templates,
      snapshot: globalCampaignRegistry.snapshot(),
    });
  });

  app.get('/admin/commercial-campaigns', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const status = c.req.query('status');
    const vendorId = c.req.query('vendorId') ?? c.req.query('vendor_id');
    const discountDomain = parseCampaignDiscountDomain(
      c.req.query('discount_domain') || c.req.query('discountDomain') || c.req.query('domain')
    ) as CampaignDiscountDomain | null;
    const surface = c.req.query('surface') || undefined;
    const engine = getCampaignEngine();
    const campaigns = await engine.listCampaigns({
      status,
      vendorId,
      discountDomain: discountDomain ?? undefined,
      surface,
    });
    return c.json({ success: true, mode: getCampaignMode(), campaigns });
  });

  app.get('/admin/commercial-campaigns/:id', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const engine = getCampaignEngine();
    const campaign = await engine.getCampaign(c.req.param('id'));
    if (!campaign) return c.json({ success: false, error: 'Campaign not found' }, 404);
    return c.json({ success: true, campaign });
  });

  app.post('/admin/commercial-campaigns', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const body = (await c.req.json()) as CreateCampaignInput;
      const engine = getCampaignEngine();
      const campaign = await engine.createCampaign(body);
      return c.json({ success: true, mode: getCampaignMode(), campaign }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create campaign';
      return c.json({ success: false, error: message }, 400);
    }
  });

  app.post('/admin/commercial-campaigns/from-template/:templateId', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const overrides = ((await c.req.json().catch(() => ({}))) ?? {}) as Partial<CreateCampaignInput>;
      const engine = getCampaignEngine();
      const campaign = await engine.createFromTemplate(c.req.param('templateId'), overrides);
      return c.json({ success: true, mode: getCampaignMode(), campaign }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create from template';
      return c.json({ success: false, error: message }, 400);
    }
  });

  app.post('/admin/commercial-campaigns/:id/orchestrate', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const body = ((await c.req.json().catch(() => ({}))) ?? {}) as OrchestrateCampaignInput;
      const engine = getCampaignEngine();
      const result = await engine.orchestrateCampaign(c.req.param('id'), body);
      if (!result) return c.json(disabledResponse(), 503);
      return c.json({ success: true, mode: getCampaignMode(), ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Orchestration failed';
      return c.json({ success: false, error: message }, 400);
    }
  });

  app.post('/admin/commercial-campaigns/:id/links', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const body = ((await c.req.json().catch(() => ({}))) ?? {}) as AttachCampaignOffersInput;
      const engine = getCampaignEngine();
      const result = await engine.attachOffers(c.req.param('id'), body);
      if (!result) return c.json({ success: false, error: 'Campaign not found' }, 404);
      return c.json({ success: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Attach failed';
      return c.json({ success: false, error: message }, 400);
    }
  });

  app.delete('/admin/commercial-campaigns/:id/links', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const promotionId = c.req.query('promotionId') ?? c.req.query('promotion_id');
      const couponId = c.req.query('couponId') ?? c.req.query('coupon_id');
      const engine = getCampaignEngine();
      const ok = await engine.detachOffer(c.req.param('id'), {
        promotionId: promotionId || undefined,
        couponId: couponId || undefined,
      });
      if (!ok) return c.json({ success: false, error: 'Link not found' }, 404);
      return c.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Detach failed';
      return c.json({ success: false, error: message }, 400);
    }
  });

  app.post('/admin/commercial-campaigns/:id/lifecycle/:status', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const status = c.req.param('status') as CampaignLifecycleStatus;
      const engine = getCampaignEngine();
      const campaign = await engine.transitionLifecycle(c.req.param('id'), status);
      if (!campaign) return c.json({ success: false, error: 'Campaign not found' }, 404);
      return c.json({ success: true, campaign });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lifecycle transition failed';
      return c.json({ success: false, error: message }, 400);
    }
  });

  app.post('/admin/commercial-campaigns/:id/spend', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const body = (await c.req.json()) as { amount?: number };
      const engine = getCampaignEngine();
      const campaign = await engine.recordCampaignSpend(
        c.req.param('id'),
        Number(body.amount ?? 0)
      );
      if (!campaign) return c.json({ success: false, error: 'Campaign not found' }, 404);
      return c.json({ success: true, campaign });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Spend record failed';
      return c.json({ success: false, error: message }, 400);
    }
  });

  app.get('/admin/commercial-campaigns/:id/analytics', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const engine = getCampaignEngine();
    const analytics = await engine.getCampaignAnalytics(c.req.param('id'));
    if (!analytics) return c.json({ success: false, error: 'Campaign not found' }, 404);
    return c.json({ success: true, analytics });
  });

  app.get('/admin/commercial-campaigns/:id/settlement-attribution', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const engine = getCampaignEngine();
    const attribution = await engine.getSettlementAttribution(c.req.param('id'));
    if (!attribution) return c.json({ success: false, error: 'Campaign not found' }, 404);
    return c.json({ success: true, attribution });
  });

  app.get('/admin/commercial-campaigns/:id/validate', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const engine = getCampaignEngine();
    const validation = await engine.validateForPublish(c.req.param('id'));
    if (!validation) return c.json({ success: false, error: 'Campaign not found' }, 404);
    return c.json({ success: true, validation });
  });

  app.get('/admin/commercial-campaigns/:id/health', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const engine = getCampaignEngine();
    const health = await engine.getHealth(c.req.param('id'));
    if (!health) return c.json({ success: false, error: 'Campaign not found' }, 404);
    return c.json({ success: true, health });
  });

  app.post('/admin/commercial-campaigns/:id/duplicate', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    try {
      const body = ((await c.req.json().catch(() => ({}))) ?? {}) as {
        includeSchedule?: boolean;
        nameSuffix?: string;
      };
      const engine = getCampaignEngine();
      const campaign = await engine.duplicateCampaign(c.req.param('id'), body);
      if (!campaign) return c.json({ success: false, error: 'Campaign not found' }, 404);
      return c.json({ success: true, campaign }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Duplicate failed';
      return c.json({ success: false, error: message }, 400);
    }
  });
}

/**
 * Vendor / Seller participant visibility — same Commercial Campaign Engine, read-only by default.
 * Mutating actions only when campaign.vendor_id matches the authenticated vendor.
 */
export function registerVendorCommercialCampaignEndpoints(app: Hono): void {
  const listHandler = async (c: any) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const vendorId = c.req.param('vendorId');
    const discountDomain = parseCampaignDiscountDomain(
      c.req.query('discount_domain') || c.req.query('discountDomain') || c.req.query('domain')
    ) as CampaignDiscountDomain | null;
    const surface = c.req.query('surface') || undefined;
    const campaigns = await listParticipantCampaigns({
      vendorId,
      discountDomain: discountDomain ?? undefined,
      surface,
      includeHealth: true,
    });
    return c.json({ success: true, mode: getCampaignMode(), campaigns });
  };

  app.get('/vendor/:vendorId/commercial-campaigns', listHandler);
  app.get('/seller/:vendorId/commercial-campaigns', listHandler);

  app.get('/vendor/:vendorId/commercial-campaigns/mode', (c) => {
    return c.json({
      success: true,
      mode: getCampaignMode(),
      enabled: isCampaignEnabled(),
      authoritative: isCampaignAuthoritative(),
    });
  });

  app.get('/vendor/:vendorId/commercial-campaigns/:id', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const view = await assertParticipantAccess(c.req.param('id'), c.req.param('vendorId'));
    if (!view) return c.json({ success: false, error: 'Campaign not found or not enrolled' }, 404);
    return c.json({ success: true, campaign: view });
  });

  app.get('/vendor/:vendorId/commercial-campaigns/:id/analytics', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const view = await assertParticipantAccess(c.req.param('id'), c.req.param('vendorId'));
    if (!view) return c.json({ success: false, error: 'Campaign not found or not enrolled' }, 404);
    const engine = getCampaignEngine();
    const analytics = await engine.getCampaignAnalytics(c.req.param('id'));
    return c.json({ success: true, analytics, participantRelation: view.participantRelation });
  });

  app.get('/vendor/:vendorId/commercial-campaigns/:id/health', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const view = await assertParticipantAccess(c.req.param('id'), c.req.param('vendorId'));
    if (!view) return c.json({ success: false, error: 'Campaign not found or not enrolled' }, 404);
    return c.json({ success: true, health: view.health });
  });

  /** Vendor-owned mutations only — participants are read-only. */
  app.post('/vendor/:vendorId/commercial-campaigns/:id/lifecycle/:status', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const vendorId = c.req.param('vendorId');
    const view = await assertParticipantAccess(c.req.param('id'), vendorId);
    if (!view) return c.json({ success: false, error: 'Campaign not found or not enrolled' }, 404);
    if (!canVendorMutateCampaign(view, vendorId)) {
      return c.json(
        {
          success: false,
          error: 'Only the campaign owner can change lifecycle. Participants have read-only access.',
        },
        403
      );
    }
    try {
      const engine = getCampaignEngine();
      const campaign = await engine.transitionLifecycle(
        c.req.param('id'),
        c.req.param('status') as CampaignLifecycleStatus
      );
      return c.json({ success: true, campaign });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lifecycle transition failed';
      return c.json({ success: false, error: message }, 400);
    }
  });
}
