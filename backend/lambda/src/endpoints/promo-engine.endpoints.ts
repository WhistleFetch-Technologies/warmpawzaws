/**
 * Promotion Engine HTTP API (HLD §39 / master plan §5.2)
 */
import type { Hono } from 'hono';
import {
  createPromotionFromDraft,
  updatePromotionFromDraft,
  patchPromotionStatus,
  softDeletePromotion,
  listPromotions,
  getPromotionDetail,
  mapAdminDraftToPayload,
  evaluatePromotions,
  commitPromotion,
  reversePromotion,
  recordBehaviourCompletion,
} from '../discount-engine/promo-engine';
import { dbUsageByPromotion, dbGetPromotion } from '../discount-engine/promo-engine/repos/promo-engine.repo';
import type { PromoEngineStatus } from '../discount-engine/promo-engine/types';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

export function registerPromoEngineEndpoints(app: Hono) {
  // ── Admin CRUD ──────────────────────────────────────────────
  app.get('/admin/promo-engine/promotions', async (c) => {
    try {
      const status = c.req.query('status') || undefined;
      const service = c.req.query('service') || undefined;
      const q = c.req.query('q') || undefined;
      const items = await listPromotions({ status, service, q });
      return c.json({ success: true, promotions: items });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });

  app.post('/admin/promo-engine/promotions', async (c) => {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const payload = mapAdminDraftToPayload(body);
      const detail = await createPromotionFromDraft(payload);
      return c.json({ success: true, promotion: detail }, 201);
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 400);
    }
  });

  app.get('/admin/promo-engine/promotions/:id', async (c) => {
    try {
      const detail = await getPromotionDetail(c.req.param('id'));
      if (!detail) return c.json({ success: false, error: 'Not found' }, 404);
      return c.json({ success: true, promotion: detail });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });

  app.put('/admin/promo-engine/promotions/:id', async (c) => {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const payload = mapAdminDraftToPayload(body);
      const detail = await updatePromotionFromDraft(c.req.param('id'), payload);
      if (!detail) return c.json({ success: false, error: 'Not found' }, 404);
      return c.json({ success: true, promotion: detail });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 400);
    }
  });

  app.patch('/admin/promo-engine/promotions/:id/status', async (c) => {
    try {
      const body = (await c.req.json()) as { status?: string };
      const status = String(body.status || '').toUpperCase() as PromoEngineStatus;
      const allowed = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'];
      if (!allowed.includes(status)) {
        return c.json({ success: false, error: 'Invalid status' }, 400);
      }
      const updated = await patchPromotionStatus(c.req.param('id'), status);
      if (!updated) return c.json({ success: false, error: 'Not found' }, 404);
      return c.json({ success: true, promotion: updated });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 400);
    }
  });

  app.delete('/admin/promo-engine/promotions/:id', async (c) => {
    try {
      const updated = await softDeletePromotion(c.req.param('id'));
      if (!updated) return c.json({ success: false, error: 'Not found' }, 404);
      return c.json({ success: true, promotion: updated });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 400);
    }
  });

  app.get('/admin/promo-engine/promotions/:id/usage', async (c) => {
    try {
      const rows = await dbUsageByPromotion(c.req.param('id'), 100);
      return c.json({ success: true, usage: rows });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });

  app.get('/admin/promo-engine/promotions/:id/budget', async (c) => {
    try {
      const promo = await dbGetPromotion(c.req.param('id'));
      if (!promo) return c.json({ success: false, error: 'Not found' }, 404);
      return c.json({
        success: true,
        budget: {
          limit: promo.budget_limit,
          consumed: promo.budget_consumed,
          remaining:
            promo.budget_limit != null
              ? Math.max(0, Number(promo.budget_limit) - Number(promo.budget_consumed))
              : null,
        },
      });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });

  // ── Runtime ─────────────────────────────────────────────────
  app.post('/promo-engine/evaluate', async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.user_id || !body?.transaction) {
        return c.json({ success: false, error: 'user_id and transaction required' }, 400);
      }
      const result = await evaluatePromotions(body);
      return c.json({ success: true, ...result });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });

  app.post('/promo-engine/commit', async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.evaluation_id || !body?.transaction_id) {
        return c.json(
          { success: false, error: 'evaluation_id and transaction_id required' },
          400
        );
      }
      const result = await commitPromotion(body);
      if (!result.success) {
        return c.json({ success: false, ...result }, 400);
      }
      return c.json({ success: true, ...result });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });

  app.post('/promo-engine/reverse', async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.transaction_id) {
        return c.json({ success: false, error: 'transaction_id required' }, 400);
      }
      const result = await reversePromotion(body);
      return c.json({ success: true, ...result });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });

  // Behaviour event ingest (booking/order hooks can POST here)
  app.post('/promo-engine/behaviour/events', async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.user_id || !body?.event_type) {
        return c.json({ success: false, error: 'user_id and event_type required' }, 400);
      }
      await recordBehaviourCompletion({
        userId: String(body.user_id),
        eventType: String(body.event_type),
        serviceCategory: body.service_category,
        amount: body.amount != null ? Number(body.amount) : undefined,
        transactionId: body.transaction_id,
        payload: body.payload,
      });
      return c.json({ success: true });
    } catch (err) {
      return c.json({ success: false, error: errMsg(err) }, 500);
    }
  });
}
