import type { Context } from 'hono';
import { executecustomerCustomeridBookingsFollowupeligibleGet } from '../services/customer_customerid_bookings_followupeligible_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCustomeridBookingsFollowupeligibleGetHandler(c: Context) {
  return executecustomerCustomeridBookingsFollowupeligibleGet(c);
}
