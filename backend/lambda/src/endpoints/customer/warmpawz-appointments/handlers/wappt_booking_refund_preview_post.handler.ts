import type { Context } from 'hono';
import { executeWapptBookingRefundPreviewPost } from '../services/wappt_booking_refund_preview_post.service';

export async function wapptBookingRefundPreviewPostHandler(c: Context) {
  return executeWapptBookingRefundPreviewPost(c);
}
