import { select, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneReviewsBookingidSkipPost0(phone: string) {
  return await select('customers', { phone: phone.replace(/\D/g, '') });
}

export async function dbCustomerPhoneReviewsBookingidSkipPost1(bookingId: string, customerId: string) {
  return await select('bookings', { id: bookingId, customer_id: customerId });
}

export async function dbCustomerPhoneReviewsBookingidSkipPost2(bookingId: string) {
  return await update('bookings', { id: bookingId }, {
    review_skipped_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
