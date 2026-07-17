import type { Context } from 'hono';
import { executecustomerOrdersOrderidPharmacystatusGet } from '../services/customer_orders_orderid_pharmacystatus_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersOrderidPharmacystatusGetHandler(c: Context) {
  return executecustomerOrdersOrderidPharmacystatusGet(c);
}
