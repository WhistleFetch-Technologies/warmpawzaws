import type { Context } from 'hono';
import { executecustomerCartPhoneGet } from '../services/customer_cart_phone_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCartPhoneGetHandler(c: Context) {
  return executecustomerCartPhoneGet(c);
}
