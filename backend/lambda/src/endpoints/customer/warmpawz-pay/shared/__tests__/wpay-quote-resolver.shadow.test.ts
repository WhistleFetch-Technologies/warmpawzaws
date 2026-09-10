import { computeWpayDiscountQuote } from '../wpay-discount';
import { resolveWpayPayQuote } from '../wpay-quote-resolver';
import type { WpayVendorListDbRow } from '../../repos/wpay-vendors-list.repo';
import { scheduleWpayPayBillShadow } from '../../../../../discount-engine/adapters/wpay-pay-bill-shadow';

jest.mock('../../../../../discount-engine/adapters/wpay-pay-bill-shadow', () => ({
  scheduleWpayPayBillShadow: jest.fn(),
}));

function withholdVendor(discountValue = 10): WpayVendorListDbRow {
  return {
    catalogue_id: 'cat-1',
    vendor_id: 'vendor-1',
    business_name: 'Test Salon',
    owner_name: null,
    address: null,
    city: null,
    phone: null,
    vendor_type: null,
    metadata: null,
    profile_photo_url: null,
    customer_service: null,
    role_category: null,
    role_config: null,
    legacy_category: null,
    role_name: null,
    role_display_name: null,
    preferred_service_style: null,
    pricing_discount_value: discountValue,
    pricing_status: 'active',
    pricing_effective_from: new Date('2020-01-01T00:00:00.000Z'),
    pricing_effective_until: null,
  };
}

describe('resolveWpayPayQuote shadow hook', () => {
  beforeEach(() => {
    (scheduleWpayPayBillShadow as jest.Mock).mockClear();
  });

  it('returns the existing withhold payable and schedules shadow after', async () => {
    const expected = computeWpayDiscountQuote(1000, 10);
    const resolved = await resolveWpayPayQuote({
      vendorRow: withholdVendor(10),
      quotedAmount: 1000,
      customerId: 'cust-1',
    });

    expect(resolved.commercialModel).toBe('withhold');
    expect(resolved.payableAmount).toBe(expected.payableAmount);
    expect(resolved.quote.discountAmount).toBe(expected.discountAmount);
    expect(resolved.quote.discountPercent).toBe(expected.discountPercent);
    expect(scheduleWpayPayBillShadow).toHaveBeenCalledTimes(1);
    expect(scheduleWpayPayBillShadow).toHaveBeenCalledWith({
      quotedAmount: 1000,
      vendorId: 'vendor-1',
      customerId: 'cust-1',
      wpayDiscountAmount: expected.discountAmount,
      wpayDiscountPercent: expected.discountPercent,
    });
  });

  it('keeps payNow unchanged when shadow scheduler throws', async () => {
    (scheduleWpayPayBillShadow as jest.Mock).mockImplementation(() => {
      throw new Error('shadow schedule exploded');
    });
    const expected = computeWpayDiscountQuote(1000, 10);

    const resolved = await resolveWpayPayQuote({
      vendorRow: withholdVendor(10),
      quotedAmount: 1000,
    });

    expect(resolved.payableAmount).toBe(expected.payableAmount);
    expect(resolved.quote.discountAmount).toBe(expected.discountAmount);
  });
});
