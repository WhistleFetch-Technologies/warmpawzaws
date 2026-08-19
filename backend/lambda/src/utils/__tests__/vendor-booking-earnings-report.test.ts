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

  test('computeCustomerPaidTotal prefers Razorpay captured amount over stored total_amount', () => {
    const total = computeCustomerPaidTotal(
      1000,
      0,
      { platformFee: 20, convenienceFee: 0, deliveryFee: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 180 },
      { total_amount: 1200, amount: 1000 },
    );
    expect(total).toBe(1000);
  });

  test('computeCustomerPaidTotal adds wallet on top of captured amount', () => {
    const total = computeCustomerPaidTotal(
      1000,
      0,
      { platformFee: 0, convenienceFee: 0, deliveryFee: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 0 },
      { amount: 1000, wallet_amount_used: 200 },
    );
    expect(total).toBe(1200);
  });

  test('computeCustomerPaidTotal uses payment amount when total_amount is missing', () => {
    const total = computeCustomerPaidTotal(
      1000,
      100,
      { platformFee: 20, convenienceFee: 0, deliveryFee: 30, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstTotal: 180 },
      { amount: 1000 },
    );
    expect(total).toBe(1000);
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
    expect(first.customerPaidTotal).toBe(15000.16);
    expect(second.customerPaidTotal).toBe(0);
    expect(third.customerPaidTotal).toBe(0);
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

  test('Sara Pets booking earnings keeps stored 0 GST', async () => {
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
    expect(line.gstTotal).toBe(0);
    expect(line.vendorGross).toBe(1650);
    expect(line.customerPaidTotal).toBe(1752.3);
    expect(line.commissionAmount).toBe(165);
  });

  test('July Pawsome keeps stored 0 GST and shows platform commission', async () => {
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
    expect(line.gstTotal).toBe(0);
    expect(line.vendorGross).toBe(1350);
    expect(line.serviceBase).toBe(1593);
    expect(line.commissionAmount).toBe(135);
    expect(line.customerPaidTotal).toBe(1620);
  });

  test('July K9 keeps stored 0 GST and shows platform commission', async () => {
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
    expect(line.gstTotal).toBe(0);
    expect(line.vendorGross).toBe(1800);
    expect(line.commissionAmount).toBe(180);
    expect(line.customerPaidTotal).toBe(1800);
  });

  test('Chandrali platform coupon corrects ledger net to 1799.10 without inventing GST', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'sara-pets',
      booking_id: '01dbe38e-95a2-4a15-ae8f-5bbc04a6b966',
      base_price: 1999,
      total_amount: 40,
      discount_amount: 1999,
      tax_amount: 0,
      earning_total_amount: 40,
      earning_commission_amount: 4,
      earning_net_amount: 36,
      payment_amount: 40,
      gst_amount: 0,
      gst_rate: 18,
      coupon_code: 'COLLABCODE',
      is_package_session: false,
      earnings_metadata: {
        vendorSettlement: 1799.1,
        commissionBase: 1999,
        commissionAmount: 199.9,
        fundingType: 'PLATFORM',
        vendorBasePrice: 1999,
        winningOffer: { offerType: 'PLATFORM_COUPON', fundingType: 'PLATFORM' },
        settlementSnapshot: {
          vendorBasePrice: 1999,
          winningOffer: { offerType: 'PLATFORM_COUPON', fundingType: 'PLATFORM', discountAmount: 1999 },
          commissionBase: 1999,
          commissionRate: 10,
          commissionAmount: 199.9,
          vendorSettlement: 1799.1,
          platformCost: 1999,
          vendorCost: 0,
        },
      },
    });
    expect(line.customerPaidTotal).toBe(40);
    expect(line.gstTotal).toBe(0);
    expect(line.gstRate).toBe(0);
    expect(line.cgstAmount).toBe(0);
    expect(line.sgstAmount).toBe(0);
    expect(line.igstAmount).toBe(0);
    expect(line.vendorGross).toBe(1999);
    expect(line.commissionAmount).toBe(199.9);
    expect(line.vendorNet).toBe(1799.1);
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

const EMPTY_FEES = {
  platformFee: 0,
  convenienceFee: 0,
  deliveryFee: 0,
  cgstAmount: 0,
  sgstAmount: 0,
  igstAmount: 0,
  gstTotal: 0,
};

describe('Booking Earnings Customer Paid uses captured payment', () => {
  const inferredInclusive = (listed: number) =>
    Math.round((listed + listed - listed / 1.18) * 100) / 100;

  test('A. Nail Clipping captured ₹275 stays ₹275, not reconstructed ₹316.95', async () => {
    expect(inferredInclusive(275)).toBe(316.95);
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'paws-us',
      booking_id: '7d19e448-086c-45f0-a105-5cee9ef1820c',
      base_price: 275,
      total_amount: 275,
      tax_amount: 0,
      earning_total_amount: 275,
      earning_commission_amount: 27.5,
      earning_net_amount: 247.5,
      payment_amount: 275,
      gst_amount: 0,
      category_name: 'Grooming',
      is_package_session: false,
    });
    expect(line.customerPaidTotal).toBe(275);
    expect(line.customerPaidTotal).not.toBe(316.95);
    expect(line.gstTotal).toBe(0);
    expect(line.vendorNet).toBe(247.5);
  });

  test('B. Swimming captured ₹1,800 stays ₹1,800, not reconstructed ₹2,074.58', async () => {
    expect(inferredInclusive(1800)).toBe(2074.58);
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'k9',
      booking_id: '6b49e9bd-18bf-4bd2-a01c-f022b26361ea',
      base_price: 1800,
      total_amount: 1800,
      tax_amount: 0,
      earning_total_amount: 1800,
      earning_commission_amount: 180,
      earning_net_amount: 1620,
      payment_amount: 1800,
      gst_amount: 0,
      category_name: 'Boarding',
      is_package_session: false,
    });
    expect(line.customerPaidTotal).toBe(1800);
    expect(line.customerPaidTotal).not.toBe(2074.58);
    expect(line.gstTotal).toBe(0);
    expect(line.vendorGross).toBe(1800);
    expect(line.commissionAmount).toBe(180);
    expect(line.vendorNet).toBe(1620);
  });

  test('C. Beagle bath captured ₹1,620 stays ₹1,620, not reconstructed ₹1,836', async () => {
    expect(Math.round((1593 + 1593 - 1593 / 1.18) * 100) / 100).toBe(1836);
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'pawsome',
      booking_id: 'e1652035-33d8-4e3b-8afa-1f7d7a6dc013',
      base_price: 1593,
      total_amount: 1620,
      tax_amount: 0,
      earning_total_amount: 1350,
      earning_commission_amount: 135,
      earning_net_amount: 1215,
      payment_amount: 1620,
      gst_amount: 0,
      category_name: 'Grooming',
      is_package_session: false,
    });
    expect(line.customerPaidTotal).toBe(1620);
    expect(line.customerPaidTotal).not.toBe(1836);
    expect(line.customerPaidTotal).not.toBe(1836.05);
    expect(line.gstTotal).toBe(0);
    expect(line.serviceBase).toBe(1593);
    expect(line.vendorNet).toBe(1215);
  });

  test('D. Refund reduces captured Customer Paid', () => {
    expect(
      computeCustomerPaidTotal(1620, 0, EMPTY_FEES, { amount: 1620 }, { refundedAmount: 200 }),
    ).toBe(1420);
  });

  test('E. Customer Paid never uses vendor net', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'walker',
      booking_id: 'da326e65',
      base_price: 21600,
      total_amount: 21600,
      tax_amount: 0,
      earning_total_amount: 21600,
      earning_commission_amount: 2160,
      earning_net_amount: 19440,
      payment_amount: 21600,
      gst_amount: 0,
      is_package_session: false,
    });
    expect(line.customerPaidTotal).toBe(21600);
    expect(line.customerPaidTotal).not.toBe(line.vendorNet);
    expect(line.vendorNet).toBe(19440);
  });

  test('F. Customer Paid never includes platform commission', () => {
    expect(
      computeCustomerPaidTotal(
        1800,
        0,
        { ...EMPTY_FEES, platformFee: 180 },
        { amount: 1800 },
      ),
    ).toBe(1800);
  });

  test('G. Customer Paid never gets GST added a second time', () => {
    expect(
      computeCustomerPaidTotal(
        275,
        0,
        { ...EMPTY_FEES, gstTotal: 41.95 },
        { amount: 275 },
      ),
    ).toBe(275);
  });

  test('E. Missing payment.amount does not add inferred 18% GST to Customer Paid', () => {
    expect(
      computeCustomerPaidTotal(
        275,
        0,
        { ...EMPTY_FEES, gstTotal: 41.95, platformFee: 20 },
        {},
        { bookingTotal: 275 },
      ),
    ).toBe(275);
  });

  test('H. Package purchase Customer Paid comes from captured package payment', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'vendor-1',
      booking_id: '9fa3bab6',
      parent_booking_id: 'ed864719',
      payment_id: 'pay-1',
      gst_identity: 'pay-1',
      gst_attribute_booking_id: '9fa3bab6',
      gst_amount: 2288.16,
      payment_amount: 15000.16,
      is_package_session: true,
      parent_service: 12712,
      session_n: 3,
      session_seq: 1,
      earning_total_amount: 4237.33,
      earning_commission_amount: 423.73,
      earning_net_amount: 3813.6,
    });
    expect(line.customerPaidTotal).toBe(15000.16);
    expect(line.gstTotal).toBe(2288.16);
  });

  test('I. Later package session rows do not duplicate Customer Paid', async () => {
    const line = await buildVendorBookingEarningsLine({
      vendor_id: 'vendor-1',
      booking_id: 'ed276f26',
      parent_booking_id: 'ed864719',
      payment_id: 'pay-1',
      gst_identity: 'pay-1',
      gst_attribute_booking_id: '9fa3bab6',
      gst_amount: 2288.16,
      payment_amount: 15000.16,
      is_package_session: true,
      parent_service: 12712,
      session_n: 3,
      session_seq: 2,
      earning_total_amount: 4237.33,
      earning_commission_amount: 423.73,
      earning_net_amount: 3813.6,
    });
    expect(line.customerPaidTotal).toBe(0);
    expect(line.gstTotal).toBe(0);
    expect(line.vendorGross).toBeGreaterThan(0);
  });
});
