import type { Hono } from 'hono';
import { customerVendorFeedbackPromptGetHandler } from '../handlers/customer_vendor_feedback_prompt_get.handler';

export function registerCustomerVendorFeedbackPromptGetRoute(app: Hono) {
  app.get('/customer/vendor-feedback/prompt', customerVendorFeedbackPromptGetHandler);
}
