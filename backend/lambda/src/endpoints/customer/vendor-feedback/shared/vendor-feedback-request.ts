import { isValidUUID } from '../../../../types/entities';
import type {
  VendorFeedbackSourceRef,
  VendorFeedbackSubmitInput,
} from './vendor-feedback.types';

export const VENDOR_FEEDBACK_COMMENT_MAX = 500;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

export function parseVendorFeedbackSourceRef(body: unknown): Parsed<VendorFeedbackSourceRef> {
  const b = asRecord(body);
  const sourceType = String(b.sourceType ?? '').trim();
  const sourceId = String(b.sourceId ?? '').trim();
  if (sourceType !== 'booking' && sourceType !== 'payment') {
    return { ok: false, error: "sourceType must be 'booking' or 'payment'" };
  }
  if (!isValidUUID(sourceId)) {
    return { ok: false, error: 'sourceId must be a valid UUID' };
  }
  return { ok: true, value: { sourceType, sourceId } };
}

export function parseVendorFeedbackSubmit(body: unknown): Parsed<VendorFeedbackSubmitInput> {
  const ref = parseVendorFeedbackSourceRef(body);
  if (!ref.ok) return ref;

  const b = asRecord(body);
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'rating must be a whole number from 1 to 5' };
  }

  const rawComment = b.comment == null ? '' : String(b.comment).trim();
  if (rawComment.length > VENDOR_FEEDBACK_COMMENT_MAX) {
    return { ok: false, error: `comment must be ${VENDOR_FEEDBACK_COMMENT_MAX} characters or fewer` };
  }

  return {
    ok: true,
    value: { ...ref.value, rating, comment: rawComment || null },
  };
}
