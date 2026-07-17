import type { Hono } from 'hono';
import { customerCustomeridAddressesAddressidPutHandler } from '../handlers/customer_customerid_addresses_addressid_put.handler';

export function registerCustomerCustomeridAddressesAddressidPutRoute(app: Hono) {
  app.put("/customer/:customerId/addresses/:addressId", customerCustomeridAddressesAddressidPutHandler);
}
