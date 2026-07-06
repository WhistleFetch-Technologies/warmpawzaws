import {
  customerGstinFromInvoiceRow,
  inferIsInterStateFromInvoiceRow,
  placeOfSupplyFromInvoiceRow,
} from '../invoice-row-gst';

describe('invoice-row-gst', () => {
  it('infers inter-state from IGST split when column missing', () => {
    expect(
      inferIsInterStateFromInvoiceRow({
        igst_amount: 18,
        cgst_amount: 0,
        sgst_amount: 0,
      }),
    ).toBe(true);
    expect(
      inferIsInterStateFromInvoiceRow({
        igst_amount: 0,
        cgst_amount: 9,
        sgst_amount: 9,
      }),
    ).toBe(false);
  });

  it('reads isInterState from invoice_data JSON', () => {
    expect(
      inferIsInterStateFromInvoiceRow({
        invoice_data: { isInterState: true, igst: 0, cgst: 9, sgst: 9 },
      }),
    ).toBe(true);
  });

  it('reads customer GSTIN and place of supply from invoice_data', () => {
    const row = {
      invoice_data: {
        placeOfSupply: 'Maharashtra',
        customer: { gstin: '27ABCDE1234F1Z5' },
      },
    };
    expect(customerGstinFromInvoiceRow(row)).toBe('27ABCDE1234F1Z5');
    expect(placeOfSupplyFromInvoiceRow(row)).toBe('Maharashtra');
  });

  it('prefers dedicated columns when present', () => {
    expect(
      customerGstinFromInvoiceRow({
        customer_gstin: '29ABCDE1234F2Z3',
        invoice_data: { customer: { gstin: 'ignored' } },
      }),
    ).toBe('29ABCDE1234F2Z3');
    expect(
      placeOfSupplyFromInvoiceRow({
        place_of_supply: 'Karnataka',
        invoice_data: { placeOfSupply: 'ignored' },
      }),
    ).toBe('Karnataka');
  });
});
