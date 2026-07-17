import type { Context } from 'hono';
import { executecustomerAddressesAddressidGet } from '../services/customer_addresses_addressid_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAddressesAddressidGetHandler(c: Context) {
  return executecustomerAddressesAddressidGet(c);
}
