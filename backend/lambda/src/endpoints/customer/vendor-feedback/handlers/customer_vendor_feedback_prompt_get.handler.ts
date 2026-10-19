import type { Context } from 'hono';
import { executeCustomerVendorFeedbackPromptGet } from '../services/customer_vendor_feedback_prompt_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerVendorFeedbackPromptGetHandler(c: Context) {
  return executeCustomerVendorFeedbackPromptGet(c);
}
