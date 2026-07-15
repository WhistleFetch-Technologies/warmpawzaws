import type { Context } from 'hono';
import { executecustomerOrdersIdPaymentresumeGet } from '../services/customer_orders_id_paymentresume_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersIdPaymentresumeGetHandler(c: Context) {
  return executecustomerOrdersIdPaymentresumeGet(c);
}
