import {
  promotionStartDateToIso,
  promotionEndDateToIso,
  isPromotionLiveInIst,
} from '../promotion-date-bounds';

describe('promotion-date-bounds IST', () => {
  it('maps calendar start to IST midnight as UTC', () => {
    const iso = promotionStartDateToIso('2026-06-26');
    expect(iso).toBe('2026-06-25T18:30:00.000Z');
  });

  it('maps calendar end to IST end of day as UTC', () => {
    const iso = promotionEndDateToIso('2026-06-26');
    expect(iso).toBe('2026-06-26T18:29:59.999Z');
  });

  it('end date valid through end of day IST', () => {
    const start = promotionStartDateToIso('2026-06-20');
    const end = promotionEndDateToIso('2026-06-26');
    const middayIst = new Date('2026-06-26T08:00:00.000Z');
    expect(isPromotionLiveInIst(start, end, middayIst)).toBe(true);
    const afterEnd = new Date('2026-06-26T19:00:00.000Z');
    expect(isPromotionLiveInIst(start, end, afterEnd)).toBe(false);
  });

  it('accepts Date objects from pg rows (admin promo edit regression)', () => {
    const start = promotionStartDateToIso(new Date('2026-07-13T18:30:00.000Z'));
    expect(start).toBe('2026-07-13T18:30:00.000Z');
    const end = promotionEndDateToIso(new Date('2026-07-31T00:00:00.000Z'));
    expect(end).toBe('2026-07-31T18:29:59.999Z');
  });

  it('never throws RangeError on unparseable input', () => {
    // Previously new Date('').toISOString() threw "Invalid time value" → admin 500
    expect(() => promotionStartDateToIso('')).not.toThrow();
    expect(() => promotionEndDateToIso('garbage')).not.toThrow();
    expect(() => promotionStartDateToIso(new Date(NaN))).not.toThrow();
  });
});
