import type { Context } from 'hono';
import { executeadoptionRequestPost } from '../services/adoption_request_post.service';

/** HTTP adapter — delegates to service layer. */
export async function adoptionRequestPostHandler(c: Context) {
  return executeadoptionRequestPost(c);
}
