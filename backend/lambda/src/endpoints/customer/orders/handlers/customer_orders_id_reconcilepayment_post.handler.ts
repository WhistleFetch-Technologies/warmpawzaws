import type { Context } from 'hono';
import { executecustomerOrdersIdReconcilepaymentPost } from '../services/customer_orders_id_reconcilepayment_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersIdReconcilepaymentPostHandler(c: Context) {
  return executecustomerOrdersIdReconcilepaymentPost(c);
}
