import { parseCreatePricingRequest } from '../dto/pricing.requests';

const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const TIER_ID = '22222222-2222-4222-8222-222222222222';

describe('parseCreatePricingRequest', () => {
  it('requires tierId (catalogue displayed discount is retired)', () => {
    const parsed = parseCreatePricingRequest({
      vendorId: VENDOR_ID,
      tierId: TIER_ID,
      effectiveFrom: '2026-07-01T00:00:00.000Z',
    });
    expect(parsed.tierId).toBe(TIER_ID);
    expect(parsed.discountValue).toBe(0);
  });

  it('rejects platformWithholdPercent on new writes', () => {
    expect(() =>
      parseCreatePricingRequest({
        vendorId: VENDOR_ID,
        tierId: TIER_ID,
        discountValue: 15,
        platformWithholdPercent: 5,
        effectiveFrom: '2026-07-01T00:00:00.000Z',
      }),
    ).toThrow();
  });
});
