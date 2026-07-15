import type { Hono } from 'hono';
import { customerNotificationsPhoneGetHandler } from '../handlers/customer_notifications_phone_get.handler';

export function registerCustomerNotificationsPhoneGetRoute(app: Hono) {
  app.get("/customer/notifications/:phone", customerNotificationsPhoneGetHandler);
}
