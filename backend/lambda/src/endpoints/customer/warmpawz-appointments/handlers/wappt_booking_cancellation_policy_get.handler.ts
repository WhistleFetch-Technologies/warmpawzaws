import type { Context } from 'hono';
import { executeWapptBookingCancellationPolicyGet } from '../services/wappt_booking_cancellation_policy_get.service';

export async function wapptBookingCancellationPolicyGetHandler(c: Context) {
  return executeWapptBookingCancellationPolicyGet(c);
}
