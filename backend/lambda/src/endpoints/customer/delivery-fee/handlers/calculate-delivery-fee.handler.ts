import type { Context } from 'hono';
import { executecalculateDeliveryFee } from '../services/calculate-delivery-fee.service';

/** HTTP adapter — delegates to service layer. */
export async function calculateDeliveryFeeHandler(c: Context) {
  return executecalculateDeliveryFee(c);
}
