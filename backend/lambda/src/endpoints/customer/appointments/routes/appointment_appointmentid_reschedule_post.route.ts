import type { Hono } from 'hono';
import { appointmentAppointmentidReschedulePostHandler } from '../handlers/appointment_appointmentid_reschedule_post.handler';

export function registerAppointmentAppointmentidReschedulePostRoute(app: Hono) {
  app.post('/appointment/:appointmentId/reschedule', appointmentAppointmentidReschedulePostHandler);
}
