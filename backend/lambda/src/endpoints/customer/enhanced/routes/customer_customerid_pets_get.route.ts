import type { Hono } from 'hono';
import { customerCustomeridPetsGetHandler } from '../handlers/customer_customerid_pets_get.handler';

export function registerCustomerCustomeridPetsGetRoute(app: Hono) {
  app.get('/customer/:customerId/pets', customerCustomeridPetsGetHandler);
}
