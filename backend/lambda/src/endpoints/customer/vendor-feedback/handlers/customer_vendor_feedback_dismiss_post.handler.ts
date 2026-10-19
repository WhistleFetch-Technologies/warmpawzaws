import type { Context } from 'hono';
import { executeCustomerVendorFeedbackDismissPost } from '../services/customer_vendor_feedback_dismiss_post.service';

/** HTTP adapter — delegates to service layer. */
export async function customerVendorFeedbackDismissPostHandler(c: Context) {
  return executeCustomerVendorFeedbackDismissPost(c);
}
