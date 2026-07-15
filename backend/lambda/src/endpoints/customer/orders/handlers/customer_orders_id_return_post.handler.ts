import type { Context } from 'hono';
import { executecustomerOrdersIdReturnPost } from '../services/customer_orders_id_return_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersIdReturnPostHandler(c: Context) {
  return executecustomerOrdersIdReturnPost(c);
}
