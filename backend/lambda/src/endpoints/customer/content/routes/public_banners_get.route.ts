import type { Hono } from 'hono';
import { customerBannersGetHandler } from '../handlers/customer_banners_get.handler';

/** Guest-safe alias — same handler as GET /customer/banners (JWT not required via /public/). */
export function registerPublicBannersGetRoute(app: Hono) {
  app.get('/public/banners', customerBannersGetHandler);
}
