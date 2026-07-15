import type { Context } from 'hono';
import { executecustomerPetsPhoneGet } from '../services/customer_pets_phone_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPetsPhoneGetHandler(c: Context) {
  return executecustomerPetsPhoneGet(c);
}
