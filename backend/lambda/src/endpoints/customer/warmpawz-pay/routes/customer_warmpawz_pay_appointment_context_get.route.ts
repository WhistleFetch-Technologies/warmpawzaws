import type { Hono } from 'hono';
import { customerWarmpawzPayAppointmentContextGetHandler } from '../handlers/customer_warmpawz_pay_appointment_context_get.handler';

export function registerCustomerWarmpawzPayAppointmentContextGetRoute(app: Hono): void {
  app.get('/customer/warmpawz-pay/appointment-context', customerWarmpawzPayAppointmentContextGetHandler);
}
