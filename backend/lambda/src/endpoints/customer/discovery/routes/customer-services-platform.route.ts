import type { Hono } from 'hono';
import { customerServicesPlatformHandler } from '../handlers/customer-services-platform.handler';

export function registerCustomerServicesPlatformRoute(app: Hono) {
  app.get("/customer/services/platform", customerServicesPlatformHandler);
}
