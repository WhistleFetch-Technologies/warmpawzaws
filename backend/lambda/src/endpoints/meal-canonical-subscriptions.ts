/**
 * Canonical meal subscription HTTP API (P1).
 * Paths under /meal/subscriptions — distinct from legacy /meals/subscriptions.
 */

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  createCanonicalSubscription,
  findSubscriptionByClientRequestKey,
  listCanonicalDeliveriesForCustomer,
  runRollingSessionGenerationJob,
  type CreateCanonicalSubscriptionInput,
  type SubscriptionDeliveryScheduleInput,
} from '../services/meal-subscription/meal-subscription-canonical-service';
import { assertVendorAcceptingMealOrders } from '../utils/meal-kitchen-availability';
import { resolveMealPlanOrProductById } from '../utils/meal-plan-resolve';
import { fireVendorMealSubscriptionScheduledSms } from '../lib/vendor-appointment-sms';
import {
  notifyMealSubscriptionLifecycle,
  notifyVendorMealSubscriptionActive,
} from '../utils/meal-delivery-notifications';
import {
  activateCanonicalSubscriptionAfterPayment,
  applyWalletDebitToPendingMealSubscription,
  enrichSubscriptionRowsWithPresignedMealImages,
  getCanonicalSubscriptionDetailForCustomer,
  listCanonicalSubscriptionsForCustomer,
  pauseCanonicalSubscription,
  rescheduleCanonicalDeliverySession,
  resumeCanonicalSubscription,
  setMealSubscriptionCheckoutRazorpayOrder,
  skipCanonicalDeliverySession,
  type MealSubscriptionLifecycleFilter,
} from '../services/meal-subscription/meal-subscription-operations-service';
import { CANONICAL_RECURRING_PURCHASE_TYPES } from '../constants/meal-subscription-canonical';

function parseJsonBody<T extends Record<string, unknown>>(c: { req: { json: () => Promise<unknown> } }): Promise<T> {
  return c.req.json() as Promise<T>;
}

function jobAuthorized(c: { req: { header: (n: string) => string | undefined } }): boolean {
  const secret = process.env.MEAL_SUBSCRIPTION_JOB_SECRET?.trim();
  if (!secret) return false;
  const hdr =
    c.req.header('x-meal-subscription-job-secret') ||
    c.req.header('X-Meal-Subscription-Job-Secret') ||
    '';
  return hdr === secret;
}

export function registerMealCanonicalSubscriptionEndpoints(app: Hono) {
  /**
   * POST /meal/subscriptions
   * Creates canonical subscription + rolling sessions when lifecycle is active.
   */
  app.post('/meal/subscriptions', async (c) => {
    try {
      const body = await parseJsonBody<Record<string, unknown>>(c);
      const purchaseType = String(body.purchaseType || '').toUpperCase();
      if (!CANONICAL_RECURRING_PURCHASE_TYPES.includes(purchaseType as 'WEEKLY_PLAN' | 'MONTHLY_PLAN')) {
        return c.json({ success: false, error: 'purchaseType must be WEEKLY_PLAN or MONTHLY_PLAN' }, 400);
      }

      const clientRequestKey = String(body.clientRequestKey || '').trim();
      if (!clientRequestKey) {
        return c.json({ success: false, error: 'clientRequestKey is required' }, 400);
      }

      const existing = await findSubscriptionByClientRequestKey(clientRequestKey);
      if (existing) {
        return c.json({
          success: true,
          idempotent: true,
          subscription: existing,
          deliveriesInserted: 0,
        });
      }

      const slot = body.deliveryTimeSlot as { start?: string; end?: string } | undefined;
      if (!slot?.start) {
        return c.json({ success: false, error: 'deliveryTimeSlot.start is required' }, 400);
      }

      const firstDeliveryDate = String(body.firstDeliveryDate || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDeliveryDate)) {
        return c.json({ success: false, error: 'firstDeliveryDate must be YYYY-MM-DD' }, 400);
      }

      const deliveryAddress = body.deliveryAddress;
      if (!deliveryAddress || typeof deliveryAddress !== 'object') {
        return c.json({ success: false, error: 'deliveryAddress object is required' }, 400);
      }

      const ds = body.deliverySchedule;
      let deliverySchedule: SubscriptionDeliveryScheduleInput | undefined;
      if (ds && typeof ds === 'object' && !Array.isArray(ds)) {
        const dso = ds as Record<string, unknown>;
        deliverySchedule = {
          weeklyPattern: dso.weeklyPattern as SubscriptionDeliveryScheduleInput['weeklyPattern'],
          weekdays: Array.isArray(dso.weekdays) ? dso.weekdays.map((x) => String(x)) : undefined,
          customerInstructions:
            dso.customerInstructions != null ? String(dso.customerInstructions) : undefined,
          monthlyMode: dso.monthlyMode as SubscriptionDeliveryScheduleInput['monthlyMode'],
        };
      }

      const input: CreateCanonicalSubscriptionInput = {
        clientRequestKey,
        customerId: body.customerId != null ? String(body.customerId) : undefined,
        customerPhone: body.customerPhone != null ? String(body.customerPhone) : undefined,
        mealPlanId: String(body.mealPlanId || ''),
        purchaseType: purchaseType as CreateCanonicalSubscriptionInput['purchaseType'],
        deliveryAddress: deliveryAddress as Record<string, unknown>,
        firstDeliveryDate,
        deliveryTimeSlot: { start: slot.start, end: slot.end },
        deliverySchedule,
        totalSessions:
          body.totalSessions === null || body.totalSessions === undefined
            ? undefined
            : Number(body.totalSessions),
        autoRenew: Boolean(body.autoRenew),
        paymentStatus: body.paymentStatus === 'pending' ? 'pending' : 'paid',
        quantity: body.quantity != null ? Number(body.quantity) : undefined,
        petId: body.petId != null ? String(body.petId) : null,
        initialPaymentAmount:
          body.initialPaymentAmount != null ? Number(body.initialPaymentAmount) : undefined,
        razorpayPaymentId:
          body.razorpayPaymentId != null ? String(body.razorpayPaymentId) : undefined,
        razorpayOrderId: body.razorpayOrderId != null ? String(body.razorpayOrderId) : undefined,
      };

      if (!input.mealPlanId) {
        return c.json({ success: false, error: 'mealPlanId is required' }, 400);
      }

      const planRow = await resolveMealPlanOrProductById(input.mealPlanId);
      const planVendorId = planRow?.vendor_id != null ? String(planRow.vendor_id) : '';
      if (planVendorId) {
        const kitchenGate = await assertVendorAcceptingMealOrders(planVendorId);
        if (!kitchenGate.allowed) {
          return c.json(
            { success: false, error: kitchenGate.message, code: kitchenGate.code },
            403,
          );
        }
      }

      const { subscription, deliveriesInserted } = await createCanonicalSubscription(input);

      if (String(subscription.lifecycle_status || '') === 'active') {
        fireVendorMealSubscriptionScheduledSms(
          String(subscription.id || ''),
          String(subscription.vendor_id || planVendorId || '')
        );
      }

      return c.json({
        success: true,
        subscription,
        deliveriesInserted,
      });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number; code?: string; expected?: string };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      console.error('[meal/subscriptions] POST error:', e);
      return c.json(
        {
          success: false,
          error: err.message || 'Failed to create subscription',
          code: err.code,
          expectedPurchaseType: err.expected,
        },
        status as ContentfulStatusCode,
      );
    }
  });

  /**
   * GET /meal/subscriptions?customerId=&lifecycle=
   * List recurring meal subscriptions for customer (must precede :id route).
   */
  app.get('/meal/subscriptions', async (c) => {
    const customerId = c.req.query('customerId');
    if (!customerId) {
      return c.json({ success: false, error: 'customerId query parameter is required' }, 400);
    }
    const lifecycle = (c.req.query('lifecycle') || 'all') as MealSubscriptionLifecycleFilter;
    const rows = await listCanonicalSubscriptionsForCustomer(customerId, lifecycle);
    await enrichSubscriptionRowsWithPresignedMealImages(rows);
    return c.json({ success: true, subscriptions: rows });
  });

  /**
   * GET /meal/subscriptions/:id?customerId=
   */
  app.get('/meal/subscriptions/:id', async (c) => {
    const id = c.req.param('id');
    const customerId = c.req.query('customerId');
    if (!customerId) {
      return c.json({ success: false, error: 'customerId query parameter is required' }, 400);
    }
    const row = await getCanonicalSubscriptionDetailForCustomer(id, customerId);
    if (!row) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }
    return c.json({ success: true, subscription: row });
  });

  /**
   * GET /meal/subscriptions/:id/deliveries?customerId=&limit=&offset=
   */
  app.get('/meal/subscriptions/:id/deliveries', async (c) => {
    const id = c.req.param('id');
    const customerId = c.req.query('customerId');
    if (!customerId) {
      return c.json({ success: false, error: 'customerId query parameter is required' }, 400);
    }
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const { rows, total } = await listCanonicalDeliveriesForCustomer(id, customerId, limit, offset);
    return c.json({
      success: true,
      deliveries: rows,
      total,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  });

  /**
   * POST /meal/subscriptions/:id/wallet-debit
   * Apply wallet balance toward pending initial payment (idempotent).
   */
  app.post('/meal/subscriptions/:id/wallet-debit', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await parseJsonBody<Record<string, unknown>>(c);
      const customerId = String(body.customerId || '').trim();
      const amountInRupees = Number(body.amountInRupees);
      const idempotencyKey = String(body.idempotencyKey || '').trim();
      if (!customerId) {
        return c.json({ success: false, error: 'customerId is required' }, 400);
      }
      if (!idempotencyKey) {
        return c.json({ success: false, error: 'idempotencyKey is required' }, 400);
      }
      const result = await applyWalletDebitToPendingMealSubscription(id, customerId, amountInRupees, idempotencyKey);
      if (!result.success) {
        return c.json({ success: false, error: result.error || 'Wallet debit failed' }, 400);
      }
      return c.json({
        success: true,
        debited: result.debited,
        remainderInRupees: result.remainderInRupees,
        balanceAfter: result.balanceAfter,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      return c.json({ success: false, error: err.message || 'Wallet debit failed' }, 500);
    }
  });

  /**
   * POST /meal/subscriptions/:id/checkout-order
   * Attach Razorpay order id to pending initial payment (after split with wallet).
   */
  app.post('/meal/subscriptions/:id/checkout-order', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await parseJsonBody<Record<string, unknown>>(c);
      const customerId = String(body.customerId || '').trim();
      const razorpayOrderId = String(body.razorpayOrderId || '').trim();
      if (!customerId || !razorpayOrderId) {
        return c.json({ success: false, error: 'customerId and razorpayOrderId are required' }, 400);
      }
      const ok = await setMealSubscriptionCheckoutRazorpayOrder(id, customerId, razorpayOrderId);
      if (!ok) {
        return c.json({ success: false, error: 'Could not attach order (check subscription state)' }, 400);
      }
      return c.json({ success: true });
    } catch (e: unknown) {
      const err = e as { message?: string };
      return c.json({ success: false, error: err.message || 'Failed' }, 500);
    }
  });

  /**
   * POST /meal/subscriptions/:id/confirm-payment
   * Activates pending_payment subscription after Razorpay succeeds.
   */
  app.post('/meal/subscriptions/:id/confirm-payment', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await parseJsonBody<Record<string, unknown>>(c);
      const customerId = String(body.customerId || '').trim();
      if (!customerId) {
        return c.json({ success: false, error: 'customerId is required' }, 400);
      }
      const razorpayPaymentId =
        body.razorpayPaymentId != null ? String(body.razorpayPaymentId) : undefined;
      const sub = await activateCanonicalSubscriptionAfterPayment(id, customerId, razorpayPaymentId);
      if (!sub) {
        return c.json({ success: false, error: 'Subscription not found' }, 404);
      }
      fireVendorMealSubscriptionScheduledSms(String(sub.id || id), String(sub.vendor_id || ''));
      void notifyVendorMealSubscriptionActive(String(sub.id || id)).catch((e) =>
        console.warn('[meal/subscriptions/confirm-payment] notify failed:', e),
      );
      return c.json({ success: true, subscription: sub });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return c.json({ success: false, error: err.message || 'Confirm failed' }, status as ContentfulStatusCode);
    }
  });

  /**
   * POST /meal/subscriptions/:id/pause
   */
  app.post('/meal/subscriptions/:id/pause', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await parseJsonBody<Record<string, unknown>>(c).catch((): Record<string, unknown> => ({}));
      const customerId = String(body.customerId || c.req.query('customerId') || '').trim();
      if (!customerId) {
        return c.json({ success: false, error: 'customerId is required' }, 400);
      }
      const sub = await pauseCanonicalSubscription(id, customerId);
      if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);
      void notifyMealSubscriptionLifecycle(id, 'paused').catch((e) =>
        console.warn('[meal/subscriptions/pause] notify failed:', e),
      );
      return c.json({ success: true, subscription: sub });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return c.json({ success: false, error: err.message || 'Pause failed' }, status as ContentfulStatusCode);
    }
  });

  /**
   * POST /meal/subscriptions/:id/resume
   */
  app.post('/meal/subscriptions/:id/resume', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await parseJsonBody<Record<string, unknown>>(c).catch((): Record<string, unknown> => ({}));
      const customerId = String(body.customerId || c.req.query('customerId') || '').trim();
      if (!customerId) {
        return c.json({ success: false, error: 'customerId is required' }, 400);
      }
      const sub = await resumeCanonicalSubscription(id, customerId);
      if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);
      void notifyMealSubscriptionLifecycle(id, 'resumed').catch((e) =>
        console.warn('[meal/subscriptions/resume] notify failed:', e),
      );
      return c.json({ success: true, subscription: sub });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return c.json({ success: false, error: err.message || 'Resume failed' }, status as ContentfulStatusCode);
    }
  });

  /**
   * POST /meal/subscription-deliveries/:deliveryId/skip
   */
  app.post('/meal/subscription-deliveries/:deliveryId/skip', async (c) => {
    try {
      const deliveryId = c.req.param('deliveryId');
      const body = await parseJsonBody<Record<string, unknown>>(c);
      const customerId = String(body.customerId || '').trim();
      if (!customerId) {
        return c.json({ success: false, error: 'customerId is required' }, 400);
      }
      const row = await skipCanonicalDeliverySession(
        deliveryId,
        customerId,
        body.reason != null ? String(body.reason) : undefined,
      );
      if (!row) return c.json({ success: false, error: 'Delivery not found' }, 404);
      return c.json({ success: true, delivery: row });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return c.json({ success: false, error: err.message || 'Skip failed' }, status as ContentfulStatusCode);
    }
  });

  /**
   * POST /meal/subscription-deliveries/:deliveryId/reschedule
   */
  app.post('/meal/subscription-deliveries/:deliveryId/reschedule', async (c) => {
    try {
      const deliveryId = c.req.param('deliveryId');
      const body = await parseJsonBody<Record<string, unknown>>(c);
      const customerId = String(body.customerId || '').trim();
      const newDeliveryDate = String(body.newDeliveryDate || '').trim();
      if (!customerId) {
        return c.json({ success: false, error: 'customerId is required' }, 400);
      }
      const row = await rescheduleCanonicalDeliverySession(deliveryId, customerId, newDeliveryDate);
      if (!row) return c.json({ success: false, error: 'Delivery not found' }, 404);
      return c.json({ success: true, delivery: row });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return c.json({ success: false, error: err.message || 'Reschedule failed' }, status as ContentfulStatusCode);
    }
  });

  /**
   * POST /internal/meal/subscriptions/generate-sessions
   * Rolling session replenishment (cron / manual).
   */
  app.post('/internal/meal/subscriptions/generate-sessions', async (c) => {
    if (!jobAuthorized(c)) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    try {
      const body = await parseJsonBody<Record<string, unknown>>(c).catch((): Record<string, unknown> => ({}));
      const horizonDays =
        body.horizonDays != null ? Math.min(120, Math.max(7, Number(body.horizonDays))) : undefined;
      const subscriptionId =
        body.subscriptionId != null ? String(body.subscriptionId) : undefined;

      const result = await runRollingSessionGenerationJob({ horizonDays, subscriptionId });

      return c.json({
        success: true,
        processed: result.processed,
        deliveriesInserted: result.totalInserted,
      });
    } catch (e: unknown) {
      console.error('[internal/meal/subscriptions/generate-sessions]', e);
      return c.json({ success: false, error: (e as Error).message || 'Job failed' }, 500);
    }
  });
}
