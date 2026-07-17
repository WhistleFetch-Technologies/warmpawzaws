import type { Context } from 'hono';
import { executecustomerCustomeridAddressesAddressidDelete } from '../services/customer_customerid_addresses_addressid_delete.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridAddressesAddressidDeleteHandler(c: Context) {
  return executecustomerCustomeridAddressesAddressidDelete(c);
}
