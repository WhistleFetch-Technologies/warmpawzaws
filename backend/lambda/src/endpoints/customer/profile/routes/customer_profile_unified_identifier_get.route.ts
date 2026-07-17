import type { Hono } from 'hono';
import { customerProfileUnifiedIdentifierGetHandler } from '../handlers/customer_profile_unified_identifier_get.handler';

export function registerCustomerProfileUnifiedIdentifierGetRoute(app: Hono) {
  app.get("/customer/profile/unified/:identifier", customerProfileUnifiedIdentifierGetHandler);
}
