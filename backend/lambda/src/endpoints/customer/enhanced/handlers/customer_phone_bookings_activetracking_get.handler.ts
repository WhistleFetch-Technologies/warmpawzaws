import type { Context } from 'hono';
import { executecustomerPhoneBookingsActivetrackingGet } from '../services/customer_phone_bookings_activetracking_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneBookingsActivetrackingGetHandler(c: Context) {
  return executecustomerPhoneBookingsActivetrackingGet(c);
}
