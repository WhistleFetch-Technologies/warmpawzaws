import type { Context } from 'hono';
import { executecustomerProfilePost } from '../services/customer_profile_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerProfilePostHandler(c: Context) {
  return executecustomerProfilePost(c);
}
