import type { Context } from 'hono';
import { executeputAdminDeliveryFeePolicy } from '../services/put-admin-delivery-fee-policy.service';

/** HTTP adapter — delegates to service layer. */
export async function putAdminDeliveryFeePolicyHandler(c: Context) {
  return executeputAdminDeliveryFeePolicy(c);
}
