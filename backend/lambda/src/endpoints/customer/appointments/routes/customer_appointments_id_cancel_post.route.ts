import type { Hono } from 'hono';
import { customerAppointmentsIdCancelPostHandler } from '../handlers/customer_appointments_id_cancel_post.handler';

export function registerCustomerAppointmentsIdCancelPostRoute(app: Hono) {
  app.post('/customer/appointments/:id/cancel', customerAppointmentsIdCancelPostHandler);
}
