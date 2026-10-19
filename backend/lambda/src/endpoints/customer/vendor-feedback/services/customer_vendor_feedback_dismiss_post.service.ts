import type { Context } from 'hono';
import { resolveCustomerIdFromHonoContext } from '../../../../utils/customer-id-from-auth';
import { dbDismissVendorFeedbackPrompt } from '../repos/vendor-feedback-write.repo';
import { parseVendorFeedbackSourceRef } from '../shared/vendor-feedback-request';

const LOG = '[customer/vendor-feedback/dismiss]';

export async function executeCustomerVendorFeedbackDismissPost(c: Context) {
  const customerId = await resolveCustomerIdFromHonoContext(c);
  if (!customerId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  let body: unknown = null;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }
  const parsed = parseVendorFeedbackSourceRef(body);
  if (!parsed.ok) {
    return c.json({ success: false, error: parsed.error }, 400);
  }

  try {
    await dbDismissVendorFeedbackPrompt(customerId, parsed.value.sourceType, parsed.value.sourceId);
    return c.json({ success: true });
  } catch (error: unknown) {
    console.error(LOG, error);
    return c.json({ success: false, error: 'Failed to record dismissal' }, 500);
  }
}
