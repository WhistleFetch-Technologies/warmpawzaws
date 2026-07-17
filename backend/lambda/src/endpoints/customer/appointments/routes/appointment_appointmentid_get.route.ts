import type { Hono } from 'hono';
import { appointmentAppointmentidGetHandler } from '../handlers/appointment_appointmentid_get.handler';

export function registerAppointmentAppointmentidGetRoute(app: Hono) {
  app.get('/appointment/:appointmentId', appointmentAppointmentidGetHandler);
}
