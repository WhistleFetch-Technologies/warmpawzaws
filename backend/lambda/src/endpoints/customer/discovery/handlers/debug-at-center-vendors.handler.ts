import type { Context } from 'hono';
import { executedebugAtCenterVendors } from '../services/debug-at-center-vendors.service';

/** HTTP adapter — delegates to service layer. */
export async function debugAtCenterVendorsHandler(c: Context) {
  return executedebugAtCenterVendors(c);
}
