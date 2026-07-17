import type { Context } from 'hono';
import { executecustomerCustomeridPreferencesPut } from '../services/customer_customerid_preferences_put.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridPreferencesPutHandler(c: Context) {
  return executecustomerCustomeridPreferencesPut(c);
}
