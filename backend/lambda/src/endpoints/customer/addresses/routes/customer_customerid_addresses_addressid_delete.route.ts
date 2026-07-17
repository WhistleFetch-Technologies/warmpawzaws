import type { Hono } from 'hono';
import { customerCustomeridAddressesAddressidDeleteHandler } from '../handlers/customer_customerid_addresses_addressid_delete.handler';

export function registerCustomerCustomeridAddressesAddressidDeleteRoute(app: Hono) {
  app.delete("/customer/:customerId/addresses/:addressId", customerCustomeridAddressesAddressidDeleteHandler);
}
