import type { Context } from 'hono';
import { executecustomerPetmatchingGet } from '../services/customer_petmatching_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPetmatchingGetHandler(c: Context) {
  return executecustomerPetmatchingGet(c);
}
