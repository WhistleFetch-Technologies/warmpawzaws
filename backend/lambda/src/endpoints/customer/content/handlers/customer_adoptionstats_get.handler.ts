import type { Context } from 'hono';
import { executecustomerAdoptionstatsGet } from '../services/customer_adoptionstats_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAdoptionstatsGetHandler(c: Context) {
  return executecustomerAdoptionstatsGet(c);
}
