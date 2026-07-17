import type { Hono } from 'hono';
import { customerProfilePostHandler } from '../handlers/customer_profile_post.handler';

export function registerCustomerProfilePostRoute(app: Hono) {
  app.post("/customer/profile", customerProfilePostHandler);
}
