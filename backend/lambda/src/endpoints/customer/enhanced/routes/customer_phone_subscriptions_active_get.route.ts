import type { Hono } from 'hono';
import { customerPhoneSubscriptionsActiveGetHandler } from '../handlers/customer_phone_subscriptions_active_get.handler';

export function registerCustomerPhoneSubscriptionsActiveGetRoute(app: Hono) {
  app.get('/customer/:phone/subscriptions/active', customerPhoneSubscriptionsActiveGetHandler);
}
