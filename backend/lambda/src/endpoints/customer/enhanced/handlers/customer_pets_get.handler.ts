import type { Context } from 'hono';
import { executecustomerPetsGet } from '../services/customer_pets_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPetsGetHandler(c: Context) {
  return executecustomerPetsGet(c);
}
