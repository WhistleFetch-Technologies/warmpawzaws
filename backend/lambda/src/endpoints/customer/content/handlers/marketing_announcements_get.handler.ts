import type { Context } from 'hono';
import { executemarketingAnnouncementsGet } from '../services/marketing_announcements_get.service';

/** HTTP adapter — delegates to service layer. */
export async function marketingAnnouncementsGetHandler(c: Context) {
  return executemarketingAnnouncementsGet(c);
}
