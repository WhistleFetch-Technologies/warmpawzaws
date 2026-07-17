import type { Hono } from 'hono';
import { registerCustomerAppointmentsGetRoute } from './routes/customer_appointments_get.route';
import { registerCustomerAppointmentsIdGetRoute } from './routes/customer_appointments_id_get.route';
import { registerCustomerAppointmentsIdReschedulePostRoute } from './routes/customer_appointments_id_reschedule_post.route';
import { registerCustomerAppointmentsIdCancelPostRoute } from './routes/customer_appointments_id_cancel_post.route';
import { registerAppointmentCustomerCustomeridGetRoute } from './routes/appointment_customer_customerid_get.route';
import { registerAppointmentAppointmentidGetRoute } from './routes/appointment_appointmentid_get.route';
import { registerAppointmentAppointmentidCancelPostRoute } from './routes/appointment_appointmentid_cancel_post.route';
import { registerAppointmentAppointmentidReschedulePostRoute } from './routes/appointment_appointmentid_reschedule_post.route';

export function registerCustomerAppointmentsEndpoints(app: Hono) {
  registerCustomerAppointmentsGetRoute(app);
  registerCustomerAppointmentsIdGetRoute(app);
  registerCustomerAppointmentsIdReschedulePostRoute(app);
  registerCustomerAppointmentsIdCancelPostRoute(app);
  registerAppointmentCustomerCustomeridGetRoute(app);
  registerAppointmentAppointmentidGetRoute(app);
  registerAppointmentAppointmentidCancelPostRoute(app);
  registerAppointmentAppointmentidReschedulePostRoute(app);
}
