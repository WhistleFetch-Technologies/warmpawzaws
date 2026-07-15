import type { Context } from 'hono';
import { executecustomerPaymentmethodsGet } from '../services/customer_paymentmethods_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPaymentmethodsGetHandler(c: Context) {
  return executecustomerPaymentmethodsGet(c);
}
