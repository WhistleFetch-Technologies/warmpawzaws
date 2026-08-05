import type { Hono } from 'hono';
import { wapptPoliciesGetHandler } from '../handlers/wappt_policies_get.handler';
import { wapptBookingCancellationPolicyGetHandler } from '../handlers/wappt_booking_cancellation_policy_get.handler';
import { wapptBookingRefundPreviewPostHandler } from '../handlers/wappt_booking_refund_preview_post.handler';
import { wapptBookingCancelPostHandler } from '../handlers/wappt_booking_cancel_post.handler';

export function registerWapptPoliciesGetRoute(app: Hono) {
  app.get('/customer/warmpawz-appointments/policies', wapptPoliciesGetHandler);
}

export function registerWapptBookingCancellationPolicyGetRoute(app: Hono) {
  app.get(
    '/customer/warmpawz-appointments/bookings/:bookingId/cancellation-policy',
    wapptBookingCancellationPolicyGetHandler,
  );
}

export function registerWapptBookingRefundPreviewPostRoute(app: Hono) {
  app.post(
    '/customer/warmpawz-appointments/bookings/:bookingId/refund-preview',
    wapptBookingRefundPreviewPostHandler,
  );
}

export function registerWapptBookingCancelPostRoute(app: Hono) {
  app.post(
    '/customer/warmpawz-appointments/bookings/:bookingId/cancel',
    wapptBookingCancelPostHandler,
  );
}
