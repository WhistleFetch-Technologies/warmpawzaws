import type { Context } from 'hono';
import { executeCustomerWarmpawzPayVendorsNearbyGet } from '../services/customer_warmpawz_pay_vendors_nearby_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerWarmpawzPayVendorsNearbyGetHandler(c: Context) {
  return executeCustomerWarmpawzPayVendorsNearbyGet(c);
}
