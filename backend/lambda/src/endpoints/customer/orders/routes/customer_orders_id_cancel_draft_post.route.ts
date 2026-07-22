import type { Hono } from 'hono';
import { customerOrdersIdCancelDraftPostHandler } from '../handlers/customer_orders_id_cancel_draft_post.handler';

export function registerCustomerOrdersIdCancelDraftPostRoute(app: Hono) {
  app.post('/customer/orders/:id/cancel-draft', customerOrdersIdCancelDraftPostHandler);
}
