/**
 * Meal refund review cases — internal ingress (Java) + admin review APIs.
 */

import { Hono } from 'hono';
import {
  approveMealRefundCase,
  backfillMealRefundCaseByOrderRef,
  createMealRefundCaseOnPidgeCancel,
  getMealRefundCaseDetail,
  listMealRefundCases,
  rejectMealRefundCase,
} from '../utils/meal-refund-cases';

function internalMealRefundAuthorized(c: {
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

function adminReviewerId(c: { get: (k: string) => unknown }): string {
  return String(c.get('userId') || c.get('userEmail') || 'admin');
}

export function registerMealRefundCaseEndpoints(app: Hono) {
  app.post('/internal/meal-refund-cases/on-pidge-cancel', async (c) => {
    if (!internalMealRefundAuthorized(c)) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const mealOrderId = String(body.mealOrderId || '').trim();
      if (!mealOrderId) {
        return c.json({ success: false, error: 'mealOrderId is required' }, 400);
      }
      const result = await createMealRefundCaseOnPidgeCancel({
        mealOrderId,
        pidgeOrderId: body.pidgeOrderId != null ? String(body.pidgeOrderId) : null,
        cancellationReason:
          body.cancellationReason != null ? String(body.cancellationReason) : null,
        webhookEventId: body.webhookEventId != null ? String(body.webhookEventId) : null,
      });
      return c.json({ success: true, ...result });
    } catch (e: unknown) {
      console.error('[internal/meal-refund-cases/on-pidge-cancel]', e);
      return c.json(
        { success: false, error: (e as Error).message || 'Failed' },
        500,
      );
    }
  });

  app.get('/admin/meal-refund-cases', async (c) => {
    try {
      const status = c.req.query('status');
      const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;
      const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined;
      const { cases, total } = await listMealRefundCases({ status, limit, offset });
      return c.json({ success: true, cases, total, limit: limit ?? 25, offset: offset ?? 0 });
    } catch (e: unknown) {
      console.error('[admin/meal-refund-cases] list', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.post('/admin/meal-refund-cases/backfill', async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as {
        orderNumber?: string;
        order_number?: string;
        mealOrderId?: string;
      };
      const orderRef = String(
        body.orderNumber || body.order_number || body.mealOrderId || '',
      ).trim();
      if (!orderRef) {
        return c.json({ success: false, error: 'orderNumber or mealOrderId is required' }, 400);
      }
      const result = await backfillMealRefundCaseByOrderRef(orderRef);
      return c.json({ success: true, ...result });
    } catch (e: unknown) {
      console.error('[admin/meal-refund-cases/backfill]', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.get('/admin/meal-refund-cases/:id', async (c) => {
    try {
      const detail = await getMealRefundCaseDetail(c.req.param('id'));
      if (!detail) {
        return c.json({ success: false, error: 'Case not found' }, 404);
      }
      return c.json({ success: true, case: detail });
    } catch (e: unknown) {
      console.error('[admin/meal-refund-cases] detail', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.post('/admin/meal-refund-cases/:id/approve', async (c) => {
    try {
      const result = await approveMealRefundCase(c.req.param('id'), adminReviewerId(c));
      if (!result.ok) {
        const code = result.alreadyProcessed ? 409 : 404;
        return c.json({ success: false, error: result.error, ...result }, code);
      }
      return c.json({
        success: true,
        status: result.status ?? 'refund_processing',
        refundsRowId: result.refundsRowId,
        razorpayRefundId: result.razorpayRefundId,
        refundAmountExecuted: result.refundAmountExecuted,
      });
    } catch (e: unknown) {
      console.error('[admin/meal-refund-cases] approve', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.post('/admin/meal-refund-cases/:id/reject', async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as { review_notes?: string };
      const result = await rejectMealRefundCase(
        c.req.param('id'),
        adminReviewerId(c),
        body.review_notes,
      );
      if (!result.ok) {
        return c.json({ success: false, error: result.error }, 404);
      }
      return c.json({ success: true, status: 'rejected' });
    } catch (e: unknown) {
      console.error('[admin/meal-refund-cases] reject', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });
}
