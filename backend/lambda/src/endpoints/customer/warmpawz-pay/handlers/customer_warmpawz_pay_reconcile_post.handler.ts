import type { Context } from 'hono';
import { executeCustomerWarmpawzPayReconcilePost } from '../services/customer_warmpawz_pay_reconcile_post.service';

export async function customerWarmpawzPayReconcilePostHandler(c: Context) {
  return executeCustomerWarmpawzPayReconcilePost(c);
}
