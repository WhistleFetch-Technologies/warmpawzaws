import type { Context } from 'hono';
import { executeCustomerWarmpawzPayInitiatePost } from '../services/customer_warmpawz_pay_initiate_post.service';

export async function customerWarmpawzPayInitiatePostHandler(c: Context) {
  return executeCustomerWarmpawzPayInitiatePost(c);
}
