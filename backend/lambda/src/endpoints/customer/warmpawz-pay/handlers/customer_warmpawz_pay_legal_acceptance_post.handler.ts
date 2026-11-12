import type { Context } from 'hono';
import { executeCustomerWarmpawzPayLegalAcceptancePost } from '../services/customer_warmpawz_pay_legal_acceptance_post.service';

export async function customerWarmpawzPayLegalAcceptancePostHandler(c: Context) {
  return executeCustomerWarmpawzPayLegalAcceptancePost(c);
}
