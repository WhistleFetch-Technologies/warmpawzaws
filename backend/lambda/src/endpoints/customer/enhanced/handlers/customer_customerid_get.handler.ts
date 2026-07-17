import type { Context } from 'hono';
import { executecustomerCustomeridGet } from '../services/customer_customerid_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridGetHandler(c: Context) {
  return executecustomerCustomeridGet(c);
}
