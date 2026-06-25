/**
 * Admin meal logistics — Support CRM reassign rider (proxies Java delivery-service).
 */
import { Hono } from 'hono';
import { requireAdminAuth } from './admin.controller';

const FETCH_TIMEOUT_MS = 28_000;

async function callDeliveryService(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const baseUrl = (process.env.DELIVERY_SERVICE_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    return { ok: false, status: 503, data: { success: false, error: 'DELIVERY_SERVICE_BASE_URL not configured' } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await resp.text().catch(() => '');
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { raw: text };
    }
    return { ok: resp.ok, status: resp.status, data };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 502, data: { success: false, error: `delivery-service unreachable: ${message}` } };
  } finally {
    clearTimeout(timer);
  }
}

export function registerAdminMealLogisticsEndpoints(app: Hono) {
  /**
   * POST /admin/meal-orders/:mealOrderId/reassign-rider
   * Support CRM trigger — unallocate Pidge rider; sync via webhooks.
   */
  app.post('/admin/meal-orders/:mealOrderId/reassign-rider', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const { mealOrderId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const supportTicketId =
      typeof body.supportTicketId === 'string' ? body.supportTicketId : undefined;
    const reason = typeof body.reason === 'string' ? body.reason : undefined;

    const result = await callDeliveryService('/logistics/meal/reassign-rider', 'POST', {
      mealOrderId,
      adminId: auth.userId,
      supportTicketId,
      reason,
    });

    if (result.status === 409) {
      return c.json(result.data, 409);
    }
    if (result.status === 502 || result.status === 503) {
      return c.json(result.data, 502);
    }
    if (!result.ok) {
      return c.json(result.data, (result.status >= 400 ? result.status : 400) as 400);
    }
    return c.json(result.data, result.status === 202 ? 202 : 200);
  });

  /**
   * GET /admin/meal-orders/:mealOrderId/logistics-summary
   * CRM context: rider, tracking, reassign history.
   */
  app.get('/admin/meal-orders/:mealOrderId/logistics-summary', async (c) => {
    const auth = await requireAdminAuth(c);
    if (!auth.authorized) {
      return c.json({ success: false, error: auth.error || 'Unauthorized' }, 401);
    }
    const { mealOrderId } = c.req.param();
    const result = await callDeliveryService(
      `/logistics/meal/${encodeURIComponent(mealOrderId)}/logistics-summary`,
      'GET',
    );
    if (result.status === 404) {
      return c.json(result.data, 404);
    }
    if (!result.ok) {
      return c.json(result.data, (result.status >= 400 ? result.status : 502) as 502);
    }
    return c.json(result.data);
  });
}
