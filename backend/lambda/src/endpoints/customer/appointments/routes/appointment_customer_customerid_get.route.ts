import type { Hono } from 'hono';
import { appointmentCustomerCustomeridGetHandler } from '../handlers/appointment_customer_customerid_get.handler';

export function registerAppointmentCustomerCustomeridGetRoute(app: Hono) {
  app.get('/appointment/customer/:customerId', appointmentCustomerCustomeridGetHandler);
}
