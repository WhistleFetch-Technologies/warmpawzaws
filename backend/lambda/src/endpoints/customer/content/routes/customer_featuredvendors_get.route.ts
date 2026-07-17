import type { Hono } from 'hono';
import { customerFeaturedvendorsGetHandler } from '../handlers/customer_featuredvendors_get.handler';

export function registerCustomerFeaturedvendorsGetRoute(app: Hono) {
  app.get("/customer/featured-vendors", customerFeaturedvendorsGetHandler);
}
