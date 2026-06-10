import { describe, expect, test } from '@jest/globals';
import {
  feeBreakdownForVendor,
  mergeFeeBreakdownIntoAccrualRows,
  sumAccrualFeeBreakdowns,
  VENDOR_ACCRUAL_FEE_CSV_HEADERS,
} from '../vendor-accrual-fee-breakdown';

describe('vendor-accrual-fee-breakdown', () => {
  test('VENDOR_ACCRUAL_FEE_CSV_HEADERS lists investor columns', () => {
    expect(VENDOR_ACCRUAL_FEE_CSV_HEADERS).toEqual([
      'platform_fee',
      'convenience_fee',
      'delivery_fee',
      'cgst_amount',
      'sgst_amount',
      'igst_amount',
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
});
