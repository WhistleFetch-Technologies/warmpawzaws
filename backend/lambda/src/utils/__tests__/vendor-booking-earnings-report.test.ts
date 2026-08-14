import { describe, expect, test } from '@jest/globals';
import {
  buildVendorBookingEarningsLine,
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

  test('package child lines show parent GST once and sliced gross', async () => {
    const base = {
      vendor_id: 'vendor-1',
      business_name: 'Walker Co',
      parent_booking_id: 'ed864719',
      payment_id: 'pay-1',
      gst_identity: 'pay-1',
      gst_attribute_booking_id: '9fa3bab6',
      gst_amount: 2288.16,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      payment_total_amount: 15000.16,
      is_package_session: true,
      parent_service: 12712,
      session_n: 3,
      earning_total_amount: 12712,
      earning_commission_amount: 1271.2,
      earning_net_amount: 11440.8,
      commission_rate: 10,
      tax_amount: 0,
    };

    const first = await buildVendorBookingEarningsLine({
      ...base,
      booking_id: '9fa3bab6',
      session_seq: 1,
    });
    const second = await buildVendorBookingEarningsLine({
      ...base,
      booking_id: 'ed276f26',
      session_seq: 2,
    });
    const third = await buildVendorBookingEarningsLine({
      ...base,
      booking_id: '4805850e',
      session_seq: 3,
    });

    expect(first.gstTotal).toBe(2288.16);
    expect(second.gstTotal).toBe(0);
    expect(third.gstTotal).toBe(0);
    expect(first.vendorGross + second.vendorGross + third.vendorGross).toBe(12712);
    expect(first.vendorGross).toBe(4237.33);
    expect(third.vendorGross).toBe(4237.34);
  });

  test('normal booking GST and gross are unchanged', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'v1',
      booking_id: 'normal-1',
      base_price: 1000,
      earning_total_amount: 1000,
      earning_commission_amount: 100,
      earning_net_amount: 900,
      commission_rate: 10,
      gst_amount: 180,
      cgst_amount: 90,
      sgst_amount: 90,
      igst_amount: 0,
      is_package_session: false,
    });
    expect(line.gstTotal).toBe(180);
    expect(line.vendorGross).toBe(1000);
    expect(line.commissionAmount).toBe(100);
  });

  test('Sara Pets booking earnings shows inferred GST once', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'b781c10d',
      booking_id: '3cae9785-2726-4362-b47b-1f61c8e1ed27',
      base_price: 1485,
      total_amount: 1752.3,
      discount_amount: 0,
      tax_amount: 0,
      earning_total_amount: 1650,
      earning_commission_amount: 165,
      earning_net_amount: 1485,
      payment_amount: 1752.3,
      gst_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      is_package_session: false,
    });
    expect(line.gstTotal).toBe(267.3);
    expect(line.vendorGross).toBe(1650);
    expect(line.customerPaidTotal).toBe(1752.3);
  });

  test('July Pawsome inclusive list shows extracted GST', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'pawsome',
      booking_id: 'e1652035',
      base_price: 1593,
      total_amount: 1620,
      discount_amount: 0,
      tax_amount: 0,
      earning_total_amount: 1350,
      earning_commission_amount: 135,
      earning_net_amount: 1215,
      payment_amount: 1620,
      gst_amount: 0,
      category_name: 'Grooming',
      is_package_session: false,
    });
    expect(line.gstTotal).toBe(243);
    expect(line.vendorGross).toBe(1350);
    expect(line.serviceBase).toBe(1593);
  });

  test('July K9 inclusive boarding shows extracted GST', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'k9',
      booking_id: 'k9-july',
      base_price: 1800,
      total_amount: 1800,
      discount_amount: 0,
      tax_amount: 0,
      earning_total_amount: 1800,
      earning_commission_amount: 180,
      earning_net_amount: 1620,
      payment_amount: 1800,
      gst_amount: 0,
      category_name: 'Boarding',
      is_package_session: false,
    });
    expect(line.gstTotal).toBe(274.58);
    expect(line.vendorGross).toBe(1800);
  });

  test('July vet consult stays 0 GST', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'healing-tails',
      booking_id: 'ht-july',
      base_price: 350,
      total_amount: 350,
      discount_amount: 0,
      tax_amount: 0,
      earning_total_amount: 350,
      earning_commission_amount: 35,
      earning_net_amount: 315,
      payment_amount: 350,
      gst_amount: 0,
      category_name: 'Veterinary',
      is_package_session: false,
    });
    expect(line.gstTotal).toBe(0);
  });
});
