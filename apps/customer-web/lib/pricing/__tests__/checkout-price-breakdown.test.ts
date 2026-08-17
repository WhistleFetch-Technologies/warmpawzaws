import { buildCheckoutPriceLines } from '../checkout-price-breakdown';

const fees = { platformFee: 0, convenienceFee: 0, deliveryFee: 0, packagingFee: 0 };

describe('checkout GST display', () => {
  test('intra-state shows GST plus CGST/SGST and not IGST', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Service price',
      subtotal: 1800,
      taxBreakdown: {
        subtotal: 1800,
        cgst: 162,
        sgst: 162,
        igst: 0,
        totalTax: 324,
        taxRate: 18,
        isInterState: false,
      },
      platformFees: fees,
      finalAmount: 2124,
    });
    const labels = lines.map((l) => l.label);
    expect(labels.some((l) => l.startsWith('GST'))).toBe(true);
    expect(labels.some((l) => l.startsWith('CGST'))).toBe(true);
    expect(labels.some((l) => l.startsWith('SGST'))).toBe(true);
    expect(labels.some((l) => l.startsWith('IGST'))).toBe(false);
  });

  test('inter-state shows GST plus IGST and not CGST/SGST', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Service price',
      subtotal: 1800,
      taxBreakdown: {
        subtotal: 1800,
        cgst: 0,
        sgst: 0,
        igst: 324,
        totalTax: 324,
        taxRate: 18,
        isInterState: true,
      },
      platformFees: fees,
      finalAmount: 2124,
    });
    const labels = lines.map((l) => l.label);
    expect(labels.some((l) => l.startsWith('GST'))).toBe(true);
    expect(labels.some((l) => l.startsWith('IGST'))).toBe(true);
    expect(labels.some((l) => l.startsWith('CGST'))).toBe(false);
    expect(labels.some((l) => l.startsWith('SGST'))).toBe(false);
  });
});
