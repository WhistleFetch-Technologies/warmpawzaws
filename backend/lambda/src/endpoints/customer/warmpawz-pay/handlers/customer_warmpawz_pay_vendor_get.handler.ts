import type { Context } from 'hono';
import { executeCustomerWarmpawzPayVendorGet } from '../services/customer_warmpawz_pay_vendor_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerWarmpawzPayVendorGetHandler(c: Context) {
  return executeCustomerWarmpawzPayVendorGet(c);
}
