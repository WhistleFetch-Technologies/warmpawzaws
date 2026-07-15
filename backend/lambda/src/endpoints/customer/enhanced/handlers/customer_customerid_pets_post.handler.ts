import type { Context } from 'hono';
import { executecustomerCustomeridPetsPost } from '../services/customer_customerid_pets_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridPetsPostHandler(c: Context) {
  return executecustomerCustomeridPetsPost(c);
}
