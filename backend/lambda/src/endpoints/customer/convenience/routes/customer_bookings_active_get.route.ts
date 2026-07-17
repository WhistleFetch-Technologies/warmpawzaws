import type { Hono } from 'hono';
import { customerBookingsActiveGetHandler } from '../handlers/customer_bookings_active_get.handler';

export function registerCustomerBookingsActiveGetRoute(app: Hono) {
  app.get("/customer/bookings/active", customerBookingsActiveGetHandler);
}
