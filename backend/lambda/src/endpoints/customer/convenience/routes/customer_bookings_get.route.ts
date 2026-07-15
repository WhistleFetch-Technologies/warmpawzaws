import type { Hono } from 'hono';
import { customerBookingsGetHandler } from '../handlers/customer_bookings_get.handler';

export function registerCustomerBookingsGetRoute(app: Hono) {
  app.get("/customer/bookings", customerBookingsGetHandler);
}
