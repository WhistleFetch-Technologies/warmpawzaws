import type { Hono } from 'hono';
import { customerPhoneLatestbookingbyvendorGetHandler } from '../handlers/customer_phone_latestbookingbyvendor_get.handler';

export function registerCustomerPhoneLatestbookingbyvendorGetRoute(app: Hono) {
  app.get("/customer/:phone/latest-booking-by-vendor", customerPhoneLatestbookingbyvendorGetHandler);
}
