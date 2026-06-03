/**
 * Unified admin refund hub — read-only list/detail (execution via meal-refund-cases approve).
 */

import { Hono } from 'hono';
import {
  getAdminRefundHubDetail,
  listAdminRefundHubCases,
  type RefundHubSourceType,
} from '../utils/admin-refund-hub';

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
