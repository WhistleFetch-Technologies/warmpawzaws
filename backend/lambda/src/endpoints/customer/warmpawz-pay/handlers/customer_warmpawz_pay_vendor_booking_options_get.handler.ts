import type { Context } from 'hono';
import { executeCustomerWarmpawzPayVendorBookingOptionsGet } from '../services/customer_warmpawz_pay_vendor_booking_options_get.service';

export function customerWarmpawzPayVendorBookingOptionsGetHandler(c: Context) {
  return executeCustomerWarmpawzPayVendorBookingOptionsGet(c);
}
