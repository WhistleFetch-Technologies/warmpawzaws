import type { Context } from 'hono';
import { executecustomerCustomeridBookingsGet } from '../services/customer_customerid_bookings_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridBookingsGetHandler(c: Context) {
  return executecustomerCustomeridBookingsGet(c);
}
