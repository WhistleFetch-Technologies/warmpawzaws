import type { Hono } from 'hono';
import { customerAddressesAddressidGetHandler } from '../handlers/customer_addresses_addressid_get.handler';

export function registerCustomerAddressesAddressidGetRoute(app: Hono) {
  app.get("/customer/addresses/:addressId", customerAddressesAddressidGetHandler);
}
