import type { Hono } from 'hono';
import { customerFeaturedpackagesGetHandler } from '../handlers/customer_featuredpackages_get.handler';

export function registerCustomerFeaturedpackagesGetRoute(app: Hono) {
  app.get("/customer/featured-packages", customerFeaturedpackagesGetHandler);
}
