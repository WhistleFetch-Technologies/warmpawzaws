import {
  getEmbeddedInvoiceLogoDataUri,
  getInvoiceLogoSrc,
  renderInvoiceBrandHeader,
  WARMPAWZ_INVOICE_BRAND,
} from '../invoice-branding';

describe('invoice-branding', () => {
  it('renders logo to the left of Warmpawz brand text', () => {
    const html = renderInvoiceBrandHeader();
    expect(html).toContain('class="brand"');
    expect(html).toContain('class="brand-logo"');
    expect(html).toContain(`<h1>${WARMPAWZ_INVOICE_BRAND.name}</h1>`);
    expect(html).toContain(WARMPAWZ_INVOICE_BRAND.tagline);
    expect(html.indexOf('brand-logo')).toBeLessThan(html.indexOf('brand-text'));
  });

  it('prefers embedded logo data URI when asset is present', () => {
    const embedded = getEmbeddedInvoiceLogoDataUri();
    const src = getInvoiceLogoSrc();
    if (embedded) {
      expect(src).toMatch(/^data:image\/webp;base64,/);
    } else {
      expect(src).toMatch(/^https?:\/\//);
    }
  });
});
