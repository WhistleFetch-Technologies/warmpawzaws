import {
  appendRange,
  rangeAppliesText,
  rangeBoundsLabel,
  rangeFromSingle,
  rangeWarnings,
  rangesFromApi,
  rangesToApi,
  removeRange,
  syncPromoFromRanges,
  validateRangesDraft,
} from '../promo-engine/ranges';
import { createEmptyDraft, type PromoEngineBenefit, type PromoRangeDraft } from '../promo-engine/types';

const off = (value: number): PromoEngineBenefit => ({ type: 'DISCOUNT', mode: 'FIXED', value });
const cb = (value: number): PromoEngineBenefit => ({ type: 'CASHBACK', mode: 'FIXED', value, expiryDays: 30 });

function range(min: number | null, max: number | null, benefits: PromoEngineBenefit[] = [off(50)]): PromoRangeDraft {
  return { key: `k${min}-${max}`, label: '', minAmount: min, maxAmount: max, active: true, benefitJson: benefits, limits: {} };
}

describe('promo-engine ranges', () => {
  it('first New range turns the single offer into two ranges sharing a boundary', () => {
    const next = appendRange([rangeFromSingle([off(55)])]);
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ minAmount: null, maxAmount: 500 });
    expect(next[1]).toMatchObject({ minAmount: 500, maxAmount: null });
    expect(next[1].benefitJson).toEqual([off(55)]);
    expect(validateRangesDraft(next)).toEqual([]);
  });

  it('describes bounds; a shared boundary belongs to the lower range', () => {
    const a = range(1, 500);
    const b = range(500, 2000);
    expect(rangeBoundsLabel(a)).toBe('₹1 – ₹500');
    expect(rangeBoundsLabel(range(2000, null))).toBe('₹2,000 and above');
    expect(rangeAppliesText(a, undefined)).toBe('Applies to bills of ₹1 or more and up to ₹500');
    expect(rangeAppliesText(b, a)).toBe('Applies to bills above ₹500 and up to ₹2,000');
  });

  it('blocks overlap, open middle range, inverted bounds and empty active range', () => {
    expect(validateRangesDraft([range(0, 500), range(400, null)])).toContain('Range 2 overlaps Range 1');
    expect(validateRangesDraft([range(0, null), range(500, null)])).toContain(
      'Range 1: only the last range can have no maximum',
    );
    expect(validateRangesDraft([range(500, 100)])).toContain('Range 1: maximum must be above the minimum');
    expect(validateRangesDraft([range(0, null, [off(0)])])).toContain(
      'Range 1: add a discount or cashback (or switch the range off)',
    );
    expect(validateRangesDraft([{ ...range(0, null, [off(0)]), active: false }])).toEqual([]);
  });

  it('names ranges by bill order, not insertion order', () => {
    const errors = validateRangesDraft([range(500, 1000), range(0, 600)]);
    expect(errors).toContain('Range 2 overlaps Range 1');
  });

  it('warns about uncovered bills and fixed discounts that swallow the floor', () => {
    const warnings = rangeWarnings([range(100, 500, [off(150)]), range(600, 1000)], 1000);
    expect(warnings).toEqual(
      expect.arrayContaining([
        'Bills below ₹100 get no offer from this promotion',
        'Bills between ₹500 and ₹600 get no offer from this promotion',
        'Bills above ₹1,000 get no offer from this promotion',
        '₹100 – ₹500: ₹150 off covers the whole bill at ₹100',
      ]),
    );
  });

  it('round-trips through the API shape in bill order and drops zero-value benefits', () => {
    const body = rangesToApi([range(500, null, [off(0), cb(100)]), { ...range(0, 500), id: 'r1', label: ' Small ' }]);
    expect(body.map((r) => r.minAmount)).toEqual([0, 500]);
    expect(body[0]).toMatchObject({ id: 'r1', label: 'Small' });
    expect(body[1].benefitJson).toEqual([cb(100)]);
    const back = rangesFromApi([{ ...body[0], budgetConsumed: '12.5', usage: { uses: 2 } }]);
    expect(back[0]).toMatchObject({ id: 'r1', key: 'r1', minAmount: 0, maxAmount: 500, budgetConsumed: 12.5 });
    expect(back[0].usage?.uses).toBe(2);
  });

  it('removing the last range returns to a single offer; syncing mirrors the first range', () => {
    const draft = { ...createEmptyDraft('d'), ranges: [range(0, null, [off(80), cb(0)])] };
    const single = removeRange(draft, draft.ranges[0].key);
    expect(single.ranges).toEqual([]);
    expect(single.benefitJson).toEqual([off(80)]);

    const synced = syncPromoFromRanges({ ...draft, ranges: [range(500, null, [cb(100)]), range(0, 500, [off(50)])] });
    expect(synced.benefitJson).toEqual([off(50)]);
    expect(synced.vcf?.benefitMode).toBe('both');
  });
});
