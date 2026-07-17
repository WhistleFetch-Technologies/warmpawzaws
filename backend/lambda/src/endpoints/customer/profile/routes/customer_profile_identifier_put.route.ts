import type { Hono } from 'hono';
import { customerProfileIdentifierPutHandler } from '../handlers/customer_profile_identifier_put.handler';

export function registerCustomerProfileIdentifierPutRoute(app: Hono) {
  app.put("/customer/profile/:identifier", customerProfileIdentifierPutHandler);
}
