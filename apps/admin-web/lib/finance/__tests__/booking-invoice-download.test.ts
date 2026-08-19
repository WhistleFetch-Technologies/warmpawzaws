import { extractInvoiceNumberFromHtml, safeInvoiceFileBaseName } from '../booking-invoice-download';

describe('booking-invoice-download helpers', () => {
  it('reads invoice number from HTML body', () => {
    const html = '<p class="invoice-number">INV-ABCD-202608-0001</p>';
    expect(extractInvoiceNumberFromHtml(html)).toBe('INV-ABCD-202608-0001');
  });

  it('falls back to title when body class is missing', () => {
    const html = '<title>Tax Invoice - BOOK-E6F07B3C</title>';
    expect(extractInvoiceNumberFromHtml(html)).toBe('BOOK-E6F07B3C');
  });

  it('sanitizes file names', () => {
    expect(safeInvoiceFileBaseName('INV/AB CD', 'uuid-here')).toBe('invoice-INV_AB_CD');
    expect(safeInvoiceFileBaseName('', 'abcdef12-xxxx')).toBe('invoice-abcdef12');
  });
});
