/**
 * Admin cancel & refund for service bookings.
 *   GET  /admin/bookings/:bookingId/cancel-preview?refundMethod=wallet|original|none&amountMode=full|policy
 *   POST /admin/bookings/:bookingId/cancel  { reason, refundMethod, amountMode }
 * :bookingId accepts the full UUID or the 8+ character prefix customers see.
 */
import type { Hono } from 'hono';
import { requireAdminAuth } from './admin.controller';
import {
  AdminCancelError,
  adminCanCancelAndRefund,
  executeAdminBookingCancel,
  normalizeAdminRefundAmountMode,
  normalizeAdminRefundMethod,
  previewAdminBookingCancel,
} from '../../../lib/services/admin/admin-booking-cancel-service';

async function gate(c: any) {
  const auth = await requireAdminAuth(c);
  if (!auth.authorized) return { ok: false as const, res: c.json({ success: false, error: auth.error }, 401) };
  const adminId = auth.userId as string | undefined;
  if (!(await adminCanCancelAndRefund(adminId))) {
    return {
      ok: false as const,
      res: c.json({ success: false, error: 'You need the Refunds permission to cancel bookings.' }, 403),
    };
  }
  return { ok: true as const, adminId };
}

function errorResponse(c: any, error: unknown, logPrefix: string) {
  if (error instanceof AdminCancelError) {
    return c.json({ success: false, error: error.message, code: error.code }, error.status);
  }
  console.error(logPrefix, error);
  return c.json({ success: false, error: (error as Error)?.message || 'Failed' }, 500);
}

export function registerAdminBookingCancelEndpoints(app: Hono) {
  app.get('/admin/bookings/:bookingId/cancel-preview', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const data = await previewAdminBookingCancel({
        idOrPrefix: c.req.param('bookingId'),
        refundMethod: normalizeAdminRefundMethod(c.req.query('refundMethod')),
        amountMode: normalizeAdminRefundAmountMode(c.req.query('amountMode')),
      });
      return c.json({ success: true, data });
    } catch (error) {
      return errorResponse(c, error, '[ADMIN-CANCEL] preview failed');
    }
  });

  app.post('/admin/bookings/:bookingId/cancel', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const data = await executeAdminBookingCancel({
        idOrPrefix: c.req.param('bookingId'),
        adminId: g.adminId,
        reason: String(body.reason ?? ''),
        refundMethod: normalizeAdminRefundMethod(body.refundMethod),
        amountMode: normalizeAdminRefundAmountMode(body.amountMode),
        requestId: c.req.header('x-request-id') || undefined,
      });
      return c.json({ success: true, data });
    } catch (error) {
      return errorResponse(c, error, '[ADMIN-CANCEL] cancel failed');
    }
  });
}
