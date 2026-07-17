import type { Hono } from 'hono';
import { customerPhoneBookingsUpcomingcallsGetHandler } from '../handlers/customer_phone_bookings_upcomingcalls_get.handler';

export function registerCustomerPhoneBookingsUpcomingcallsGetRoute(app: Hono) {
  app.get("/customer/:phone/bookings/upcoming-calls", customerPhoneBookingsUpcomingcallsGetHandler);
}
