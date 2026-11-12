import type { Context } from 'hono';
import { executeCustomerWarmpawzPayLegalAcceptanceGet } from '../services/customer_warmpawz_pay_legal_acceptance_get.service';

export async function customerWarmpawzPayLegalAcceptanceGetHandler(c: Context) {
  return executeCustomerWarmpawzPayLegalAcceptanceGet(c);
}
