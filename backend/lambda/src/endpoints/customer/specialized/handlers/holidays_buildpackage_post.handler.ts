import type { Context } from 'hono';
import { executeholidaysBuildpackagePost } from '../services/holidays_buildpackage_post.service';

/** HTTP adapter — delegates to service layer. */
export async function holidaysBuildpackagePostHandler(c: Context) {
  return executeholidaysBuildpackagePost(c);
}
