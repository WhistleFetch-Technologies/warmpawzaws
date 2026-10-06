import {
  resolveVendorFeedbackKind,
  vendorFeedbackReviewSource,
  vendorFeedbackTitle,
} from '../vendor-feedback-kind';
import { parseVendorFeedbackSubmit, parseVendorFeedbackSourceRef } from '../vendor-feedback-request';

const UUID = '7b0b8c3e-1d2f-4a5b-9c6d-0e1f2a3b4c5d';

describe('resolveVendorFeedbackKind', () => {
  it.each([
    ['booking', 'at_home', 'appointment_at_home'],
    ['booking', 'home_visit', 'appointment_at_home'],
    ['booking', 'at_center', 'appointment_at_clinic'],
    ['booking', 'at_vendor', 'appointment_at_clinic'],
    ['booking', 'tele', 'teleconsultation'],
    ['booking', 'video_call', 'teleconsultation'],
    ['booking', null, 'appointment'],
    ['payment', null, 'warmpawz_pay'],
    ['payment', 'at_home', 'appointment_at_home'],
    ['payment', 'something_else', 'warmpawz_pay'],
  ] as const)('%s + %s → %s', (sourceType, style, expected) => {
    expect(resolveVendorFeedbackKind(sourceType, style)).toBe(expected);
  });

  it('titles and review sources match the kind', () => {
    expect(vendorFeedbackTitle('warmpawz_pay')).toBe(
      'Leave a review for your previous Warmpawz Pay transaction'
    );
    expect(vendorFeedbackTitle('teleconsultation')).toContain('teleconsultation');
    expect(vendorFeedbackReviewSource('appointment_at_clinic')).toBe('at_clinic');
    expect(vendorFeedbackReviewSource('teleconsultation')).toBe('tele');
  });
});

describe('vendor feedback request parsing', () => {
  it('accepts a valid submit and trims the comment', () => {
    const parsed = parseVendorFeedbackSubmit({
      sourceType: 'payment',
      sourceId: UUID,
      rating: 4,
      comment: '  Great visit  ',
    });
    expect(parsed).toEqual({
      ok: true,
      value: { sourceType: 'payment', sourceId: UUID, rating: 4, comment: 'Great visit' },
    });
  });

  it('stores an empty comment as null', () => {
    const parsed = parseVendorFeedbackSubmit({ sourceType: 'booking', sourceId: UUID, rating: 5, comment: '   ' });
    expect(parsed.ok && parsed.value.comment).toBeNull();
  });

  it.each([
    [{ sourceType: 'order', sourceId: UUID, rating: 3 }],
    [{ sourceType: 'booking', sourceId: 'not-a-uuid', rating: 3 }],
    [{ sourceType: 'booking', sourceId: UUID, rating: 0 }],
    [{ sourceType: 'booking', sourceId: UUID, rating: 4.5 }],
    [{ sourceType: 'booking', sourceId: UUID, rating: 6 }],
    [{ sourceType: 'booking', sourceId: UUID, rating: 3, comment: 'x'.repeat(501) }],
  ])('rejects %j', (body) => {
    expect(parseVendorFeedbackSubmit(body).ok).toBe(false);
  });

  it('parses a dismiss ref', () => {
    expect(parseVendorFeedbackSourceRef({ sourceType: 'booking', sourceId: UUID })).toEqual({
      ok: true,
      value: { sourceType: 'booking', sourceId: UUID },
    });
    expect(parseVendorFeedbackSourceRef(null).ok).toBe(false);
  });
});
