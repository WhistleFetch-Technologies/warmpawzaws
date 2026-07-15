import type { Hono } from 'hono';
import { customerPhoneBookingsPendingreviewsGetHandler } from '../handlers/customer_phone_bookings_pendingreviews_get.handler';

export function registerCustomerPhoneBookingsPendingreviewsGetRoute(app: Hono) {
  app.get('/customer/:phone/bookings/pending-reviews', customerPhoneBookingsPendingreviewsGetHandler);
}
