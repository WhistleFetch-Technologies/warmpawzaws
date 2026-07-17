import type { Hono } from 'hono';
import { customerPetsGetHandler } from '../handlers/customer_pets_get.handler';

export function registerCustomerPetsGetRoute(app: Hono) {
  app.get('/customer/pets', customerPetsGetHandler);
}
