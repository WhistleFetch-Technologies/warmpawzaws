import type { Hono } from 'hono';
import { customerVendorFeedbackDismissPostHandler } from '../handlers/customer_vendor_feedback_dismiss_post.handler';

export function registerCustomerVendorFeedbackDismissPostRoute(app: Hono) {
  app.post('/customer/vendor-feedback/dismiss', customerVendorFeedbackDismissPostHandler);
}
