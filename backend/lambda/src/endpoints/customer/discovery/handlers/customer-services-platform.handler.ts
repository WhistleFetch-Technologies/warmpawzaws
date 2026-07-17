import type { Context } from 'hono';
import { executecustomerServicesPlatform } from '../services/customer-services-platform.service';

/** HTTP adapter — delegates to service layer. */
export async function customerServicesPlatformHandler(c: Context) {
  return executecustomerServicesPlatform(c);
}
