import { describe, expect, test } from '@jest/globals';
import {
  computeCustomerPaidTotal,
  resolveDiscountAmount,
  resolveServiceBase,
} from '../vendor-booking-earnings-report';

describe('vendor-booking-earnings-report', () => {
  test('resolveServiceBase prefers base_price', () => {
    expect(
      resolveServiceBase({
        vendor_id: 'v1',
        booking_id: 'b1',
        base_price: 1000,
        total_amount: 900,
        earning_total_amount: 800,
      }),
    ).toBe(1000);
  });

  test('resolveDiscountAmount returns non-negative discount', () => {
    expect(
      resolveDiscountAmount({
        vendor_id: 'v1',
        booking_id: 'b1',
        discount_amount: 50,
      }),
    ).toBe(50);
    expect(
      resolveDiscountAmount({
        vendor_id: 'v1',
        booking_id: 'b1',
        discount_amount: -10,
      }),
    ).toBe(0);
  });

  test('computeCustomerPaidTotal uses payment total_amount when present', () => {
    const total = computeCustomerPaidTotal(
      1000,
      0,
      { platformFee: 20, convenienceFee: 0, deliveryFee: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 180 },
      { total_amount: 1200, amount: 1000 },
    );
    expect(total).toBe(1200);
  });

  test('computeCustomerPaidTotal sums base discount gst and fees when no total_amount', () => {
    const total = computeCustomerPaidTotal(
      1000,
      100,
      { platformFee: 20, convenienceFee: 0, deliveryFee: 30, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 180 },
      { amount: 1000 },
    );
    expect(total).toBe(1130);
  });
});
