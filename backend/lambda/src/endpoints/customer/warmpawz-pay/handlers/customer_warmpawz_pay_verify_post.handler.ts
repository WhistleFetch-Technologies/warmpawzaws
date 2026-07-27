import type { Context } from 'hono';
import { executeCustomerWarmpawzPayVerifyPost } from '../services/customer_warmpawz_pay_verify_post.service';

export async function customerWarmpawzPayVerifyPostHandler(c: Context) {
  return executeCustomerWarmpawzPayVerifyPost(c);
}
