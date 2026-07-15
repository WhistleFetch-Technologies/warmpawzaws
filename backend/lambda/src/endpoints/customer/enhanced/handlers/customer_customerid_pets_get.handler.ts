import type { Context } from 'hono';
import { executecustomerCustomeridPetsGet } from '../services/customer_customerid_pets_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridPetsGetHandler(c: Context) {
  return executecustomerCustomeridPetsGet(c);
}
