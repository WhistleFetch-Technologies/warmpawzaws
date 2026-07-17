import type { Hono } from 'hono';
import { customerAddressesGetHandler } from '../handlers/customer_addresses_get.handler';

export function registerCustomerAddressesGetRoute(app: Hono) {
  app.get("/customer/addresses", customerAddressesGetHandler);
}
