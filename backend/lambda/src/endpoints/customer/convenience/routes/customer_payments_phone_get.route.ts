import type { Hono } from 'hono';
import { customerPaymentsPhoneGetHandler } from '../handlers/customer_payments_phone_get.handler';

export function registerCustomerPaymentsPhoneGetRoute(app: Hono) {
  app.get("/customer/payments/:phone", customerPaymentsPhoneGetHandler);
}
