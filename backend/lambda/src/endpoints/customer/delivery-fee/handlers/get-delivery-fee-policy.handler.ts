import type { Context } from 'hono';
import { executegetDeliveryFeePolicy } from '../services/get-delivery-fee-policy.service';

/** HTTP adapter — delegates to service layer. */
export async function getDeliveryFeePolicyHandler(c: Context) {
  return executegetDeliveryFeePolicy(c);
}
