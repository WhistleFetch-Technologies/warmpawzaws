import type { Context } from 'hono';
import { executecustomerCustomeridSearchhistoryPost } from '../services/customer_customerid_searchhistory_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridSearchhistoryPostHandler(c: Context) {
  return executecustomerCustomeridSearchhistoryPost(c);
}
