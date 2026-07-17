import type { Context } from 'hono';
import { executecustomerAddressesPost } from '../services/customer_addresses_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAddressesPostHandler(c: Context) {
  return executecustomerAddressesPost(c);
}
