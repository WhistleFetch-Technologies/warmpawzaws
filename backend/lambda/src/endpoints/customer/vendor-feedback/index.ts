import type { Hono } from 'hono';
import { registerCustomerVendorFeedbackPromptGetRoute } from './routes/customer_vendor_feedback_prompt_get.route';
import { registerCustomerVendorFeedbackPostRoute } from './routes/customer_vendor_feedback_post.route';
import { registerCustomerVendorFeedbackDismissPostRoute } from './routes/customer_vendor_feedback_dismiss_post.route';

export function registerCustomerVendorFeedbackEndpoints(app: Hono) {
  registerCustomerVendorFeedbackPromptGetRoute(app);
  registerCustomerVendorFeedbackPostRoute(app);
  registerCustomerVendorFeedbackDismissPostRoute(app);
}
