import type { Hono } from 'hono';
import { customerProfileGetHandler } from '../handlers/customer_profile_get.handler';

export function registerCustomerProfileGetRoute(app: Hono) {
  app.get("/customer/profile", customerProfileGetHandler);
}
