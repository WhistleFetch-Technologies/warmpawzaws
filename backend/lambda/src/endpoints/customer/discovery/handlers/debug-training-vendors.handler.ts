import type { Context } from 'hono';
import { executedebugTrainingVendors } from '../services/debug-training-vendors.service';

/** HTTP adapter — delegates to service layer. */
export async function debugTrainingVendorsHandler(c: Context) {
  return executedebugTrainingVendors(c);
}
