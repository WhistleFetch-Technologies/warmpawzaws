import type { Hono } from 'hono';
import { customerPetmatchingRequestPostHandler } from '../handlers/customer_petmatching_request_post.handler';

export function registerCustomerPetmatchingRequestPostRoute(app: Hono) {
  app.post("/customer/pet-matching/request", customerPetmatchingRequestPostHandler);
}
