import type { Hono } from 'hono';
import { customerAddressesPostHandler } from '../handlers/customer_addresses_post.handler';

export function registerCustomerAddressesPostRoute(app: Hono) {
  app.post("/customer/addresses", customerAddressesPostHandler);
}
