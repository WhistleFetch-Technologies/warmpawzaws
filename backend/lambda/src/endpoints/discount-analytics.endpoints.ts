/**
 * Discount Engine V2 — Analytics HTTP endpoints (read-only).
 * Gated by DISCOUNT_ENGINE_V2_ANALYTICS_MODE.
 */
import type { Hono } from 'hono';
import {
  getAnalyticsEngine,
  getAnalyticsMode,
  isAnalyticsPubliclyExposed,
  isAnalyticsEnabled,
  type AnalyticsFilters,
  type AnalyticsDomainFilter,
} from '../discount-engine/analytics';

function parseFilters(c: { req: { query: (k: string) => string | undefined } }): AnalyticsFilters {
  const domain = (c.req.query('domain') ?? 'ALL').toUpperCase() as AnalyticsDomainFilter;
  return {
    domain,
    vendorId: c.req.query('vendorId') ?? c.req.query('vendor_id'),
    customerId: c.req.query('customerId') ?? c.req.query('customer_id'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined,
  };
}

function analyticsDisabledResponse() {
  return {
    success: false,
    error: 'Analytics engine is disabled',
    mode: getAnalyticsMode(),
  };
}

function shadowNotExposedResponse() {
  return {
    success: false,
    error: 'Analytics available in SHADOW mode only — not publicly exposed',
    mode: 'SHADOW',
  };
}

export function registerDiscountAnalyticsEndpoints(app: Hono) {
  /**
   * GET /admin/analytics/discount-engine/overview
   * Full analytics report — AUTHORITATIVE mode only for HTTP response.
   */
  app.get('/admin/analytics/discount-engine/overview', async (c) => {
    if (!isAnalyticsEnabled()) {
      return c.json(analyticsDisabledResponse(), 503);
    }
    if (!isAnalyticsPubliclyExposed()) {
      await getAnalyticsEngine().generateReport(parseFilters(c));
      return c.json(shadowNotExposedResponse(), 403);
    }

    const report = await getAnalyticsEngine().generateReport(parseFilters(c));
    return c.json({ success: true, mode: getAnalyticsMode(), report });
  });

  /**
   * GET /admin/analytics/discount-engine/promotions
   * Promotion performance — extends data from promotion_usages (same source as /admin/promotions/stats).
   */
  app.get('/admin/analytics/discount-engine/promotions', async (c) => {
    if (!isAnalyticsEnabled()) return c.json(analyticsDisabledResponse(), 503);
    const filters = parseFilters(c);
    const report = await getAnalyticsEngine().generateReport(filters);
    if (!isAnalyticsPubliclyExposed()) {
      return c.json(shadowNotExposedResponse(), 403);
    }
    return c.json({ success: true, promotions: report?.promotions, audit: report?.audit });
  });

  /**
   * GET /admin/analytics/discount-engine/coupons
   */
  app.get('/admin/analytics/discount-engine/coupons', async (c) => {
    if (!isAnalyticsEnabled()) return c.json(analyticsDisabledResponse(), 503);
    const report = await getAnalyticsEngine().generateReport(parseFilters(c));
    if (!isAnalyticsPubliclyExposed()) {
      return c.json(shadowNotExposedResponse(), 403);
    }
    return c.json({ success: true, coupons: report?.coupons, audit: report?.audit });
  });

  /**
   * GET /admin/analytics/discount-engine/vendors
   * GET /admin/analytics/discount-engine/vendors/:vendorId
   */
  app.get('/admin/analytics/discount-engine/vendors/:vendorId?', async (c) => {
    if (!isAnalyticsEnabled()) return c.json(analyticsDisabledResponse(), 503);
    const filters = parseFilters(c);
    const vendorId = c.req.param('vendorId');
    if (vendorId) filters.vendorId = vendorId;
    const report = await getAnalyticsEngine().generateReport(filters);
    if (!isAnalyticsPubliclyExposed()) {
      return c.json(shadowNotExposedResponse(), 403);
    }
    return c.json({ success: true, vendors: report?.vendors, audit: report?.audit });
  });

  /**
   * GET /admin/analytics/discount-engine/savings
   */
  app.get('/admin/analytics/discount-engine/savings', async (c) => {
    if (!isAnalyticsEnabled()) return c.json(analyticsDisabledResponse(), 503);
    const report = await getAnalyticsEngine().generateReport(parseFilters(c));
    if (!isAnalyticsPubliclyExposed()) {
      return c.json(shadowNotExposedResponse(), 403);
    }
    return c.json({ success: true, savings: report?.savings, audit: report?.audit });
  });

  /**
   * GET /admin/analytics/discount-engine/mode
   * Diagnostics — always available to admins.
   */
  app.get('/admin/analytics/discount-engine/mode', async (c) => {
    return c.json({
      success: true,
      mode: getAnalyticsMode(),
      enabled: isAnalyticsEnabled(),
      publiclyExposed: isAnalyticsPubliclyExposed(),
    });
  });
}
