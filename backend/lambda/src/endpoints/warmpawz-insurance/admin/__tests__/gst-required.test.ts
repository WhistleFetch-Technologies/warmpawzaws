import { commissionTermsInputSchema } from '../dto/insurance-admin.requests';

const terms = {
  basis: 'percent_of_premium' as const,
  rate: 5,
  effectiveFrom: '2026-10-13',
};

describe('commission GST', () => {
  it('requires a GST rate and does not default it', () => {
    expect(commissionTermsInputSchema.parse({ ...terms, gstRate: 0 }).gstRate).toBe(0);
    expect(commissionTermsInputSchema.parse({ ...terms, gstRate: 18 }).gstRate).toBe(18);
    expect(() => commissionTermsInputSchema.parse(terms)).toThrow();
    expect(() => commissionTermsInputSchema.parse({ ...terms, gstRate: '' })).toThrow();
  });
});
