function effectiveInvoiceGstRatePercent(invoiceRow: {
  subtotal?: string | number;
  tax_amount?: string | number;
}): string {
  const subtotal = parseFloat(String(invoiceRow.subtotal ?? 0));
  const tax = parseFloat(String(invoiceRow.tax_amount ?? 0));
  if (subtotal <= 0 || tax <= 0) return '0';
  return (Math.round((tax / subtotal) * 10000) / 100).toFixed(2);
}

describe('effectiveInvoiceGstRatePercent', () => {
  it('derives rate from subtotal and tax', () => {
    expect(effectiveInvoiceGstRatePercent({ subtotal: 100, tax_amount: 18 })).toBe('18.00');
    expect(effectiveInvoiceGstRatePercent({ subtotal: 200, tax_amount: 24 })).toBe('12.00');
    expect(effectiveInvoiceGstRatePercent({ subtotal: 0, tax_amount: 0 })).toBe('0');
  });
});
