import type { Context } from 'hono';
import { executecustomerBookingsBookingidGet } from '../services/customer_bookings_bookingid_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerBookingsBookingidGetHandler(c: Context) {
  return executecustomerBookingsBookingidGet(c);
}
