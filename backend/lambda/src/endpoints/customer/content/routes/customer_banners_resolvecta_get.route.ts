import type { Hono } from 'hono';
import { customerBannersResolvectaGetHandler } from '../handlers/customer_banners_resolvecta_get.handler';

export function registerCustomerBannersResolvectaGetRoute(app: Hono) {
  app.get("/customer/banners/resolve-cta", customerBannersResolvectaGetHandler);
}
