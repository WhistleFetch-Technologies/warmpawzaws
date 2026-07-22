/**
 * Admin shop refunds & returns ops — paginated list + single-row retry.
 */

import { Hono } from 'hono';
import { query } from '../database/rds-connection';
import { initiateShopOrderRazorpayRefund } from '../utils/payments/shop-order-refund';

function parseLimit(raw: string | undefined, fallback = 50, max = 100): number {
  const n = raw ? parseInt(raw, 10) : fallback;
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), max);
}

function parseOffset(raw: string | undefined): number {
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

export function registerAdminShopRefundsEndpoints(app: Hono) {
  app.get('/admin/shop-refunds', async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseLimit(c.req.query('limit'));
      const offset = parseOffset(c.req.query('offset'));

      const params: unknown[] = [];
      let where = `WHERE r.order_id IS NOT NULL`;
      if (status) {
        params.push(status);
        where += ` AND r.refund_status = $${params.length}`;
      }
      params.push(limit, offset);

      const listSql = `
        SELECT r.id, r.refund_amount, r.refund_status, r.refund_reason, r.razorpay_refund_id,
               r.requested_at, r.retry_count, r.order_id,
               o.order_number, o.order_status,
               COALESCE(c.full_name, '') AS customer_name,
               COALESCE(v.business_name, '') AS vendor_name
        FROM refunds r
        JOIN orders o ON o.id = r.order_id
        LEFT JOIN customers c ON c.id = r.customer_id
        LEFT JOIN vendors v ON v.id = r.vendor_id
        ${where}
        ORDER BY r.requested_at DESC NULLS LAST
        LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const countSql = `SELECT COUNT(*)::int AS total FROM refunds r ${where}`;

      const [listRes, countRes] = await Promise.all([
        query(listSql, params),
        query(countSql, params.slice(0, params.length - 2)),
      ]);

      return c.json({
        success: true,
        refunds: listRes.rows,
        total: countRes.rows[0]?.total ?? 0,
        limit,
        offset,
      });
    } catch (e: unknown) {
      console.error('[admin/shop-refunds] list', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.get('/admin/shop-returns', async (c) => {
    try {
      const limit = parseLimit(c.req.query('limit'));
      const offset = parseOffset(c.req.query('offset'));
      const statusFilter = c.req.query('status') || 'pending,approved';

      const statuses = statusFilter.split(',').map((s) => s.trim()).filter(Boolean);
      const params: unknown[] = [statuses, limit, offset];

      const listSql = `
        SELECT rr.id, rr.return_number, rr.status, rr.reason, rr.total_refund_amount,
               rr.refund_method, rr.created_at, rr.order_id,
               o.order_number, o.order_status,
               COALESCE(c.full_name, '') AS customer_name,
               COALESCE(v.business_name, '') AS vendor_name
        FROM return_requests rr
        JOIN orders o ON o.id = rr.order_id
        LEFT JOIN customers c ON c.id = rr.customer_id
        LEFT JOIN vendors v ON v.id = rr.vendor_id
        WHERE rr.status = ANY($1::text[])
          AND LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')
        ORDER BY rr.created_at DESC
        LIMIT $2 OFFSET $3`;

      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM return_requests rr
        JOIN orders o ON o.id = rr.order_id
        WHERE rr.status = ANY($1::text[])
          AND LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')`;

      const [listRes, countRes] = await Promise.all([
        query(listSql, params),
        query(countSql, [statuses]),
      ]);

      return c.json({
        success: true,
        returns: listRes.rows,
        total: countRes.rows[0]?.total ?? 0,
        limit,
        offset,
      });
    } catch (e: unknown) {
      console.error('[admin/shop-returns] list', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });

  app.post('/admin/shop-refunds/:refundId/retry', async (c) => {
    try {
      const refundId = c.req.param('refundId');
      const rowRes = await query(
        `SELECT r.id::text, r.order_id::text, r.refund_amount::text, r.refund_reason,
                r.customer_id::text, r.vendor_id::text, r.refund_status, r.razorpay_refund_id
         FROM refunds r
         WHERE r.id = $1::uuid AND r.order_id IS NOT NULL
         LIMIT 1`,
        [refundId],
      );
      const row = rowRes.rows[0];
      if (!row) {
        return c.json({ success: false, error: 'Shop refund not found' }, 404);
      }
      if (row.razorpay_refund_id) {
        return c.json({
          success: true,
          refundStatus: 'processing',
          message: 'Refund already initiated with Razorpay',
          alreadyProcessed: true,
        });
      }

      const amount = parseFloat(String(row.refund_amount)) || 0;
      const result = await initiateShopOrderRazorpayRefund({
        orderId: String(row.order_id),
        amount,
        reason: String(row.refund_reason || 'Admin retry'),
        customerId: row.customer_id ? String(row.customer_id) : undefined,
        vendorId: row.vendor_id ? String(row.vendor_id) : undefined,
      });

      return c.json({
        success: result.success,
        refundStatus: result.refundStatus,
        refundId: result.refundId,
        razorpayRefundId: result.razorpayRefundId,
        error: result.error,
      });
    } catch (e: unknown) {
      console.error('[admin/shop-refunds/retry]', e);
      return c.json({ success: false, error: (e as Error).message }, 500);
    }
  });
}
