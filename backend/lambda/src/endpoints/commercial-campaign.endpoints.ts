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
  type CreateCampaignInput,
  type CampaignLifecycleStatus,
  type OrchestrateCampaignInput,
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
    });
  });

  app.get('/admin/commercial-campaigns/registry', (c) => {
    return c.json({
      success: true,
      campaignTypes: CAMPAIGN_TYPE_REGISTRY,
      templates: listCampaignTemplates(),
      snapshot: globalCampaignRegistry.snapshot(),
    });
  });

  app.get('/admin/commercial-campaigns', async (c) => {
    if (!isCampaignEnabled()) return c.json(disabledResponse(), 503);
    const status = c.req.query('status');
    const vendorId = c.req.query('vendorId') ?? c.req.query('vendor_id');
    const engine = getCampaignEngine();
    const campaigns = await engine.listCampaigns({ status, vendorId });
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
}
