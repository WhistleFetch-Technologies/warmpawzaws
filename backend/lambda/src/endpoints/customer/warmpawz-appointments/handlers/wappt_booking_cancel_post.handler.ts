import type { Context } from 'hono';
import { executeWapptBookingCancelPost } from '../services/wappt_booking_cancel_post.service';

export async function wapptBookingCancelPostHandler(c: Context) {
  return executeWapptBookingCancelPost(c);
}
