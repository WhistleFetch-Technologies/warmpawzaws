import type { Context } from 'hono';
import { executecustomerSavedPhoneGet } from '../services/customer_saved_phone_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerSavedPhoneGetHandler(c: Context) {
  return executecustomerSavedPhoneGet(c);
}
