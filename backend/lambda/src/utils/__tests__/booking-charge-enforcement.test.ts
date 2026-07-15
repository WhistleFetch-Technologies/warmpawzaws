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
  });
});
