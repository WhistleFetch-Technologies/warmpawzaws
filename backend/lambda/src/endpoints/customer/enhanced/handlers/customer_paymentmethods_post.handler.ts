import type { Context } from 'hono';
import { executecustomerPaymentmethodsPost } from '../services/customer_paymentmethods_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPaymentmethodsPostHandler(c: Context) {
  return executecustomerPaymentmethodsPost(c);
}
