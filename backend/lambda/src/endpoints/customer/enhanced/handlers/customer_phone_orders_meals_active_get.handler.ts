import type { Context } from 'hono';
import { executecustomerPhoneOrdersMealsActiveGet } from '../services/customer_phone_orders_meals_active_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneOrdersMealsActiveGetHandler(c: Context) {
  return executecustomerPhoneOrdersMealsActiveGet(c);
}
