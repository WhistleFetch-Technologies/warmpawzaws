/**
 * Vendor operational API for canonical meal_subscription_deliveries (session-first).
 */

import { Hono } from 'hono';
import {
  vendorDispatchMealSubscriptionDelivery,
  vendorGetMealSubscriptionDelivery,
  vendorListCanonicalSubscriptionsOverview,
  vendorListMealSubscriptionDeliveries,
  vendorUpdateMealSubscriptionDeliveryStatus,
} from '../services/meal-subscription/meal-subscription-operations-service';

function vendorIdFromRequest(c: {
  req: { param: (k: string) => string; header: (n: string) => string | undefined };
}): { vendorId: string; headerVendor?: string } {
  const vendorId = c.req.param('vendorId');
  const headerVendor = c.req.header('X-Vendor-Id') || c.req.header('x-vendor-id');
  return { vendorId, headerVendor };
}

export function registerMealSubscriptionVendorOperationalEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/meal-subscription-deliveries
   */
  app.get('/vendor/:vendorId/meal-subscription-deliveries', async (c) => {
    const { vendorId, headerVendor } = vendorIdFromRequest(c);
    if (!vendorId) return c.json({ success: false, error: 'vendorId required' }, 400);
    const dateFrom = c.req.query('dateFrom') || undefined;
    const dateTo = c.req.query('dateTo') || undefined;
    const status = c.req.query('status') || undefined;
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    try {
      const { rows, total } = await vendorListMealSubscriptionDeliveries({
        vendorId,
        dateFrom,
        dateTo,
        status,
        limit,
        offset,
      });
      return c.json({
        success: true,
        deliveries: rows,
        total,
        vendorScoped: true,
        headerVendorMatched: !headerVendor || headerVendor === vendorId,
      });
    } catch (e: unknown) {
      console.error('[vendor meal-subscription-deliveries list]', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/meal-subscription-deliveries/:deliveryId
   */
  app.get('/vendor/:vendorId/meal-subscription-deliveries/:deliveryId', async (c) => {
    const { vendorId } = vendorIdFromRequest(c);
    const deliveryId = c.req.param('deliveryId');
    if (!vendorId || !deliveryId) return c.json({ success: false, error: 'Invalid path' }, 400);
    const row = await vendorGetMealSubscriptionDelivery(vendorId, deliveryId);
    if (!row) return c.json({ success: false, error: 'Delivery not found' }, 404);
    return c.json({ success: true, delivery: row });
  });

  /**
   * PATCH /vendor/:vendorId/meal-subscription-deliveries/:deliveryId/status
   */
  app.patch('/vendor/:vendorId/meal-subscription-deliveries/:deliveryId/status', async (c) => {
    try {
      const { vendorId, headerVendor } = vendorIdFromRequest(c);
      const deliveryId = c.req.param('deliveryId');
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const status = String(body.status || '').trim();
      if (!vendorId || !deliveryId || !status) {
        return c.json({ success: false, error: 'vendorId, deliveryId, and status required' }, 400);
      }
      const cancelReason = body.cancelReason != null ? String(body.cancelReason).trim() : undefined;
      const row = await vendorUpdateMealSubscriptionDeliveryStatus({
        vendorIdFromPath: vendorId,
        headerVendorId: headerVendor,
        deliveryId,
        status,
        cancelReason,
      });
      if (!row) return c.json({ success: false, error: 'Delivery not found' }, 404);
      return c.json({ success: true, delivery: row });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return c.json({ success: false, error: err.message || 'Update failed' }, status);
    }
  });

  /**
   * POST /vendor/:vendorId/meal-subscription-deliveries/:deliveryId/dispatch
   * Scaffolding for logistics handoff (Pidge / delivery-service later).
   */
  app.post('/vendor/:vendorId/meal-subscription-deliveries/:deliveryId/dispatch', async (c) => {
    try {
      const { vendorId, headerVendor } = vendorIdFromRequest(c);
      const deliveryId = c.req.param('deliveryId');
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const notes = body.notes != null ? String(body.notes) : undefined;
      if (!vendorId || !deliveryId) {
        return c.json({ success: false, error: 'vendorId and deliveryId required' }, 400);
      }
      const row = await vendorDispatchMealSubscriptionDelivery({
        vendorIdFromPath: vendorId,
        headerVendorId: headerVendor,
        deliveryId,
        notes,
      });
      if (!row) return c.json({ success: false, error: 'Delivery not found' }, 404);
      return c.json({ success: true, delivery: row, dispatched: true });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return c.json({ success: false, error: err.message || 'Dispatch failed' }, status);
    }
  });

  /**
   * GET /vendor/:vendorId/meal-subscriptions-overview
   */
  app.get('/vendor/:vendorId/meal-subscriptions-overview', async (c) => {
    const { vendorId } = vendorIdFromRequest(c);
    if (!vendorId) return c.json({ success: false, error: 'vendorId required' }, 400);
    const rows = await vendorListCanonicalSubscriptionsOverview(vendorId);
    return c.json({ success: true, subscriptions: rows });
  });
}
