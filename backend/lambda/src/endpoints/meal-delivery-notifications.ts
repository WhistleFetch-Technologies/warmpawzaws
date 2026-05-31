/**
 * Internal meal delivery notification ingress (Java delivery-service → Lambda FCM).
 */

import { Hono } from 'hono';
import {
  isMealNotifyEventType,
  notifyMealEvent,
  type MealNotifyRecipientType,
} from '../utils/meal-delivery-notifications';

function internalMealNotifyAuthorized(c: {
  req: { header: (n: string) => string | undefined };
}): boolean {
  const secret = process.env.MEAL_DELIVERY_NOTIFY_SECRET?.trim();
  if (!secret) return false;
  const hdr =
    c.req.header('x-meal-delivery-notify-secret') ||
    c.req.header('X-Meal-Delivery-Notify-Secret') ||
    '';
  return hdr === secret;
}

export function registerMealDeliveryNotificationEndpoints(app: Hono) {
  /**
   * POST /internal/meal-delivery/notify
   * Called by delivery-service after Pidge webhook persists meal hyperlocal tracking.
   */
  app.post('/internal/meal-delivery/notify', async (c) => {
    if (!internalMealNotifyAuthorized(c)) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const legacyCustomerId = String(body.customerId || '').trim();
      const recipientType = (String(body.recipientType || 'customer').trim() ||
        'customer') as MealNotifyRecipientType;
      const recipientId = String(
        body.recipientId || (recipientType === 'customer' ? legacyCustomerId : body.vendorId) || '',
      ).trim();
      const orderId = String(body.orderId || '').trim();
      const eventType = String(body.eventType || '').trim();

      if (!recipientId || !eventType || !isMealNotifyEventType(eventType)) {
        return c.json(
          {
            success: false,
            error: 'recipientId, valid eventType, and orderId (or subscriptionId) are required',
          },
          400,
        );
      }

      const subscriptionId = body.subscriptionId != null ? String(body.subscriptionId) : undefined;
      if (!orderId && !subscriptionId) {
        return c.json(
          { success: false, error: 'orderId or subscriptionId is required' },
          400,
        );
      }

      const result = await notifyMealEvent({
        recipientId,
        recipientType,
        eventType,
        relatedId: orderId || subscriptionId,
        dedupeScopeId: orderId || subscriptionId,
        orderId: orderId || undefined,
        orderNumber: body.orderNumber != null ? String(body.orderNumber) : undefined,
        subscriptionId,
        vendorName: body.vendorName != null ? String(body.vendorName) : undefined,
        customerName: body.customerName != null ? String(body.customerName) : undefined,
        riderName: body.riderName != null ? String(body.riderName) : undefined,
        reason: body.reason != null ? String(body.reason) : undefined,
        deliveryTrackingId:
          body.deliveryTrackingId != null ? String(body.deliveryTrackingId) : undefined,
        pidgeOrderId: body.pidgeOrderId != null ? String(body.pidgeOrderId) : undefined,
        logisticsStatus: body.logisticsStatus != null ? String(body.logisticsStatus) : undefined,
        mealPlanName: body.mealPlanName != null ? String(body.mealPlanName) : undefined,
      });

      return c.json({ success: true, ...result });
    } catch (e: unknown) {
      console.error('[internal/meal-delivery/notify]', e);
      return c.json(
        { success: false, error: (e as Error).message || 'Notify failed' },
        500,
      );
    }
  });
}
