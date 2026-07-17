import type { Context } from 'hono';
import { executecustomerOrdersPost } from '../services/customer_orders_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersPostHandler(c: Context) {
  return executecustomerOrdersPost(c);
}
