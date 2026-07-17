import type { Context } from 'hono';
import { executecustomerPaymentsPhoneGet } from '../services/customer_payments_phone_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPaymentsPhoneGetHandler(c: Context) {
  return executecustomerPaymentsPhoneGet(c);
}
