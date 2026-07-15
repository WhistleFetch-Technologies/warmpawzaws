import type { Context } from 'hono';
import { executecustomerCustomeridAddressesGet } from '../services/customer_customerid_addresses_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridAddressesGetHandler(c: Context) {
  return executecustomerCustomeridAddressesGet(c);
}
