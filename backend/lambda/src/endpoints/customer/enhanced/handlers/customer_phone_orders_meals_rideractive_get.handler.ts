import type { Context } from 'hono';
import { executecustomerPhoneOrdersMealsRideractiveGet } from '../services/customer_phone_orders_meals_rideractive_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneOrdersMealsRideractiveGetHandler(c: Context) {
  return executecustomerPhoneOrdersMealsRideractiveGet(c);
}
