import type { Context } from 'hono';
import { resolveCustomerIdFromHonoContext } from '../../../../utils/customer-id-from-auth';
import { discardDraftShopOrder } from '../../../../utils/payments/shop-order-refund';
import * as repo from '../repos/customer_orders_id_cancel_draft_post.repo';

export async function executecustomerOrdersIdCancelDraftPost(c: Context) {
  try {
    const orderId = c.req.param('id');
    const customerId = await resolveCustomerIdFromHonoContext(c);
    if (!customerId) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const reason = String(body?.reason || 'customer_request');

    const owner = await repo.dbCustomerOrdersIdCancelDraftOwnerCheck(orderId, customerId);
    if (owner.rows.length === 0) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const result = await discardDraftShopOrder({ orderId, customerId, reason });
    if (!result.success) {
      return c.json({ success: false, error: result.error || 'Could not cancel draft order' }, 400);
    }

    return c.json({
      success: true,
      orderId,
      status: 'cancelled',
      cancelledBy: 'pet_parent',
      message: 'Draft order cancelled',
    });
  } catch (error: unknown) {
    console.error('[customer/orders/cancel-draft]', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to cancel draft' },
      500,
    );
  }
}
