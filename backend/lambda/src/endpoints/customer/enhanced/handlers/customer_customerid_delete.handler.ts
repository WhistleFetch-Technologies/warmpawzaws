import type { Context } from 'hono';
import { executecustomerCustomeridDelete } from '../services/customer_customerid_delete.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridDeleteHandler(c: Context) {
  return executecustomerCustomeridDelete(c);
}
