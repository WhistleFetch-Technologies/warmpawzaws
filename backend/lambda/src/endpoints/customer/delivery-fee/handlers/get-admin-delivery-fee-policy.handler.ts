import type { Context } from 'hono';
import { executegetAdminDeliveryFeePolicy } from '../services/get-admin-delivery-fee-policy.service';

/** HTTP adapter — delegates to service layer. */
export async function getAdminDeliveryFeePolicyHandler(c: Context) {
  return executegetAdminDeliveryFeePolicy(c);
}
