import type { Context } from 'hono';
import { executecustomerCustomeridBookingsBookingidGet } from '../services/customer_customerid_bookings_bookingid_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridBookingsBookingidGetHandler(c: Context) {
  return executecustomerCustomeridBookingsBookingidGet(c);
}
