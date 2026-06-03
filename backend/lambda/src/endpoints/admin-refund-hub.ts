/**
 * Unified admin refund hub — read-only list/detail (execution via meal-refund-cases approve).
 */

import { Hono } from 'hono';
import {
  getAdminRefundHubDetail,
  listAdminRefundHubCases,
  type RefundHubSourceType,
} from '../utils/admin-refund-hub';
import {
  approveMealRefundCase,
  backfillMealRefundCaseByOrderRef,
  rejectMealRefundCase,
} from '../utils/meal-refund-cases';

function adminReviewerId(c: { get: (k: string) => unknown }): string {
  return String(c.get('userId') || c.get('userEmail') || 'admin');
}

function parseSourceType(v: string): RefundHubSourceType | null {
  if (v === 'refund' || v === 'meal_case') return v;
  return null;
}

export function registerAdminRefundHubEndpoints(app: Hono) {
  app.get('/admin/refund-cases', async (c) => {
    try {
      const domain = c.req.query('domain');
      const origin = c.req.query('origin');
      const stage = c.req.query('stage');
      const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;
      const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined;
      const { cases, total } = await listAdminRefundHubCases({
        domain,
        origin,
        stage,
        limit,
        offset,
      });
      return c.json({
        success: true,
        cases,
        total,
        limit: limit ?? 25,
        offset: offset ?? 0,
      });
    } catch (e: unknown) {
      console.error('[admin/refund-cases] list', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  /** Meal logistics backfill (same as POST /admin/meal-refund-cases/backfill). */
  app.post('/admin/refund-cases/meal-backfill', async (c) => {
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
      console.error('[admin/refund-cases/meal-backfill]', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.post('/admin/refund-cases/meal_case/:id/approve', async (c) => {
    try {
      const result = await approveMealRefundCase(c.req.param('id'), adminReviewerId(c));
      if (!result.ok) {
        const code = result.alreadyProcessed ? 409 : 400;
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
      console.error('[admin/refund-cases/meal_case/approve]', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.post('/admin/refund-cases/meal_case/:id/reject', async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as { review_notes?: string };
      const result = await rejectMealRefundCase(
        c.req.param('id'),
        adminReviewerId(c),
        body.review_notes,
      );
      if (!result.ok) {
        return c.json({ success: false, error: result.error }, 400);
      }
      return c.json({ success: true, status: 'rejected' });
    } catch (e: unknown) {
      console.error('[admin/refund-cases/meal_case/reject]', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.get('/admin/refund-cases/:sourceType/:id', async (c) => {
    try {
      const sourceType = parseSourceType(c.req.param('sourceType'));
      if (!sourceType) {
        return c.json({ success: false, error: 'Invalid sourceType (refund | meal_case)' }, 400);
      }
      const detail = await getAdminRefundHubDetail(sourceType, c.req.param('id'));
      if (!detail) {
        return c.json({ success: false, error: 'Case not found' }, 404);
      }
      return c.json({ success: true, case: detail });
    } catch (e: unknown) {
      console.error('[admin/refund-cases] detail', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });
}
