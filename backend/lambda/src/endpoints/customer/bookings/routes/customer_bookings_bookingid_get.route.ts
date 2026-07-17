import type { Hono } from 'hono';
import { customerBookingsBookingidGetHandler } from '../handlers/customer_bookings_bookingid_get.handler';

export function registerCustomerBookingsBookingidGetRoute(app: Hono) {
  app.get("/customer/bookings/:bookingId", customerBookingsBookingidGetHandler);
}
