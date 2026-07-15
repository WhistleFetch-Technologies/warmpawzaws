import type { Context } from 'hono';
import { executecustomerAppointmentsGet } from '../services/customer_appointments_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAppointmentsGetHandler(c: Context) {
  return executecustomerAppointmentsGet(c);
}
