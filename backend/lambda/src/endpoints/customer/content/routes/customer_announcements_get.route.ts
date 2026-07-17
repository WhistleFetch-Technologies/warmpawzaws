import type { Hono } from 'hono';
import { customerAnnouncementsGetHandler } from '../handlers/customer_announcements_get.handler';

export function registerCustomerAnnouncementsGetRoute(app: Hono) {
  app.get("/customer/announcements", customerAnnouncementsGetHandler);
}
