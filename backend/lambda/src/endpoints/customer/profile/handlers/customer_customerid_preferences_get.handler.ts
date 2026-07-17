import type { Context } from 'hono';
import { executecustomerCustomeridPreferencesGet } from '../services/customer_customerid_preferences_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridPreferencesGetHandler(c: Context) {
  return executecustomerCustomeridPreferencesGet(c);
}
