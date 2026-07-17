import type { Context } from 'hono';
import { executecustomerByphoneGet } from '../services/customer_byphone_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerByphoneGetHandler(c: Context) {
  return executecustomerByphoneGet(c);
}
