import type { Context } from 'hono';
import { executecustomerOrdersIdGet } from '../services/customer_orders_id_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersIdGetHandler(c: Context) {
  return executecustomerOrdersIdGet(c);
}
