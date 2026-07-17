import type { Hono } from 'hono';
import { customerPetmatchingRequestsRequestidPutHandler } from '../handlers/customer_petmatching_requests_requestid_put.handler';

export function registerCustomerPetmatchingRequestsRequestidPutRoute(app: Hono) {
  app.put("/customer/pet-matching/requests/:requestId", customerPetmatchingRequestsRequestidPutHandler);
}
