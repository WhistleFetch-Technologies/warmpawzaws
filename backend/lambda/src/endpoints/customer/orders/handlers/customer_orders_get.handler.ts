import type { Context } from 'hono';
import { executecustomerOrdersGet } from '../services/customer_orders_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersGetHandler(c: Context) {
  return executecustomerOrdersGet(c);
}
