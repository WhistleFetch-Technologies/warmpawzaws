import type { Hono } from 'hono';
import { customerCustomeridAddressesPostHandler } from '../handlers/customer_customerid_addresses_post.handler';

export function registerCustomerCustomeridAddressesPostRoute(app: Hono) {
  app.post("/customer/:customerId/addresses", customerCustomeridAddressesPostHandler);
}
