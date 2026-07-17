import type { Context } from 'hono';
import { executecustomerCustomeridSearchhistoryGet } from '../services/customer_customerid_searchhistory_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridSearchhistoryGetHandler(c: Context) {
  return executecustomerCustomeridSearchhistoryGet(c);
}
