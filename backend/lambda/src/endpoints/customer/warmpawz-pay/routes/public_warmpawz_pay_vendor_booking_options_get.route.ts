import type { Hono } from 'hono';
import { customerWarmpawzPayVendorBookingOptionsGetHandler } from '../handlers/customer_warmpawz_pay_vendor_booking_options_get.handler';

export function registerPublicWarmpawzPayVendorBookingOptionsGetRoute(app: Hono): void {
  app.get(
    '/public/warmpawz-pay/vendors/:vendorId/booking-options',
    customerWarmpawzPayVendorBookingOptionsGetHandler,
  );
}
