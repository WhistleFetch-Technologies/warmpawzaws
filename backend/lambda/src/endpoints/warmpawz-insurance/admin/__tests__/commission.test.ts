import { estimateCommission, termsInForce, type CommissionTerms } from '../domain/commission';

const terms = (patch: Partial<CommissionTerms>): CommissionTerms => ({
  basis: 'percent_of_premium',
  rate: 5,
  vendorCommissionRate: null,
  gstRate: 0,
  effectiveFrom: '2026-01-01',
  ...patch,
});

describe('estimateCommission', () => {
  it('applies a percentage of premium with GST on top', () => {
    expect(estimateCommission(terms({ gstRate: 18 }), { premium: 12_345, vendorCommissionAmount: null })).toEqual({
      base: 12_345,
      commission: 617.25,
      gst: 111.11,
      total: 728.36,
      isEstimate: false,
      missingBase: false,
    });
  });

  it('uses the recorded vendor commission when present', () => {
    const r = estimateCommission(terms({ basis: 'percent_of_vendor_commission', rate: 20, vendorCommissionRate: 15 }), {
      premium: 10_000,
      vendorCommissionAmount: 1_200,
    });
    expect(r).toMatchObject({ base: 1_200, commission: 240, isEstimate: false });
  });

  it('falls back to the expected vendor commission rate and flags it as an estimate', () => {
    const r = estimateCommission(terms({ basis: 'percent_of_vendor_commission', rate: 20, vendorCommissionRate: 15 }), {
      premium: 10_000,
      vendorCommissionAmount: null,
    });
    expect(r).toMatchObject({ base: 1_500, commission: 300, isEstimate: true, missingBase: false });
  });

  it('cannot price a vendor-commission share with no amount or expected rate', () => {
    const r = estimateCommission(terms({ basis: 'percent_of_vendor_commission', rate: 20 }), {
      premium: 10_000,
      vendorCommissionAmount: null,
    });
    expect(r).toMatchObject({ commission: 0, missingBase: true });
  });

  it('charges a fixed amount per policy regardless of premium', () => {
    const r = estimateCommission(terms({ basis: 'fixed_per_policy', rate: 250 }), {
      premium: 99_999,
      vendorCommissionAmount: null,
    });
    expect(r).toMatchObject({ base: 1, commission: 250, total: 250 });
  });

  it('flags policies without terms', () => {
    expect(estimateCommission(null, { premium: 5_000, vendorCommissionAmount: null })).toMatchObject({
      total: 0,
      missingBase: true,
    });
  });
});

describe('termsInForce', () => {
  const history = [
    terms({ rate: 5, effectiveFrom: '2026-01-01' }),
    terms({ rate: 7, effectiveFrom: '2026-10-01' }),
    terms({ rate: 9, effectiveFrom: '2027-01-01' }),
  ];
  it('picks the latest terms effective on or before the date', () => {
    expect(termsInForce(history, '2026-09-30')?.rate).toBe(5);
    expect(termsInForce(history, '2026-10-01')?.rate).toBe(7);
    expect(termsInForce(history, '2026-12-31')?.rate).toBe(7);
    expect(termsInForce(history, '2025-12-31')).toBeNull();
  });
});
