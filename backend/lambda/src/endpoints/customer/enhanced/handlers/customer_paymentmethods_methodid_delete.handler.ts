import type { Context } from 'hono';
import { executecustomerPaymentmethodsMethodidDelete } from '../services/customer_paymentmethods_methodid_delete.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPaymentmethodsMethodidDeleteHandler(c: Context) {
  return executecustomerPaymentmethodsMethodidDelete(c);
}
