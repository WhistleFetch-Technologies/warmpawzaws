import type { Context } from 'hono';
import { executecustomerPhoneRecommendedservicesGet } from '../services/customer_phone_recommendedservices_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneRecommendedservicesGetHandler(c: Context) {
  return executecustomerPhoneRecommendedservicesGet(c);
}
