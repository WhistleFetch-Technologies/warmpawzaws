import type { Context } from 'hono';
import { executecustomerPhonePreferencesGet } from '../services/customer_phone_preferences_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhonePreferencesGetHandler(c: Context) {
  return executecustomerPhonePreferencesGet(c);
}
