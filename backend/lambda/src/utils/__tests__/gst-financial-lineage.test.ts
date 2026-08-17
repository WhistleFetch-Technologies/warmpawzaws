import { describe, expect, test } from '@jest/globals';
import {
  applyCanonicalGstSplit,
  buildCanonicalGstSnapshot,
  hasCompleteGstSplit,
  readAuthoritativeGst,
  snapshotToPaymentColumns,
} from '../canonical-gst-snapshot';
import { reconstructGstSplit } from '../gst-split';
import { resolveBookingInvoiceAmounts } from '../booking-invoice-amounts';
import { applyMealGstJurisdiction } from '../meal-plan-gst';
import { resolveBookingCustomerPaidFeeBreakdown } from '../vendor-accrual-fee-breakdown';
import { buildVendorBookingEarningsLine } from '../vendor-booking-earnings-report';

describe('GST financial lineage', () => {
  test('TEST 1 — service intra-state 1800 @ 18% is 162/162/0 at every read stage', async () => {
    const snap = buildCanonicalGstSnapshot({ taxableAmount: 1800, gstRate: 18, isInterState: false });
    expect(snap).toMatchObject({
      gstAmount: 324,
      cgstAmount: 162,
      sgstAmount: 162,
      igstAmount: 0,
      isInterState: false,
    });
    expect(snap.cgstAmount + snap.sgstAmount + snap.igstAmount).toBe(snap.gstAmount);

    const payment = snapshotToPaymentColumns(snap);
    const read = readAuthoritativeGst(payment);
    expect(read).toMatchObject({ gstAmount: 324, cgstAmount: 162, sgstAmount: 162, igstAmount: 0 });

    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1800,
      bookingTaxAmount: 324,
      bookingTotalAmount: 2124,
      isInterState: false,
      payment: {
        gstAmount: 324,
        cgstAmount: 162,
        sgstAmount: 162,
        igstAmount: 0,
        totalAmount: 2124,
      },
      financialMeta: { taxableAmount: 1800, cgst: 162, sgst: 162, igst: 0, totalTax: 324 },
    });
    expect(invoice).toMatchObject({ taxAmount: 324, cgst: 162, sgst: 162, igst: 0, taxableValue: 1800 });

    const accrual = await resolveBookingCustomerPaidFeeBreakdown({
      bookingId: 'svc-intra',
      basePrice: 1800,
      isInterState: false,
      payment: { gst_amount: 324, cgst_amount: 162, sgst_amount: 162, igst_amount: 0, is_inter_state: false },
    });
    expect(accrual).toMatchObject({ gstTotal: 324, cgstAmount: 162, sgstAmount: 162, igstAmount: 0 });

    const earnings = await buildVendorBookingEarningsLine({
      vendor_id: 'v1',
      booking_id: 'svc-intra',
      base_price: 1800,
      earning_total_amount: 1800,
      earning_commission_amount: 180,
      earning_net_amount: 1620,
      gst_amount: 324,
      cgst_amount: 162,
      sgst_amount: 162,
      igst_amount: 0,
      is_inter_state: false,
    });
    expect(earnings.gstTotal).toBe(324);
    expect(earnings.cgstAmount).toBe(162);
    expect(earnings.sgstAmount).toBe(162);
    expect(earnings.igstAmount).toBe(0);
    expect(earnings.vendorGross).toBe(1800);
  });

  test('TEST 2 — service inter-state IGST 324 never becomes 50/50 downstream', async () => {
    const snap = buildCanonicalGstSnapshot({ taxableAmount: 1800, gstRate: 18, isInterState: true });
    expect(snap).toMatchObject({ gstAmount: 324, cgstAmount: 0, sgstAmount: 0, igstAmount: 324, isInterState: true });

    const accrual = await resolveBookingCustomerPaidFeeBreakdown({
      bookingId: 'svc-inter',
      payment: { gst_amount: 324, cgst_amount: 0, sgst_amount: 0, igst_amount: 324, is_inter_state: true },
    });
    expect(accrual).toMatchObject({ gstTotal: 324, cgstAmount: 0, sgstAmount: 0, igstAmount: 324 });

    const reconstructed = reconstructGstSplit({
      gstTotal: 324,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 324,
      isInterState: true,
    });
    expect(reconstructed).toMatchObject({ gstTotal: 324, igstAmount: 324, cgstAmount: 0, sgstAmount: 0 });

    const earnings = await buildVendorBookingEarningsLine({
      vendor_id: 'v1',
      booking_id: 'svc-inter',
      base_price: 1800,
      earning_total_amount: 1800,
      earning_commission_amount: 180,
      earning_net_amount: 1620,
      gst_amount: 324,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 324,
      is_inter_state: true,
    });
    expect(earnings.igstAmount).toBe(324);
    expect(earnings.cgstAmount).toBe(0);
    expect(earnings.sgstAmount).toBe(0);
    expect(earnings.vendorGross).toBe(1800);
  });

  test('TEST 3 — package intra GST lives once on the purchase, not on sessions', async () => {
    const snap = buildCanonicalGstSnapshot({ taxableAmount: 10000, gstRate: 18, isInterState: false });
    expect(snap).toMatchObject({ gstAmount: 1800, cgstAmount: 900, sgstAmount: 900, igstAmount: 0 });

    const first = await buildVendorBookingEarningsLine({
      vendor_id: 'v1',
      booking_id: 'session-1',
      parent_booking_id: 'pkg-parent',
      payment_id: 'pay-pkg',
      gst_identity: 'pay-pkg',
      gst_attribute_booking_id: 'session-1',
      is_package_session: true,
      parent_service: 10000,
      session_n: 4,
      session_seq: 1,
      earning_total_amount: 10000,
      earning_commission_amount: 1000,
      earning_net_amount: 9000,
      gst_amount: 1800,
      cgst_amount: 900,
      sgst_amount: 900,
      igst_amount: 0,
      is_inter_state: false,
    });
    const later = await buildVendorBookingEarningsLine({
      vendor_id: 'v1',
      booking_id: 'session-2',
      parent_booking_id: 'pkg-parent',
      payment_id: 'pay-pkg',
      gst_identity: 'pay-pkg',
      gst_attribute_booking_id: 'session-1',
      is_package_session: true,
      parent_service: 10000,
      session_n: 4,
      session_seq: 2,
      earning_total_amount: 10000,
      earning_commission_amount: 1000,
      earning_net_amount: 9000,
      gst_amount: 1800,
      cgst_amount: 900,
      sgst_amount: 900,
      igst_amount: 0,
      is_inter_state: false,
    });

    expect(first.gstTotal).toBe(1800);
    expect(first.cgstAmount).toBe(900);
    expect(first.sgstAmount).toBe(900);
    expect(later.gstTotal).toBe(0);
    expect(later.cgstAmount).toBe(0);
    expect(first.vendorGross).toBe(2500);
    expect(later.vendorGross).toBe(2500);
    expect(first.vendorGross + later.vendorGross).toBe(5000);
  });

  test('TEST 4 — package inter-state IGST stays on the purchase and is not 50/50 on sessions', async () => {
    const snap = buildCanonicalGstSnapshot({ taxableAmount: 10000, gstRate: 18, isInterState: true });
    expect(snap).toMatchObject({ gstAmount: 1800, cgstAmount: 0, sgstAmount: 0, igstAmount: 1800 });

    const first = await buildVendorBookingEarningsLine({
      vendor_id: 'v1',
      booking_id: 'session-1',
      parent_booking_id: 'pkg-parent',
      payment_id: 'pay-pkg',
      gst_identity: 'pay-pkg',
      gst_attribute_booking_id: 'session-1',
      is_package_session: true,
      parent_service: 10000,
      session_n: 4,
      session_seq: 1,
      earning_total_amount: 10000,
      earning_commission_amount: 1000,
      earning_net_amount: 9000,
      gst_amount: 1800,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 1800,
      is_inter_state: true,
    });
    expect(first.igstAmount).toBe(1800);
    expect(first.cgstAmount).toBe(0);
    expect(first.vendorGross).toBe(2500);
  });

  test('TEST 5 — meal food+delivery GST split is jurisdictional and not vendor settlement', () => {
    const intra = applyMealGstJurisdiction(
      { foodGstAmount: 20, deliveryGstAmount: 2, totalGstAmount: 22, foodGstPct: 5, deliveryGstPct: 5 },
      false,
    );
    expect(intra).toMatchObject({
      foodGstAmount: 20,
      deliveryGstAmount: 2,
      totalGstAmount: 22,
      cgstAmount: 11,
      sgstAmount: 11,
      igstAmount: 0,
      isInterState: false,
    });

    const inter = applyMealGstJurisdiction(
      { foodGstAmount: 20, deliveryGstAmount: 2, totalGstAmount: 22, foodGstPct: 5, deliveryGstPct: 5 },
      true,
    );
    expect(inter).toMatchObject({
      totalGstAmount: 22,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 22,
      isInterState: true,
    });
  });

  test('TEST 6 — tax engine failure must not persist an 18% intra snapshot', () => {
    const failed = readAuthoritativeGst({
      gst_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
    });
    expect(failed.gstAmount).toBe(0);
    expect(failed.cgstAmount).toBe(0);
    expect(failed.sgstAmount).toBe(0);
    expect(failed.igstAmount).toBe(0);
    expect(hasCompleteGstSplit({ gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 })).toBe(true);
  });

  test('TEST 7 — retry/webhook re-read keeps the original split', () => {
    const first = readAuthoritativeGst({
      gst_amount: 324,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 324,
      is_inter_state: true,
    });
    const retry = readAuthoritativeGst(snapshotToPaymentColumns(first));
    expect(retry).toMatchObject({
      gstAmount: 324,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 324,
      isInterState: true,
    });
  });

  test('TEST 8 — legacy gst_amount only does not become 50/50', () => {
    const legacy = readAuthoritativeGst({
      gst_amount: 324,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
    });
    expect(legacy).toMatchObject({
      gstAmount: 324,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      splitAvailable: false,
    });

    const reconstructed = reconstructGstSplit({ gstTotal: 324, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
    expect(reconstructed.splitAvailable).toBe(false);
    expect(reconstructed.cgstAmount).toBe(0);
    expect(reconstructed.igstAmount).toBe(0);
  });

  test('canonical split never sets CGST+SGST+IGST together', () => {
    const intra = applyCanonicalGstSplit(324.01, false);
    expect(intra.igstAmount).toBe(0);
    expect(intra.cgstAmount + intra.sgstAmount).toBe(intra.gstAmount);

    const inter = applyCanonicalGstSplit(324.01, true);
    expect(inter.cgstAmount + inter.sgstAmount).toBe(0);
    expect(inter.igstAmount).toBe(inter.gstAmount);
  });
});
