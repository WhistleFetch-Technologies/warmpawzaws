import type { Hono } from 'hono';
import { customerAdoptionstatsGetHandler } from '../handlers/customer_adoptionstats_get.handler';

export function registerCustomerAdoptionstatsGetRoute(app: Hono) {
  app.get("/customer/adoption-stats", customerAdoptionstatsGetHandler);
}
