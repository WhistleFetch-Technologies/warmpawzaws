import type { Hono } from 'hono';
import { customerVendorFeedbackPostHandler } from '../handlers/customer_vendor_feedback_post.handler';

export function registerCustomerVendorFeedbackPostRoute(app: Hono) {
  app.post('/customer/vendor-feedback', customerVendorFeedbackPostHandler);
}
