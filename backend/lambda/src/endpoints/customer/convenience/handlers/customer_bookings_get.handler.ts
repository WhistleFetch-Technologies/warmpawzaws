import type { Context } from 'hono';
import { executecustomerBookingsGet } from '../services/customer_bookings_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerBookingsGetHandler(c: Context) {
  return executecustomerBookingsGet(c);
}
