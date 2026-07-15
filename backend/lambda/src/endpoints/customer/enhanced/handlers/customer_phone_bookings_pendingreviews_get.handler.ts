import type { Context } from 'hono';
import { executecustomerPhoneBookingsPendingreviewsGet } from '../services/customer_phone_bookings_pendingreviews_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneBookingsPendingreviewsGetHandler(c: Context) {
  return executecustomerPhoneBookingsPendingreviewsGet(c);
}
