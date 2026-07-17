import type { Context } from 'hono';
import { executecustomerAnnouncementsGet } from '../services/customer_announcements_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAnnouncementsGetHandler(c: Context) {
  return executecustomerAnnouncementsGet(c);
}
