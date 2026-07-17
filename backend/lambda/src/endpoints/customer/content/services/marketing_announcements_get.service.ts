import type { Context } from 'hono';
import { executecustomerAnnouncementsGet } from './customer_announcements_get.service';

/** Alias: /marketing/announcements → same handler as /customer/announcements */
export async function executemarketingAnnouncementsGet(c: Context) {
  return executecustomerAnnouncementsGet(c);
}
