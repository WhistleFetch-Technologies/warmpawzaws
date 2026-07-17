import type { Hono } from 'hono';
import { customerProfileIdentifierGetHandler } from '../handlers/customer_profile_identifier_get.handler';

export function registerCustomerProfileIdentifierGetRoute(app: Hono) {
  app.get("/customer/profile/:identifier", customerProfileIdentifierGetHandler);
}
