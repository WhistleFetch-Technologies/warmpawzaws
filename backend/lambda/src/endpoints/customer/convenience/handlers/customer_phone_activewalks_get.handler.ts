import type { Context } from 'hono';
import { executecustomerPhoneActivewalksGet } from '../services/customer_phone_activewalks_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneActivewalksGetHandler(c: Context) {
  return executecustomerPhoneActivewalksGet(c);
}
