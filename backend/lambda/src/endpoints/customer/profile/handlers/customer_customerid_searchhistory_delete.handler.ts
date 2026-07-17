import type { Context } from 'hono';
import { executecustomerCustomeridSearchhistoryDelete } from '../services/customer_customerid_searchhistory_delete.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridSearchhistoryDeleteHandler(c: Context) {
  return executecustomerCustomeridSearchhistoryDelete(c);
}
