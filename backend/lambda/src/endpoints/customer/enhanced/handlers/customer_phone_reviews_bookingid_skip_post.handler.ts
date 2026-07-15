import type { Context } from 'hono';
import { executecustomerPhoneReviewsBookingidSkipPost } from '../services/customer_phone_reviews_bookingid_skip_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerPhoneReviewsBookingidSkipPostHandler(c: Context) {
  return executecustomerPhoneReviewsBookingidSkipPost(c);
}
