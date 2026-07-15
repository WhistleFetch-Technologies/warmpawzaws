import type { Context } from 'hono';
import { executecustomerProfileGet } from '../services/customer_profile_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerProfileGetHandler(c: Context) {
  return executecustomerProfileGet(c);
}
