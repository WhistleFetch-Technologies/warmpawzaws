import type { Hono } from 'hono';
import { customerFacilityHandler } from '../handlers/customer-facility.handler';

export function registerCustomerFacilityRoute(app: Hono) {
  app.get("/customer/facility/:vendorId", customerFacilityHandler);
}
