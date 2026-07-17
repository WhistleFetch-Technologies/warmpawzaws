import type { Hono } from 'hono';
import { customerCustomeridPetsPostHandler } from '../handlers/customer_customerid_pets_post.handler';

export function registerCustomerCustomeridPetsPostRoute(app: Hono) {
  app.post('/customer/:customerId/pets', customerCustomeridPetsPostHandler);
}
