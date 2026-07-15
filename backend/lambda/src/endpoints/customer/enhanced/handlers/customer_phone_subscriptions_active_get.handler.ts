import type { Context } from 'hono';
import { executecustomerPhoneSubscriptionsActiveGet } from '../services/customer_phone_subscriptions_active_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneSubscriptionsActiveGetHandler(c: Context) {
  return executecustomerPhoneSubscriptionsActiveGet(c);
}
