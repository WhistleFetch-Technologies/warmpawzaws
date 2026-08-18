import { resolveBookingInvoiceAmounts } from '../booking-invoice-amounts';

describe('resolveBookingInvoiceAmounts', () => {
  it('uses payment GST when booking.tax_amount is 0 (ed864719 walker package)', () => {
    const amounts = resolveBookingInvoiceAmounts({
      basePrice: 12712,
      bookingTaxAmount: 0,
      bookingTotalAmount: 12712,
      isInterState: false,
      payment: {
        amount: 12712,
        totalAmount: 15000.16,
        gstAmount: 2288.16,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      },
    });

    expect(amounts.taxableValue).toBe(12712);
    expect(amounts.taxAmount).toBe(2288.16);
    expect(amounts.gstRate).toBe(18);
    expect(amounts.cgst).toBe(1144.08);
    expect(amounts.sgst).toBe(1144.08);
    expect(amounts.igst).toBe(0);
    expect(amounts.total).toBe(15000.16);
  });

  it('keeps stored booking tax when present', () => {
    const amounts = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 180,
      bookingTotalAmount: 1180,
      isInterState: false,
    });
    expect(amounts.taxAmount).toBe(180);
    expect(amounts.cgst).toBe(90);
    expect(amounts.sgst).toBe(90);
    expect(amounts.total).toBe(1180);
  });

  it('splits IGST for inter-state when payment only has gst_amount', () => {
    const amounts = resolveBookingInvoiceAmounts({
      basePrice: 1000,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1000,
      isInterState: true,
      payment: { gstAmount: 180, totalAmount: 1180 },
    });
    expect(amounts.igst).toBe(180);
    expect(amounts.cgst).toBe(0);
    expect(amounts.sgst).toBe(0);
    expect(amounts.total).toBe(1180);
  });

  it('prefers wp_financial_meta over payment when booking tax is missing', () => {
    const amounts = resolveBookingInvoiceAmounts({
      basePrice: 1699,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1699,
      isInterState: false,
      financialMeta: { cgst: 152.91, sgst: 152.91, totalTax: 305.82, finalPaid: 2004.82 },
      payment: { gstAmount: 1, totalAmount: 1 },
    });
    expect(amounts.taxAmount).toBe(305.82);
    expect(amounts.cgst).toBe(152.91);
    expect(amounts.sgst).toBe(152.91);
    expect(amounts.total).toBe(2004.82);
  });

  it('leaves GST at 0 when nothing was charged', () => {
    const amounts = resolveBookingInvoiceAmounts({
      basePrice: 500,
      bookingTaxAmount: 0,
      bookingTotalAmount: 500,
      isInterState: false,
    });
    expect(amounts.taxAmount).toBe(0);
    expect(amounts.gstRate).toBe(0);
    expect(amounts.total).toBe(500);
  });

  it('does not invent CGST/SGST when only gst_amount exists and jurisdiction is unknown', () => {
    const amounts = resolveBookingInvoiceAmounts({
      basePrice: 1800,
      bookingTaxAmount: 0,
      bookingTotalAmount: 2124,
      isInterState: undefined as unknown as boolean,
      payment: { gstAmount: 324, totalAmount: 2124, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
    });
    expect(amounts.taxAmount).toBe(324);
    expect(amounts.cgst).toBe(0);
    expect(amounts.sgst).toBe(0);
    expect(amounts.igst).toBe(0);
  });

  it('infers 18% GST when charged total is base + GST and tax columns are 0 (Sara Pets)', () => {
    const amounts = resolveBookingInvoiceAmounts({
      basePrice: 1485,
      bookingTaxAmount: 0,
      bookingTotalAmount: 1752.3,
      isInterState: false,
      payment: { amount: 1752.3, gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 },
    });
    expect(amounts.taxAmount).toBe(267.3);
    expect(amounts.cgst).toBe(133.65);
    expect(amounts.sgst).toBe(133.65);
    expect(amounts.igst).toBe(0);
    expect(amounts.total).toBe(1752.3);
  });
});
