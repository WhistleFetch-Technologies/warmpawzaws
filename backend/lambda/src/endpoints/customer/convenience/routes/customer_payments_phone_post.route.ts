import type { Hono } from 'hono';
import { customerPaymentsPhonePostHandler } from '../handlers/customer_payments_phone_post.handler';

export function registerCustomerPaymentsPhonePostRoute(app: Hono) {
  app.post("/customer/payments/:phone", customerPaymentsPhonePostHandler);
}
