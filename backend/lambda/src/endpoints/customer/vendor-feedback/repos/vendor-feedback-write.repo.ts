import { query, withTransaction } from '../../../../database/rds-connection';
import type {
  VendorFeedbackReviewSource,
  VendorFeedbackSourceType,
} from '../shared/vendor-feedback.types';

export type VendorFeedbackPromptAction = 'dismissed' | 'submitted';

export interface InsertVendorFeedbackReviewInput {
  customerId: string;
  vendorId: string;
  bookingId: string | null;
  paymentId: string | null;
  rating: number;
  comment: string | null;
  reviewSource: VendorFeedbackReviewSource;
  transactionAt: string | Date | null;
  sourceType: VendorFeedbackSourceType;
  sourceId: string;
}

const UPSERT_PROMPT_SQL = `
  INSERT INTO customer_feedback_prompts (customer_id, source_type, source_id, action)
  VALUES ($1::uuid, $2, $3::uuid, $4)
  ON CONFLICT (customer_id, source_type, source_id)
  DO UPDATE SET action = EXCLUDED.action, updated_at = NOW()`;

/**
 * Inserts the review (published + approved, like the existing review flow) and marks
 * the prompt submitted. Returns null when the booking / payment already has a review.
 */
export async function dbInsertVendorFeedbackReview(
  input: InsertVendorFeedbackReviewInput
): Promise<{ reviewId: string } | null> {
  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO reviews (vendor_id, customer_id, booking_id, payment_id, rating, comment,
                            service_type, source_type, transaction_at,
                            is_verified, is_published, is_approved, approved_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, true, true, true, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      // service_type (varchar) and source_type (text) need separate params: Postgres
      // rejects one param inferred as both types (42P08).
      [
        input.vendorId,
        input.customerId,
        input.bookingId,
        input.paymentId,
        input.rating,
        input.comment,
        input.reviewSource,
        input.reviewSource,
        input.transactionAt,
      ]
    );
    const reviewId = inserted.rows[0]?.id as string | undefined;
    if (!reviewId) return null;

    await client.query(UPSERT_PROMPT_SQL, [
      input.customerId,
      input.sourceType,
      input.sourceId,
      'submitted',
    ]);
    return { reviewId };
  });
}

/** Records "Continue to Home" without overwriting an earlier submitted row. */
export async function dbDismissVendorFeedbackPrompt(
  customerId: string,
  sourceType: VendorFeedbackSourceType,
  sourceId: string
): Promise<void> {
  await query(
    `INSERT INTO customer_feedback_prompts (customer_id, source_type, source_id, action)
     VALUES ($1::uuid, $2, $3::uuid, 'dismissed')
     ON CONFLICT (customer_id, source_type, source_id) DO NOTHING`,
    [customerId, sourceType, sourceId]
  );
}
