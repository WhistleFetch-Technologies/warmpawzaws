import type { Context } from 'hono';
import { executecustomerPhoneBookingsUpcomingcallsGet } from '../services/customer_phone_bookings_upcomingcalls_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneBookingsUpcomingcallsGetHandler(c: Context) {
  return executecustomerPhoneBookingsUpcomingcallsGet(c);
}
