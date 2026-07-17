import type { Context } from 'hono';
import { executeappointmentAppointmentidCancelPost } from '../services/appointment_appointmentid_cancel_post.service';

/** HTTP adapter — delegates to service layer. */
export async function appointmentAppointmentidCancelPostHandler(c: Context) {
  return executeappointmentAppointmentidCancelPost(c);
}
