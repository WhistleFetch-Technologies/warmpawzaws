import { describe, expect, test } from '@jest/globals';
import { resolveBookingInvoiceAmounts } from '../booking-invoice-amounts';
import { resolveBookingCustomerPaidFeeBreakdown } from '../vendor-accrual-fee-breakdown';
import { buildVendorBookingEarningsLine } from '../vendor-booking-earnings-report';

/**
 * Invoice vs Admin report GST must share the stored historical snapshot.
 * catalogGstRate is today's Admin/catalogue rate and must never rewrite history.
 */

async function reportGst(params: {
  bookingId: string;
  basePrice: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  isInterState?: boolean;
  paymentTotal?: number;
  taxAmount?: number;
  parentBookingId?: string;
  isPackageSession?: boolean;
  parentService?: number;
  sessionN?: number;
  sessionSeq?: number;
  gstAttributeBookingId?: string;
  commissionAmount?: number;
  vendorNet?: number;
}) {
  const payment = {
    gst_amount: params.gstAmount ?? 0,
    cgst_amount: params.cgstAmount ?? 0,
    sgst_amount: params.sgstAmount ?? 0,
    igst_amount: params.igstAmount ?? 0,
    is_inter_state: params.isInterState,
    total_amount: params.paymentTotal,
    amount: params.paymentTotal ?? params.basePrice,
  };
  const accrual = await resolveBookingCustomerPaidFeeBreakdown({
    bookingId: params.bookingId,
    basePrice: params.basePrice,
    taxAmount: params.taxAmount ?? params.gstAmount ?? 0,
    isInterState: params.isInterState,
    payment,
  });
  const earnings = await buildVendorBookingEarningsLine({
    vendor_id: 'v1',
    booking_id: params.bookingId,
    parent_booking_id: params.parentBookingId,
    payment_id: params.parentBookingId ? 'pay-pkg' : 'pay-1',
    gst_identity: params.parentBookingId ? 'pay-pkg' : params.bookingId,
    gst_attribute_booking_id: params.gstAttributeBookingId ?? params.bookingId,
    is_package_session: params.isPackageSession,
    parent_service: params.parentService,
    session_n: params.sessionN,
    session_seq: params.sessionSeq,
    base_price: params.basePrice,
    earning_total_amount: params.parentService ?? params.basePrice,
    earning_commission_amount: params.commissionAmount ?? 0,
    earning_net_amount: params.vendorNet ?? params.basePrice,
    gst_amount: params.gstAmount ?? 0,
    cgst_amount: params.cgstAmount ?? 0,
    sgst_amount: params.sgstAmount ?? 0,
    igst_amount: params.igstAmount ?? 0,
    is_inter_state: params.isInterState,
    tax_amount: params.taxAmount ?? params.gstAmount ?? 0,
    payment_total_amount: params.paymentTotal,
  });
  return { accrual, earnings };
}

describe('historical invoice GST lineage vs Admin reports', () => {
  test('CASE 1 — stored GST 0 / current Admin GST 18%: report and invoice stay 0', async () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1000,
      isInterState: false,
      catalogGstRate: 18,
      payment: { gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 1000, totalAmount: 1000 },
    });
    const { accrual, earnings } = await reportGst({
      bookingId: 'hist-zero',
      basePrice: 1000,
      gstAmount: 0,
      paymentTotal: 1000,
      isInterState: false,
    });

    expect(invoice.taxAmount).toBe(0);
    expect(invoice.gstRate).toBe(0);
    expect(invoice.total).toBe(1000);
    expect(accrual.gstTotal).toBe(0);
    expect(earnings.gstTotal).toBe(0);
    expect(earnings.gstRate).toBe(0);
  });

  test('CASE 2 — stored GST 18% / current Admin GST 0%: report and invoice stay 18%', async () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 180,
      bookingTotalAmount: 1180,
      isInterState: false,
      catalogGstRate: 0,
      payment: { gstAmount: 180, cgstAmount: 90, sgstAmount: 90, igstAmount: 0, totalAmount: 1180 },
    });
    const { accrual, earnings } = await reportGst({
      bookingId: 'hist-18',
      basePrice: 1000,
      gstAmount: 180,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      paymentTotal: 1180,
      isInterState: false,
    });

    expect(invoice.taxAmount).toBe(180);
    expect(invoice.gstRate).toBe(18);
    expect(invoice.total).toBe(1180);
    expect(accrual.gstTotal).toBe(180);
    expect(earnings.gstTotal).toBe(180);
  });

  test('CASE 3 — stored CGST/SGST split is preserved on the invoice', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 180,
      bookingTotalAmount: 1180,
      catalogGstRate: 18,
      payment: { gstAmount: 180, cgstAmount: 90, sgstAmount: 90, igstAmount: 0, totalAmount: 1180 },
    });
    expect(invoice).toMatchObject({
      cgst: 90,
      sgst: 90,
      igst: 0,
      taxAmount: 180,
    });
  });

  test('CASE 4 — stored IGST split is preserved on the invoice', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 180,
      bookingTotalAmount: 1180,
      catalogGstRate: 18,
      payment: { gstAmount: 180, cgstAmount: 0, sgstAmount: 0, igstAmount: 180, totalAmount: 1180 },
    });
    expect(invoice).toMatchObject({
      cgst: 0,
      sgst: 0,
      igst: 180,
      taxAmount: 180,
    });
  });

  test('CASE 5 — stored GST total with unknown jurisdiction does not invent a split', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1800,
      bookingTaxAmount: 0,
      bookingTotalAmount: 2124,
      payment: { gstAmount: 324, totalAmount: 2124, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
    });
    expect(invoice.taxAmount).toBe(324);
    expect(invoice.cgst).toBe(0);
    expect(invoice.sgst).toBe(0);
    expect(invoice.igst).toBe(0);
  });

  test('CASE 6 — explicit stored 0% is not treated as missing when catalogue is 18%', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1000,
      catalogGstRate: 18,
      financialMeta: { totalTax: 0, cgst: 0, sgst: 0, igst: 0, taxableAmount: 1000, finalPaid: 1000 },
      payment: { gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 1000, totalAmount: 1000 },
    });
    expect(invoice.taxAmount).toBe(0);
    expect(invoice.gstRate).toBe(0);
    expect(invoice.total).toBe(1000);
  });

  test('CASE 7 — vendor price change after booking does not rewrite historical invoice amounts', () => {
    const currentVendorPrice = 2500;
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1000,
      catalogGstRate: 18,
      payment: { gstAmount: 0, amount: 1000, totalAmount: 1000 },
    });
    expect(invoice.taxableValue).toBe(1000);
    expect(invoice.total).toBe(1000);
    expect(invoice.taxableValue).not.toBe(currentVendorPrice);
  });

  test('CASE 8 — commission / vendor net is not the customer taxable amount', async () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 180,
      bookingTotalAmount: 1180,
      payment: { gstAmount: 180, cgstAmount: 90, sgstAmount: 90, totalAmount: 1180 },
      isInterState: false,
    });
    const { earnings } = await reportGst({
      bookingId: 'commission-safe',
      basePrice: 1000,
      gstAmount: 180,
      cgstAmount: 90,
      sgstAmount: 90,
      paymentTotal: 1180,
      isInterState: false,
      commissionAmount: 100,
      vendorNet: 900,
    });

    expect(invoice.taxableValue).toBe(1000);
    expect(invoice.taxAmount).toBe(180);
    expect(invoice.total).toBe(1180);
    expect(earnings.vendorNet).toBe(900);
    expect(earnings.commissionAmount).toBe(100);
    expect(invoice.taxableValue).not.toBe(earnings.vendorNet);
  });

  test('CASE 9 — package GST is charged once on the parent invoice, not again on sessions', async () => {
    const parentInvoice = resolveBookingInvoiceAmounts({
      basePrice: 10000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 10000,
      isInterState: false,
      catalogGstRate: 18,
      payment: { gstAmount: 1800, cgstAmount: 900, sgstAmount: 900, igstAmount: 0, totalAmount: 11800 },
    });
    const sessionInvoice = resolveBookingInvoiceAmounts({
      basePrice: 2500,
      bookingTaxAmount: 0,
      bookingTotalAmount: 2500,
      isInterState: false,
      catalogGstRate: 18,
    });
    const first = await reportGst({
      bookingId: 'session-1',
      basePrice: 2500,
      parentBookingId: 'pkg-parent',
      isPackageSession: true,
      parentService: 10000,
      sessionN: 4,
      sessionSeq: 1,
      gstAttributeBookingId: 'session-1',
      gstAmount: 1800,
      cgstAmount: 900,
      sgstAmount: 900,
      paymentTotal: 11800,
      isInterState: false,
      commissionAmount: 1000,
      vendorNet: 9000,
    });
    const later = await reportGst({
      bookingId: 'session-2',
      basePrice: 2500,
      parentBookingId: 'pkg-parent',
      isPackageSession: true,
      parentService: 10000,
      sessionN: 4,
      sessionSeq: 2,
      gstAttributeBookingId: 'session-1',
      gstAmount: 1800,
      cgstAmount: 900,
      sgstAmount: 900,
      paymentTotal: 11800,
      isInterState: false,
      commissionAmount: 1000,
      vendorNet: 9000,
    });

    expect(parentInvoice.taxAmount).toBe(1800);
    expect(parentInvoice.gstRate).toBe(18);
    expect(sessionInvoice.taxAmount).toBe(0);
    expect(sessionInvoice.gstRate).toBe(0);
    expect(first.earnings.gstTotal).toBe(1800);
    expect(later.earnings.gstTotal).toBe(0);
    expect(first.earnings.serviceBase).toBe(2500);
  });

  test('CASE 10 — package historical GST 0 stays 0 when current package GST is 18%', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 10000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 10000,
      catalogGstRate: 18,
      payment: { gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, amount: 10000, totalAmount: 10000 },
    });
    expect(invoice.taxAmount).toBe(0);
    expect(invoice.gstRate).toBe(0);
    expect(invoice.total).toBe(10000);
  });

  test('stored invoice document and regeneration share the same historical GST', () => {
    const regenerated = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1000,
      catalogGstRate: 18,
      payment: { gstAmount: 0, amount: 1000, totalAmount: 1000 },
    });
    expect(regenerated).toMatchObject({
      taxableValue: 1000,
      taxAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gstRate: 0,
      total: 1000,
      unexplainedVariance: 0,
    });
  });

  test('captured payment is authoritative; unexplained extra is not GST', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1485,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1485,
      catalogGstRate: 18,
      payment: { gstAmount: 0, amount: 1752.3, totalAmount: 1752.3 },
    });
    expect(invoice.total).toBe(1752.3);
    expect(invoice.taxAmount).toBe(0);
    expect(invoice.unexplainedVariance).toBe(267.3);
    expect(invoice.reconciliationNote).toBeTruthy();
  });

  test('historical booking without gstLines is not rewritten by current Admin rates', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 2000,
      bookingTaxAmount: 360,
      bookingTotalAmount: 2360,
      isInterState: false,
      catalogGstRate: 0,
      payment: {
        gstAmount: 360,
        cgstAmount: 180,
        sgstAmount: 180,
        igstAmount: 0,
        totalAmount: 2360,
      },
      financialMeta: { taxableAmount: 2000, totalTax: 360, cgst: 180, sgst: 180, igst: 0 },
    });
    expect(invoice.taxAmount).toBe(360);
    expect(invoice.taxableValue).toBe(2000);
    expect(invoice.gstRate).toBe(18);
  });

  test('stored platform fee plus GST reconciles to captured payment', () => {
    const invoice = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1000,
      isInterState: false,
      payment: {
        gstAmount: 180,
        cgstAmount: 90,
        sgstAmount: 90,
        platformFee: 40,
        totalAmount: 1220,
      },
    });
    expect(invoice.taxAmount).toBe(180);
    expect(invoice.platformFee).toBe(40);
    expect(invoice.total).toBe(1220);
    expect(invoice.unexplainedVariance).toBe(0);
  });
});
