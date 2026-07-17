import type { Context } from 'hono';
import { executecustomerAppointmentsIdReschedulePost } from '../services/customer_appointments_id_reschedule_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAppointmentsIdReschedulePostHandler(c: Context) {
  return executecustomerAppointmentsIdReschedulePost(c);
}
