import type { Context } from 'hono';
import { executecustomerPetmatchingRequestPost } from '../services/customer_petmatching_request_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPetmatchingRequestPostHandler(c: Context) {
  return executecustomerPetmatchingRequestPost(c);
}
