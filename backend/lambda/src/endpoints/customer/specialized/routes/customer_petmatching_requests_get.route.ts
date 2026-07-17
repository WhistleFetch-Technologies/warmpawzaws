import type { Hono } from 'hono';
import { customerPetmatchingRequestsGetHandler } from '../handlers/customer_petmatching_requests_get.handler';

export function registerCustomerPetmatchingRequestsGetRoute(app: Hono) {
  app.get("/customer/pet-matching/requests", customerPetmatchingRequestsGetHandler);
}
