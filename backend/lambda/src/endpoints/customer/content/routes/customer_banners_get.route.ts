import type { Hono } from 'hono';
import { customerBannersGetHandler } from '../handlers/customer_banners_get.handler';

export function registerCustomerBannersGetRoute(app: Hono) {
  app.get("/customer/banners", customerBannersGetHandler);
}
