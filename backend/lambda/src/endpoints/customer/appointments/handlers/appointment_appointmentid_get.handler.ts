import type { Context } from 'hono';
import { executeappointmentAppointmentidGet } from '../services/appointment_appointmentid_get.service';

/** HTTP adapter — delegates to service layer. */
export async function appointmentAppointmentidGetHandler(c: Context) {
  return executeappointmentAppointmentidGet(c);
}
