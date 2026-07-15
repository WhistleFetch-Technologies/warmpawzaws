import type { Context } from 'hono';
import { executecustomerPetsPost } from '../services/customer_pets_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPetsPostHandler(c: Context) {
  return executecustomerPetsPost(c);
}
