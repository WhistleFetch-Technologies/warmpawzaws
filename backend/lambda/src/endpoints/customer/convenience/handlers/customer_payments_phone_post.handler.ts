import type { Context } from 'hono';
import { executecustomerPaymentsPhonePost } from '../services/customer_payments_phone_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPaymentsPhonePostHandler(c: Context) {
  return executecustomerPaymentsPhonePost(c);
}
