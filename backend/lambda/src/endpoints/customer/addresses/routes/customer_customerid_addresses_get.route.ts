import type { Hono } from 'hono';
import { customerCustomeridAddressesGetHandler } from '../handlers/customer_customerid_addresses_get.handler';

export function registerCustomerCustomeridAddressesGetRoute(app: Hono) {
  app.get("/customer/:customerId/addresses", customerCustomeridAddressesGetHandler);
}
