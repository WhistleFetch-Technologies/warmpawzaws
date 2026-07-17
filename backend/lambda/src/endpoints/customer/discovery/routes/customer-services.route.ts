import type { Hono } from 'hono';
import { customerServicesHandler } from '../handlers/customer-services.handler';

export function registerCustomerServicesRoute(app: Hono) {
  app.get("/customer/services", customerServicesHandler);
}
