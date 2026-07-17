import type { Hono } from 'hono';
import { customerCustomeridBookingsFollowupeligibleGetHandler } from '../handlers/customer_customerid_bookings_followupeligible_get.handler';

export function registerCustomerCustomeridBookingsFollowupeligibleGetRoute(app: Hono) {
  app.get("/customer/:customerId/bookings/follow-up-eligible", customerCustomeridBookingsFollowupeligibleGetHandler);
}
