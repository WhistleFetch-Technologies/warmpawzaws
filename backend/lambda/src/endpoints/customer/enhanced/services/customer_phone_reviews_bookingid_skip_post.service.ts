import type { Context } from 'hono';
import * as customer_phone_reviews_bookingid_skip_postRepo from '../repos/customer_phone_reviews_bookingid_skip_post.repo';

export async function executecustomerPhoneReviewsBookingidSkipPost(c: Context) {
  try {
    const phone = c.req.param('phone');
    const bookingId = c.req.param('bookingId');

    const customers = await customer_phone_reviews_bookingid_skip_postRepo.dbCustomerPhoneReviewsBookingidSkipPost0(
      phone
    );
    if (customers.length === 0) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const customer = customers[0];
    const bookings = await customer_phone_reviews_bookingid_skip_postRepo.dbCustomerPhoneReviewsBookingidSkipPost1(bookingId, customer.id);
    if (bookings.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    await customer_phone_reviews_bookingid_skip_postRepo.dbCustomerPhoneReviewsBookingidSkipPost2(bookingId);

    return c.json({
      success: true,
      message: 'Review skipped',
    });
  } catch (error: any) {
    console.error('Error skipping review:', error);
    return c.json({ error: error.message }, 500);
  }
}
