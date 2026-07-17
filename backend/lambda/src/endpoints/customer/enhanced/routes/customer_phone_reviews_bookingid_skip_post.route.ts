import type { Hono } from 'hono';
import { customerPhoneReviewsBookingidSkipPostHandler } from '../handlers/customer_phone_reviews_bookingid_skip_post.handler';

export function registerCustomerPhoneReviewsBookingidSkipPostRoute(app: Hono) {
  app.post('/customer/:phone/reviews/:bookingId/skip', customerPhoneReviewsBookingidSkipPostHandler);
}
