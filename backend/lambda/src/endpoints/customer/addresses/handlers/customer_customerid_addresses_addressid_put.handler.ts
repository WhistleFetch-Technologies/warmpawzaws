import type { Context } from 'hono';
import { executecustomerCustomeridAddressesAddressidPut } from '../services/customer_customerid_addresses_addressid_put.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridAddressesAddressidPutHandler(c: Context) {
  return executecustomerCustomeridAddressesAddressidPut(c);
}
