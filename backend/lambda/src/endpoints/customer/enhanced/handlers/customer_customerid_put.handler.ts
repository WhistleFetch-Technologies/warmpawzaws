import type { Context } from 'hono';
import { executecustomerCustomeridPut } from '../services/customer_customerid_put.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridPutHandler(c: Context) {
  return executecustomerCustomeridPut(c);
}
