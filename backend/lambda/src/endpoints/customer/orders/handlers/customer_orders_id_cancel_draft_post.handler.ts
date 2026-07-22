import type { Context } from 'hono';
import { executecustomerOrdersIdCancelDraftPost } from '../services/customer_orders_id_cancel_draft_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersIdCancelDraftPostHandler(c: Context) {
  return executecustomerOrdersIdCancelDraftPost(c);
}
