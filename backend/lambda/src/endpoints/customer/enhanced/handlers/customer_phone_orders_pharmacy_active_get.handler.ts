import type { Context } from 'hono';
import { executecustomerPhoneOrdersPharmacyActiveGet } from '../services/customer_phone_orders_pharmacy_active_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneOrdersPharmacyActiveGetHandler(c: Context) {
  return executecustomerPhoneOrdersPharmacyActiveGet(c);
}
