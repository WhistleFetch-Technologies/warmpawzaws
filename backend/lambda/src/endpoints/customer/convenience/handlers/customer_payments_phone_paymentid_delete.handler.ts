import type { Context } from 'hono';
import { executecustomerPaymentsPhonePaymentidDelete } from '../services/customer_payments_phone_paymentid_delete.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPaymentsPhonePaymentidDeleteHandler(c: Context) {
  return executecustomerPaymentsPhonePaymentidDelete(c);
}
