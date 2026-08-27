import type { Hono } from 'hono';
import { customerServicesHandler } from '../handlers/customer-services.handler';

export function registerCustomerServicesRoute(app: Hono) {
  app.get("/customer/services", customerServicesHandler);
  /** Guest-safe alias — same handler (JWT not required via /public/). */
  app.get("/public/services", customerServicesHandler);
}
