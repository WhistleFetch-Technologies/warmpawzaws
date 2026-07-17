import type { Context } from 'hono';
import { executecustomerBookingsActiveGet } from '../services/customer_bookings_active_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerBookingsActiveGetHandler(c: Context) {
  return executecustomerBookingsActiveGet(c);
}
