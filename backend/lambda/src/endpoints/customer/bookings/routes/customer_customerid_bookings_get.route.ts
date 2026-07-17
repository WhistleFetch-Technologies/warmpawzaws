import type { Hono } from 'hono';
import { customerCustomeridBookingsGetHandler } from '../handlers/customer_customerid_bookings_get.handler';

export function registerCustomerCustomeridBookingsGetRoute(app: Hono) {
  app.get("/customer/:customerId/bookings", customerCustomeridBookingsGetHandler);
}
