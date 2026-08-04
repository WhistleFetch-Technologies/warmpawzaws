import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
  breakdownFromFeeBreakdownJson,
  breakdownFromPaymentColumns,
  feeBreakdownForVendor,
  hasMeaningfulCustomerPaidBreakdown,
  mergeFeeBreakdownIntoAccrualRows,
  recomputeBookingCustomerPaidFeeBreakdown,
  resolveBookingCustomerPaidFeeBreakdown,
  sumAccrualFeeBreakdowns,
  VENDOR_ACCRUAL_FEE_CSV_HEADERS,
} from '../vendor-accrual-fee-breakdown';

jest.mock('../feeCalculator', () => ({
  calculateFinalFees: jest.fn(),
  mapCatalogCategoryToBusinessType: jest.fn((raw?: string | null) => {
    const x = String(raw || '').toLowerCase();
    if (x.includes('groom')) return 'grooming';
    if (x.includes('vet')) return 'veterinary';
    return x;
  }),
}));

jest.mock('../../lib/services/tax-calculation-service', () => ({
  taxCalculationService: {
    calculateTax: jest.fn(),
  },
}));

jest.mock('../resolve-service-booking-tax-item', () => ({
  resolveServiceBookingTaxItem: jest.fn(),
}));

import { calculateFinalFees } from '../feeCalculator';
import { taxCalculationService } from '../../lib/services/tax-calculation-service';
import { resolveServiceBookingTaxItem } from '../resolve-service-booking-tax-item';

const mockedCalculateFinalFees = calculateFinalFees as jest.MockedFunction<typeof calculateFinalFees>;
const mockedCalculateTax = taxCalculationService.calculateTax as jest.MockedFunction<
  typeof taxCalculationService.calculateTax
>;
const mockedResolveServiceBookingTaxItem = resolveServiceBookingTaxItem as jest.MockedFunction<
  typeof resolveServiceBookingTaxItem
>;

describe('vendor-accrual-fee-breakdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveServiceBookingTaxItem.mockResolvedValue({
      taxItem: {
        id: 'bk-tele',
        type: 'service',
        amount: 400,
        quantity: 1,
        catalogCategoryId: 'veterinary-uuid',
        serviceStyle: 'tele',
        roleId: 'role-vet',
        gstApplicationScope: 'service_booking',
      },
    });
  });

  test('VENDOR_ACCRUAL_FEE_CSV_HEADERS lists investor columns', () => {
    expect(VENDOR_ACCRUAL_FEE_CSV_HEADERS).toEqual([
      'platform_fee',
      'convenience_fee',
      'delivery_fee',
      'gst_total',
    ]);
  });

  test('mergeFeeBreakdownIntoAccrualRows attaches fee fields', () => {
    const map = new Map([
      [
        'v1',
        {
          platformFee: 10,
          convenienceFee: 9,
          deliveryFee: 50,
          cgstAmount: 1,
          sgstAmount: 1,
          igstAmount: 0,
          gstTotal: 2,
        },
      ],
    ]);
    const [row] = mergeFeeBreakdownIntoAccrualRows([{ vendor_id: 'v1', gross_amount: 100 }], map);
    expect(row.platform_fee).toBe(10);
    expect(row.convenience_fee).toBe(9);
    expect(row.delivery_fee).toBe(50);
    expect(row.cgst_amount).toBe(1);
    expect(row.sgst_amount).toBe(1);
    expect(row.igst_amount).toBe(0);
    expect(row.gst_total).toBe(2);
  });

  test('feeBreakdownForVendor returns zeros when missing', () => {
    const fb = feeBreakdownForVendor(new Map(), 'unknown');
    expect(fb.platformFee).toBe(0);
    expect(fb.gstTotal).toBe(0);
  });

  test('sumAccrualFeeBreakdowns totals rows', () => {
    const total = sumAccrualFeeBreakdowns([
      { platform_fee: 10, convenience_fee: 5, delivery_fee: 0, cgst_amount: 1, sgst_amount: 1, igst_amount: 0, gst_total: 2 },
      { platform_fee: 2, convenience_fee: 1, delivery_fee: 20, cgst_amount: 0, sgst_amount: 0, igst_amount: 3, gst_total: 3 },
    ]);
    expect(total.platformFee).toBe(12);
    expect(total.convenienceFee).toBe(6);
    expect(total.deliveryFee).toBe(20);
    expect(total.cgstAmount).toBe(1);
    expect(total.sgstAmount).toBe(1);
    expect(total.igstAmount).toBe(3);
    expect(total.gstTotal).toBe(5);
  });

  test('breakdownFromPaymentColumns uses payment fee columns', () => {
    const b = breakdownFromPaymentColumns({
      platform_fee: 20,
      convenience_fee: 9,
      delivery_fee: 30,
      cgst_amount: 4.5,
      sgst_amount: 4.5,
      igst_amount: 0,
      gst_amount: 99,
    });
    expect(b.platformFee).toBe(20);
    expect(b.convenienceFee).toBe(9);
    expect(b.deliveryFee).toBe(30);
    expect(b.gstTotal).toBe(9);
  });

  test('breakdownFromFeeBreakdownJson parses camelCase JSON', () => {
    const b = breakdownFromFeeBreakdownJson({
      platformFee: 15,
      convenienceFee: 5,
      deliveryFee: 40,
      cgstAmount: 2,
      sgstAmount: 2,
    });
    expect(b.platformFee).toBe(15);
    expect(b.convenienceFee).toBe(5);
    expect(b.deliveryFee).toBe(40);
    expect(b.gstTotal).toBe(4);
  });

  test('hasMeaningfulCustomerPaidBreakdown is false for empty Razorpay rows', () => {
    expect(hasMeaningfulCustomerPaidBreakdown(breakdownFromPaymentColumns({ amount: 500 }))).toBe(false);
  });

  test('resolveBookingCustomerPaidFeeBreakdown prefers payment columns', async () => {
    const b = await resolveBookingCustomerPaidFeeBreakdown({
      bookingId: 'bk-1',
      basePrice: 1000,
      payment: { platform_fee: 20, gst_amount: 180 },
    });
    expect(b.platformFee).toBe(20);
    expect(b.gstTotal).toBe(180);
    expect(mockedCalculateFinalFees).not.toHaveBeenCalled();
  });

  test('resolveBookingCustomerPaidFeeBreakdown falls back to fee_breakdown JSON', async () => {
    const b = await resolveBookingCustomerPaidFeeBreakdown({
      bookingId: 'bk-2',
      basePrice: 800,
      payment: {
        amount: 900,
        fee_breakdown: { platformFee: 16, convenienceFee: 9, totalTax: 144 },
      },
    });
    expect(b.platformFee).toBe(16);
    expect(b.convenienceFee).toBe(9);
    expect(b.gstTotal).toBe(144);
    expect(mockedCalculateFinalFees).not.toHaveBeenCalled();
  });

  test('recomputeBookingCustomerPaidFeeBreakdown uses checkout pipeline when payment columns empty', async () => {
    mockedCalculateFinalFees.mockResolvedValue({
      platformFee: 20,
      convenienceFee: 0,
      deliveryFee: 30,
      packagingFee: 0,
      total: 50,
    });
    mockedCalculateTax.mockResolvedValue({
      items: [],
      subtotal: 1000,
      totalTax: 180,
      totalCGST: 90,
      totalSGST: 90,
      totalIGST: 0,
      grandTotal: 1180,
      isInterstate: false,
      hsnSummary: [],
    });

    const b = await recomputeBookingCustomerPaidFeeBreakdown({
      bookingId: 'bk-3',
      basePrice: 1000,
      serviceStyle: 'at_home',
      categoryName: 'Grooming',
      payment: { amount: 1230 },
    });

    expect(mockedCalculateFinalFees).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000, type: 'booking', serviceStyle: 'at_home' }),
    );
    expect(mockedResolveServiceBookingTaxItem).toHaveBeenCalled();
    expect(b.platformFee).toBe(20);
    expect(b.deliveryFee).toBe(30);
    expect(b.cgstAmount).toBe(90);
    expect(b.sgstAmount).toBe(90);
    expect(b.gstTotal).toBe(180);
  });

  test('recomputeBookingCustomerPaidFeeBreakdown uses wp_financial_meta totalTax before tax service', async () => {
    mockedCalculateFinalFees.mockResolvedValue({
      platformFee: 40,
      convenienceFee: 0,
      deliveryFee: 0,
      packagingFee: 0,
      total: 40,
    });

    const b = await recomputeBookingCustomerPaidFeeBreakdown({
      bookingId: 'bk-tele',
      basePrice: 400,
      serviceStyle: 'tele',
      categoryName: 'Veterinary',
      bookingNotes:
        'wp_financial_meta:{"servicePrice":400,"subtotalAfterDiscounts":400,"cgst":0,"sgst":0,"igst":0,"totalTax":0,"platformFee":40,"finalPaid":40}',
      payment: { amount: 40 },
    });

    expect(b.gstTotal).toBe(0);
    expect(mockedCalculateTax).not.toHaveBeenCalled();
  });

  test('recomputeBookingCustomerPaidFeeBreakdown respects explicit zero bookings.tax_amount', async () => {
    mockedCalculateFinalFees.mockResolvedValue({
      platformFee: 0,
      convenienceFee: 0,
      deliveryFee: 0,
      packagingFee: 0,
      total: 0,
    });

    const b = await recomputeBookingCustomerPaidFeeBreakdown({
      bookingId: 'bk-zero-tax',
      basePrice: 400,
      taxAmount: 0,
      serviceStyle: 'tele',
      categoryName: 'Veterinary',
      payment: { amount: 400 },
    });

    expect(b.gstTotal).toBe(0);
    expect(mockedCalculateTax).not.toHaveBeenCalled();
  });

  test('recomputeBookingCustomerPaidFeeBreakdown uses bookings.tax_amount before tax service', async () => {
    mockedCalculateFinalFees.mockResolvedValue({
      platformFee: 10,
      convenienceFee: 0,
      deliveryFee: 0,
      packagingFee: 0,
      total: 10,
    });

    const b = await recomputeBookingCustomerPaidFeeBreakdown({
      bookingId: 'bk-4',
      basePrice: 500,
      taxAmount: 90,
      payment: { amount: 600 },
    });

    expect(b.gstTotal).toBe(90);
    expect(mockedCalculateTax).not.toHaveBeenCalled();
  });

  test('resolveBookingCustomerPaidFeeBreakdown recomputes when Razorpay payment has no fee columns', async () => {
    mockedCalculateFinalFees.mockResolvedValue({
      platformFee: 12,
      convenienceFee: 0,
      deliveryFee: 0,
      packagingFee: 0,
      total: 12,
    });
    mockedCalculateTax.mockResolvedValue({
      items: [],
      subtotal: 600,
      totalTax: 108,
      totalCGST: 54,
      totalSGST: 54,
      totalIGST: 0,
      grandTotal: 708,
      isInterstate: false,
      hsnSummary: [],
    });

    const b = await resolveBookingCustomerPaidFeeBreakdown({
      bookingId: 'bk-5',
      basePrice: 600,
      categoryName: 'Veterinary',
      payment: { amount: 720 },
    });

    expect(b.platformFee).toBe(12);
    expect(b.gstTotal).toBe(108);
  });
});
