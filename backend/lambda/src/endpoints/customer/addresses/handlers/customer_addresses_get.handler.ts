import type { Context } from 'hono';
import { executecustomerAddressesGet } from '../services/customer_addresses_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAddressesGetHandler(c: Context) {
  return executecustomerAddressesGet(c);
}
