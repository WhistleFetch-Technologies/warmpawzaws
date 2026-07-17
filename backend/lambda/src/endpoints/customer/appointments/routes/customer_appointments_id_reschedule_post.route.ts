import type { Hono } from 'hono';
import { customerAppointmentsIdReschedulePostHandler } from '../handlers/customer_appointments_id_reschedule_post.handler';

export function registerCustomerAppointmentsIdReschedulePostRoute(app: Hono) {
  app.post('/customer/appointments/:id/reschedule', customerAppointmentsIdReschedulePostHandler);
}
