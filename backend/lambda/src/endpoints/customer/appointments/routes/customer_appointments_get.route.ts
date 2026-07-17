import type { Hono } from 'hono';
import { customerAppointmentsGetHandler } from '../handlers/customer_appointments_get.handler';

export function registerCustomerAppointmentsGetRoute(app: Hono) {
  app.get('/customer/appointments', customerAppointmentsGetHandler);
}
