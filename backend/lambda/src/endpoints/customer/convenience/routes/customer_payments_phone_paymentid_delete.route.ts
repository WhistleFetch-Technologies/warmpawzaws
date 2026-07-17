import type { Hono } from 'hono';
import { customerPaymentsPhonePaymentidDeleteHandler } from '../handlers/customer_payments_phone_paymentid_delete.handler';

export function registerCustomerPaymentsPhonePaymentidDeleteRoute(app: Hono) {
  app.delete("/customer/payments/:phone/:paymentId", customerPaymentsPhonePaymentidDeleteHandler);
}
