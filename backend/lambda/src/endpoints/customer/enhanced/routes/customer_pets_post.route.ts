import type { Hono } from 'hono';
import { customerPetsPostHandler } from '../handlers/customer_pets_post.handler';

export function registerCustomerPetsPostRoute(app: Hono) {
  app.post('/customer/pets', customerPetsPostHandler);
}
