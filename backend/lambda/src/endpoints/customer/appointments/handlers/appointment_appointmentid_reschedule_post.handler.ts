import type { Context } from 'hono';
import { executeappointmentAppointmentidReschedulePost } from '../services/appointment_appointmentid_reschedule_post.service';

/** HTTP adapter — delegates to service layer. */
export async function appointmentAppointmentidReschedulePostHandler(c: Context) {
  return executeappointmentAppointmentidReschedulePost(c);
}
