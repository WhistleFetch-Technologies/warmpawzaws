import type { Hono } from 'hono';
import { registerCustomerCustomeridBookingsGetRoute } from './routes/customer_customerid_bookings_get.route';
import { registerCustomerBookingsBookingidGetRoute } from './routes/customer_bookings_bookingid_get.route';
import { registerCustomerCustomeridBookingsBookingidGetRoute } from './routes/customer_customerid_bookings_bookingid_get.route';
import { registerCustomerCustomeridBookingsFollowupeligibleGetRoute } from './routes/customer_customerid_bookings_followupeligible_get.route';

export function registerCustomerBookingHistoryEndpoints(app: Hono) {
  registerCustomerCustomeridBookingsGetRoute(app);
  registerCustomerBookingsBookingidGetRoute(app);
  registerCustomerCustomeridBookingsBookingidGetRoute(app);
  registerCustomerCustomeridBookingsFollowupeligibleGetRoute(app);
}
