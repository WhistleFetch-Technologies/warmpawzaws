import {
  effectiveGstRateFromSummary,
  normalizeVendorInvoicesListResponse,
  normalizeVendorSalesInvoice,
} from '../seller-invoice-types';

describe('seller-invoice-types', () => {
  it('normalizes camelCase invoice rows', () => {
    const row = normalizeVendorSalesInvoice({
      id: 'abc',
      invoiceNumber: 'INV-1',
      customerName: 'Raj',
      date: '2026-01-15',
      subtotal: 100,
      tax: 18,
      cgst: 9,
      sgst: 9,
      igst: 0,
      total: 118,
      orderId: 'order-1',
      isInterState: false,
      status: 'generated',
    });
    expect(row.invoiceNumber).toBe('INV-1');
    expect(row.orderId).toBe('order-1');
    expect(row.tax).toBe(18);
  });

  it('normalizes list response with summary', () => {
    const parsed = normalizeVendorInvoicesListResponse({
      success: true,
      invoices: [{ id: '1', invoiceNumber: 'A', total: 50, tax: 5, subtotal: 45, date: '2026-01-01' }],
      summary: { totalInvoices: 1, totalAmount: 50, totalTax: 5, totalSubtotal: 45 },
    });
    expect(parsed.invoices).toHaveLength(1);
    expect(parsed.summary.totalInvoices).toBe(1);
  });

  it('computes effective GST rate from summary', () => {
    expect(
      effectiveGstRateFromSummary({
        totalInvoices: 2,
        totalSubtotal: 100,
        totalTax: 18,
        totalCGST: 9,
        totalSGST: 9,
        totalIGST: 0,
        totalAmount: 118,
      })
    ).toBe(18);
  });
});
