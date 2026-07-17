import type { Hono } from 'hono';
import { customerAppointmentsIdGetHandler } from '../handlers/customer_appointments_id_get.handler';

export function registerCustomerAppointmentsIdGetRoute(app: Hono) {
  app.get('/customer/appointments/:id', customerAppointmentsIdGetHandler);
}
