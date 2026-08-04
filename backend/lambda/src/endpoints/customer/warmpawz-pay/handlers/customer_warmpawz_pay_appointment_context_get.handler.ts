import type { Context } from 'hono';
import { executeCustomerWarmpawzPayAppointmentContextGet } from '../services/customer_warmpawz_pay_appointment_context_get.service';

export async function customerWarmpawzPayAppointmentContextGetHandler(c: Context) {
  return executeCustomerWarmpawzPayAppointmentContextGet(c);
}
