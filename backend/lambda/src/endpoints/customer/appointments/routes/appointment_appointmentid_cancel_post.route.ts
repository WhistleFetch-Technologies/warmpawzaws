import type { Hono } from 'hono';
import { appointmentAppointmentidCancelPostHandler } from '../handlers/appointment_appointmentid_cancel_post.handler';

export function registerAppointmentAppointmentidCancelPostRoute(app: Hono) {
  app.post('/appointment/:appointmentId/cancel', appointmentAppointmentidCancelPostHandler);
}
