import type { Hono } from 'hono';
import { registerDiscoveryByCategoryGetRoute } from './routes/discovery_by_category_get.route';
import { registerDiscoveryByStyleGetRoute } from './routes/discovery_by_style_get.route';
import { registerVendorFeeGetRoute } from './routes/vendor_fee_get.route';
import {
  registerWapptBookingCancelPostRoute,
  registerWapptBookingCancellationPolicyGetRoute,
  registerWapptBookingRefundPreviewPostRoute,
  registerWapptPoliciesGetRoute,
} from './routes/wappt_booking_policy.routes';

export function registerCustomerWarmpawzAppointmentsEndpoints(app: Hono) {
  registerDiscoveryByCategoryGetRoute(app);
  registerDiscoveryByStyleGetRoute(app);
  registerVendorFeeGetRoute(app);
  registerWapptPoliciesGetRoute(app);
  registerWapptBookingCancellationPolicyGetRoute(app);
  registerWapptBookingRefundPreviewPostRoute(app);
  registerWapptBookingCancelPostRoute(app);
}
