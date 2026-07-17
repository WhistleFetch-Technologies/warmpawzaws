import type { Context } from 'hono';
import { executecustomerCustomeridAddressesPost } from '../services/customer_customerid_addresses_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridAddressesPostHandler(c: Context) {
  return executecustomerCustomeridAddressesPost(c);
}
