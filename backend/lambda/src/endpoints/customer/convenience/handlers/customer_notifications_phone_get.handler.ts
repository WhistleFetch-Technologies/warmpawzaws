import type { Context } from 'hono';
import { executecustomerNotificationsPhoneGet } from '../services/customer_notifications_phone_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerNotificationsPhoneGetHandler(c: Context) {
  return executecustomerNotificationsPhoneGet(c);
}
