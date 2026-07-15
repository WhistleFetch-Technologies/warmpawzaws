import type { Hono } from 'hono';
import { customerNotificationsPhonePutHandler } from '../handlers/customer_notifications_phone_put.handler';

export function registerCustomerNotificationsPhonePutRoute(app: Hono) {
  app.put("/customer/notifications/:phone", customerNotificationsPhonePutHandler);
}
