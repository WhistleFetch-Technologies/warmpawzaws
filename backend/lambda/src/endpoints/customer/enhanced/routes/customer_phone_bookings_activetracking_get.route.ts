import type { Hono } from 'hono';
import { customerPhoneBookingsActivetrackingGetHandler } from '../handlers/customer_phone_bookings_activetracking_get.handler';

export function registerCustomerPhoneBookingsActivetrackingGetRoute(app: Hono) {
  app.get('/customer/:phone/bookings/active-tracking', customerPhoneBookingsActivetrackingGetHandler);
}
