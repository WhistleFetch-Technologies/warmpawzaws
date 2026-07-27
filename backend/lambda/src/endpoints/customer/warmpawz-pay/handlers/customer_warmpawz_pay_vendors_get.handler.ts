import type { Context } from 'hono';
import { executeCustomerWarmpawzPayVendorsGet } from '../services/customer_warmpawz_pay_vendors_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerWarmpawzPayVendorsGetHandler(c: Context) {
  return executeCustomerWarmpawzPayVendorsGet(c);
}
