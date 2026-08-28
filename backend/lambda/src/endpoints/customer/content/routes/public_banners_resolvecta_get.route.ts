import type { Hono } from 'hono';
import { customerBannersResolvectaGetHandler } from '../handlers/customer_banners_resolvecta_get.handler';

/** Guest-safe alias — same handler as GET /customer/banners/resolve-cta. */
export function registerPublicBannersResolvectaGetRoute(app: Hono) {
  app.get('/public/banners/resolve-cta', customerBannersResolvectaGetHandler);
}
