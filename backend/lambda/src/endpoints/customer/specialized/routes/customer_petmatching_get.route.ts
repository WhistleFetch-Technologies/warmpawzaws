import type { Hono } from 'hono';
import { customerPetmatchingGetHandler } from '../handlers/customer_petmatching_get.handler';

export function registerCustomerPetmatchingGetRoute(app: Hono) {
  app.get("/customer/pet-matching", customerPetmatchingGetHandler);
}
