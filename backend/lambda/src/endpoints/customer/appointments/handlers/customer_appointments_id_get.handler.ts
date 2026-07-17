import type { Context } from 'hono';
import { executecustomerAppointmentsIdGet } from '../services/customer_appointments_id_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAppointmentsIdGetHandler(c: Context) {
  return executecustomerAppointmentsIdGet(c);
}
