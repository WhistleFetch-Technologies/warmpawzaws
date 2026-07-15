import type { Context } from 'hono';
import { executecustomerNotificationsPhonePut } from '../services/customer_notifications_phone_put.service';

/** HTTP adapter — delegates to service layer. */
export async function customerNotificationsPhonePutHandler(c: Context) {
  return executecustomerNotificationsPhonePut(c);
}
