import type { Hono } from 'hono';
import { marketingBannersGetHandler } from '../handlers/marketing_banners_get.handler';

export function registerMarketingBannersGetRoute(app: Hono) {
  app.get("/marketing/banners", marketingBannersGetHandler);
}
