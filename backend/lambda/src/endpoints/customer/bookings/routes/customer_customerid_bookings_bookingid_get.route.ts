import type { Hono } from 'hono';
import { customerCustomeridBookingsBookingidGetHandler } from '../handlers/customer_customerid_bookings_bookingid_get.handler';

export function registerCustomerCustomeridBookingsBookingidGetRoute(app: Hono) {
  app.get("/customer/:customerId/bookings/:bookingId", customerCustomeridBookingsBookingidGetHandler);
}
