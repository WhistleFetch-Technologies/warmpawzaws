import type { Context } from 'hono';
import { resolveCustomerIdFromHonoContext } from '../../../../utils/customer-id-from-auth';
import {
  dbFindVendorFeedbackBooking,
  dbFindVendorFeedbackPayment,
} from '../repos/vendor-feedback-source.repo';
import { dbInsertVendorFeedbackReview } from '../repos/vendor-feedback-write.repo';
import {
  resolveVendorFeedbackKind,
  vendorFeedbackReviewSource,
} from '../shared/vendor-feedback-kind';
import { parseVendorFeedbackSubmit } from '../shared/vendor-feedback-request';

const LOG = '[customer/vendor-feedback]';

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

export async function executeCustomerVendorFeedbackPost(c: Context) {
  const customerId = await resolveCustomerIdFromHonoContext(c);
  if (!customerId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const parsed = parseVendorFeedbackSubmit(await readJsonBody(c));
  if (!parsed.ok) {
    return c.json({ success: false, error: parsed.error }, 400);
  }
  const input = parsed.value;

  try {
    const source =
      input.sourceType === 'booking'
        ? await dbFindVendorFeedbackBooking(customerId, input.sourceId)
        : await dbFindVendorFeedbackPayment(customerId, input.sourceId);
    if (!source) {
      return c.json({ success: false, error: 'Completed transaction not found' }, 404);
    }

    const kind = resolveVendorFeedbackKind(input.sourceType, source.booking_style);
    const saved = await dbInsertVendorFeedbackReview({
      customerId,
      vendorId: source.vendor_id,
      bookingId: source.booking_id,
      paymentId: source.payment_id,
      rating: input.rating,
      comment: input.comment,
      reviewSource: vendorFeedbackReviewSource(kind),
      transactionAt: source.txn_at,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    if (!saved) {
      return c.json({ success: false, error: 'This visit has already been reviewed' }, 409);
    }

    return c.json({ success: true, reviewId: saved.reviewId }, 201);
  } catch (error: unknown) {
    console.error(LOG, error);
    return c.json({ success: false, error: 'Failed to save review' }, 500);
  }
}
