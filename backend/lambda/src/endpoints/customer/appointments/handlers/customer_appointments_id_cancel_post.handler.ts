import type { Context } from 'hono';
import { executecustomerAppointmentsIdCancelPost } from '../services/customer_appointments_id_cancel_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerAppointmentsIdCancelPostHandler(c: Context) {
  return executecustomerAppointmentsIdCancelPost(c);
}
