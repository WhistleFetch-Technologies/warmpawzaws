import type { Hono } from 'hono';
import { marketingAnnouncementsGetHandler } from '../handlers/marketing_announcements_get.handler';

export function registerMarketingAnnouncementsGetRoute(app: Hono) {
  app.get("/marketing/announcements", marketingAnnouncementsGetHandler);
}
