import type { Context } from 'hono';
import { executecustomerPhoneLatestbookingbyvendorGet } from '../services/customer_phone_latestbookingbyvendor_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneLatestbookingbyvendorGetHandler(c: Context) {
  return executecustomerPhoneLatestbookingbyvendorGet(c);
}
