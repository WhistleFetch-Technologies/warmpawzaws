import { describe, expect, test, jest, beforeEach } from '@jest/globals';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('../resolve-service-booking-tax-item', () => ({
  resolveServiceBookingTaxItem: jest.fn(),
}));

jest.mock('../../lib/services/tax-calculation-service', () => ({
  taxCalculationService: { calculateTax: jest.fn() },
}));

jest.mock('../feeCalculator', () => ({
  calculateFinalFees: jest.fn(),
  mapCatalogCategoryToBusinessType: jest.fn(() => 'boarding'),
}));

import { query } from '../../database/rds-connection';
import { resolveServiceBookingTaxItem } from '../resolve-service-booking-tax-item';
import { taxCalculationService } from '../../lib/services/tax-calculation-service';
import { calculateFinalFees } from '../feeCalculator';
import { resolveExpectedBookingCharge } from '../booking-charge-enforcement';

const mockedQuery = query as jest.MockedFunction<any>;
const mockedResolveTaxItem = resolveServiceBookingTaxItem as jest.MockedFunction<any>;
const mockedCalculateTax = taxCalculationService.calculateTax as jest.MockedFunction<any>;
const mockedFees = calculateFinalFees as jest.MockedFunction<any>;

/** Route mocked SQL by substring. */
function stubQueries(opts: {
  walletDebits?: number;
  completedNonWallet?: number;
  orphanRow?: Record<string, unknown> | null;
  vendorRoleId?: string | null;
  vendorServiceCategory?: string | null;
}) {
  mockedQuery.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes('information_schema.columns') && s.includes('wallet_transactions')) {
      return {
        rows: [
          { column_name: 'booking_id' },
          { column_name: 'reference_type' },
          { column_name: 'reference_id' },
        ],
      };
    }
    if (s.includes('FROM wallet_transactions')) {
      return { rows: [{ total: String(opts.walletDebits ?? 0) }] };
    }
    if (s.includes("payment_status = 'completed'")) {
      return { rows: [{ total: String(opts.completedNonWallet ?? 0) }] };
    }
    if (s.includes('razorpay_order_id IS NULL')) {
      return { rows: opts.orphanRow ? [opts.orphanRow] : [] };
    }
    if (s.includes('FROM vendor_services vs')) {
      return {
        rows:
          opts.vendorServiceCategory !== undefined && opts.vendorServiceCategory !== null
            ? [{ category: opts.vendorServiceCategory, category_id: null, category_name: null }]
            : [],
      };
    }
    if (s.includes('FROM service_catalog')) {
      return { rows: [] };
    }
    if (s.includes('FROM vendors')) {
      return { rows: opts.vendorRoleId ? [{ role_id: opts.vendorRoleId }] : [] };
    }
    return { rows: [] };
  });
}

const BOOKING_ID = '11111111-1111-1111-1111-111111111111';
const VENDOR_ID = '22222222-2222-2222-2222-222222222222';
const SERVICE_ID = '33333333-3333-3333-3333-333333333333';

describe('resolveExpectedBookingCharge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prefers pending payments row from /payments/create (gross already includes GST)', async () => {
    stubQueries({
      walletDebits: 100,
      orphanRow: {
        amount: '2160.00',
        gst_amount: '324.00',
        cgst_amount: '162.00',
        sgst_amount: '162.00',
        igst_amount: '0',
        gst_rule_id: 'rule-1',
      },
    });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: { total_amount: '1800', vendor_id: VENDOR_ID, service_id: SERVICE_ID },
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('payments_row');
    expect(result!.grossTotal).toBe(2160);
    expect(result!.expectedCash).toBe(2060); // 2160 − 100 wallet
    expect(result!.gst).toEqual({ total: 324, cgst: 162, sgst: 162, igst: 0, ruleId: 'rule-1' });
    // Row amount is a lump sum — fee components are unknown.
    expect(result!.fees).toBeNull();
    // Server-priced row exists — no recompute needed.
    expect(mockedCalculateTax).not.toHaveBeenCalled();
  });

  test('recomputes GST + fees when client skipped /payments/create (booking 6b49e9bd scenario)', async () => {
    stubQueries({ orphanRow: null, vendorRoleId: 'role-1', vendorServiceCategory: 'Boarding' });
    mockedResolveTaxItem.mockResolvedValue({
      taxItem: { id: SERVICE_ID, type: 'service', amount: 1800 },
    });
    mockedCalculateTax.mockResolvedValue({
      totalTax: 324,
      totalCGST: 162,
      totalSGST: 162,
      totalIGST: 0,
      items: [{ taxRuleId: 'rule-boarding' }],
    });
    mockedFees.mockResolvedValue({ platformFee: 36, convenienceFee: 0, deliveryFee: 0, packagingFee: 0 });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: {
        total_amount: '1800',
        vendor_id: VENDOR_ID,
        service_id: SERVICE_ID,
        service_style: 'at_center',
      },
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('computed');
    expect(result!.baseAmount).toBe(1800);
    expect(result!.gst?.total).toBe(324);
    expect(result!.feesTotal).toBe(36);
    expect(result!.fees).toEqual({ platformFee: 36, convenienceFee: 0, deliveryFee: 0, packagingFee: 0 });
    expect(result!.grossTotal).toBe(2160);
    expect(result!.expectedCash).toBe(2160); // legacy client sent 1800 — enforcement raises it
    expect(mockedCalculateTax).toHaveBeenCalledTimes(1);
  });

  test('subtracts wallet debits and completed non-wallet payments in computed mode', async () => {
    stubQueries({
      orphanRow: null,
      walletDebits: 500,
      completedNonWallet: 1000,
      vendorRoleId: 'role-1',
      vendorServiceCategory: 'Grooming',
    });
    mockedResolveTaxItem.mockResolvedValue({ taxItem: { id: SERVICE_ID, type: 'service', amount: 2000 } });
    mockedCalculateTax.mockResolvedValue({
      totalTax: 360,
      totalCGST: 180,
      totalSGST: 180,
      totalIGST: 0,
      items: [{ taxRuleId: 'rule-g' }],
    });
    mockedFees.mockResolvedValue({ platformFee: 40, convenienceFee: 10, deliveryFee: 0, packagingFee: 0 });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: { total_amount: '2000', vendor_id: VENDOR_ID, service_id: SERVICE_ID },
    });

    // gross = 2000 + 360 + 50 = 2410; cash = 2410 − 500 − 1000 = 910
    expect(result!.grossTotal).toBe(2410);
    expect(result!.expectedCash).toBe(910);
    expect(result!.fees).toEqual({ platformFee: 40, convenienceFee: 10, deliveryFee: 0, packagingFee: 0 });
  });

  test('never returns negative cash when booking is overpaid', async () => {
    stubQueries({
      orphanRow: { amount: '1000', gst_amount: '0', cgst_amount: '0', sgst_amount: '0', igst_amount: '0', gst_rule_id: null },
      walletDebits: 1500,
    });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: { total_amount: '1000' },
    });

    expect(result!.expectedCash).toBe(0);
  });

  test('returns null when booking has no usable base amount', async () => {
    stubQueries({ orphanRow: null });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: { total_amount: '0' },
    });

    expect(result).toBeNull();
  });

  test('falls back to base + fees when tax engine throws (fail-open on GST only)', async () => {
    stubQueries({ orphanRow: null, vendorRoleId: 'role-1', vendorServiceCategory: 'Boarding' });
    mockedResolveTaxItem.mockRejectedValue(new Error('tax down'));
    mockedFees.mockResolvedValue({ platformFee: 36, convenienceFee: 0, deliveryFee: 0, packagingFee: 0 });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: { total_amount: '1800', vendor_id: VENDOR_ID, service_id: SERVICE_ID },
    });

    expect(result!.gst).toBeNull();
    expect(result!.grossTotal).toBe(1836);
    expect(result!.expectedCash).toBe(1836);
    expect(result!.fees).toEqual({ platformFee: 36, convenienceFee: 0, deliveryFee: 0, packagingFee: 0 });
  });

  test('uses wp_financial_meta.finalPaid as locked all-in (no re-tax on total_amount)', async () => {
    stubQueries({ orphanRow: null });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: {
        total_amount: '2124',
        base_price: '2000',
        notes:
          'wp_financial_meta:{"servicePrice":2000,"vendorDiscount":200,"couponDiscount":0,"subtotalAfterDiscounts":1800,"cgst":162,"sgst":162,"igst":0,"totalTax":324,"platformFee":0,"convenienceFee":0,"deliveryFee":0,"walletAmount":0,"finalPaid":2124}',
      },
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('financial_snapshot');
    expect(result!.grossTotal).toBe(2124);
    expect(result!.expectedCash).toBe(2124);
    expect(result!.gst?.total).toBe(324);
    expect(mockedCalculateTax).not.toHaveBeenCalled();
    expect(mockedFees).not.toHaveBeenCalled();
  });

  test('treats total_amount as locked when it exceeds base_price (all-in without meta)', async () => {
    stubQueries({ orphanRow: null });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: {
        total_amount: '2124',
        base_price: '1800',
      },
    });

    expect(result!.source).toBe('booking_total');
    expect(result!.grossTotal).toBe(2124);
    expect(result!.expectedCash).toBe(2124);
    expect(mockedCalculateTax).not.toHaveBeenCalled();
  });

  test('uses legacy cash finalPaid + walletAmount as all-in gross; cash floor keeps GST for Razorpay', async () => {
    stubQueries({ orphanRow: null, walletDebits: 370.2 });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: {
        total_amount: '29.62',
        base_price: '1999',
        notes:
          'wp_financial_meta:{"subtotalAfterDiscounts":0,"totalTax":359.82,"platformFee":40,"walletAmount":370.2,"finalPaid":29.62}',
      },
    });

    expect(result!.source).toBe('financial_snapshot');
    expect(result!.grossTotal).toBe(399.82);
    // Wallet eligible = gross − GST = 40; Razorpay cash must cover GST (359.82).
    expect(result!.expectedCash).toBe(359.82);
    expect(mockedCalculateTax).not.toHaveBeenCalled();
  });

  test('wallet + GST snapshot: wallet cannot cover GST portion', async () => {
    stubQueries({ orphanRow: null, walletDebits: 1000 });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: {
        total_amount: '1180',
        base_price: '1000',
        notes:
          'wp_financial_meta:{"subtotalAfterDiscounts":1000,"totalTax":180,"platformFee":0,"convenienceFee":0,"deliveryFee":0,"walletAmount":1000,"finalPaid":1180}',
      },
    });

    expect(result!.source).toBe('financial_snapshot');
    expect(result!.grossTotal).toBe(1180);
    expect(result!.expectedCash).toBe(180);
    expect(result!.gst?.total).toBe(180);
  });

  test('reads wallet split pending payment row with total_amount gross and cash remainder', async () => {
    stubQueries({
      walletDebits: 370.2,
      orphanRow: {
        amount: '29.62',
        total_amount: '399.82',
        wallet_amount_used: '370.2',
        gst_amount: '359.82',
        cgst_amount: '179.91',
        sgst_amount: '179.91',
        igst_amount: '0',
        gst_rule_id: null,
      },
    });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: { total_amount: '29.62' },
    });

    expect(result!.source).toBe('payments_row');
    expect(result!.grossTotal).toBe(399.82);
    expect(result!.expectedCash).toBe(29.62);
  });

  test('100% coupon snapshot uses finalPaid not inflated subtotal (COLLABCODE prod regression)', async () => {
    stubQueries({ orphanRow: null });

    const result = await resolveExpectedBookingCharge({
      bookingId: BOOKING_ID,
      booking: {
        total_amount: '40',
        base_price: '1999',
        discount_amount: '1999',
        coupon_code: 'COLLABCODE',
        notes:
          'wp_financial_meta:{"servicePrice":1999,"vendorDiscount":0,"platformDiscount":0,"couponDiscount":1999,"subtotalAfterDiscounts":1999,"cgst":0,"sgst":0,"igst":0,"totalTax":0,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":0,"finalPaid":40}',
      },
    });

    expect(result).not.toBeNull();
    expect(result!.source).toBe('financial_snapshot');
    expect(result!.grossTotal).toBe(40);
    expect(result!.expectedCash).toBe(40);
    expect(mockedCalculateTax).not.toHaveBeenCalled();
  });
});
