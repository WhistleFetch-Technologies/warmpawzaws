import type { Context } from 'hono';
import { executecustomerMealplanordersGet } from '../services/customer_mealplanorders_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerMealplanordersGetHandler(c: Context) {
  return executecustomerMealplanordersGet(c);
}
