import type { Context } from 'hono';
import { executeappointmentCustomerCustomeridGet } from '../services/appointment_customer_customerid_get.service';

/** HTTP adapter — delegates to service layer. */
export async function appointmentCustomerCustomeridGetHandler(c: Context) {
  return executeappointmentCustomerCustomeridGet(c);
}
