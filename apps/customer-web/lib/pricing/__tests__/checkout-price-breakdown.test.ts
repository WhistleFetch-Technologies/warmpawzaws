import { buildCheckoutPriceLines } from '../checkout-price-breakdown';

const fees = { platformFee: 0, convenienceFee: 0, deliveryFee: 0, packagingFee: 0 };

function taxLines(lines: ReturnType<typeof buildCheckoutPriceLines>) {
  return lines.filter((l) => l.kind === 'tax').map((l) => ({ label: l.label, amount: l.amount }));
}

describe('checkout GST display', () => {
  test('inter-state shows IGST only, not GST total', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Service price',
      subtotal: 1100,
      taxBreakdown: {
        subtotal: 1100,
        cgst: 0,
        sgst: 0,
        igst: 198,
        totalTax: 198,
        taxRate: 18,
        isInterState: true,
      },
      platformFees: fees,
      walletAmount: 470,
      finalAmount: 828,
    });
    expect(taxLines(lines)).toEqual([{ label: 'IGST (18%)', amount: 198 }]);
    expect(lines.some((l) => l.label.startsWith('GST'))).toBe(false);
    expect(lines.some((l) => l.label.startsWith('CGST'))).toBe(false);
    expect(lines.some((l) => l.label.startsWith('SGST'))).toBe(false);
    expect(lines.find((l) => l.kind === 'final')?.amount).toBe(828);
  });

  test('intra-state shows CGST and SGST only, not GST total', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Service price',
      subtotal: 1100,
      taxBreakdown: {
        subtotal: 1100,
        cgst: 99,
        sgst: 99,
        igst: 0,
        totalTax: 198,
        taxRate: 18,
        isInterState: false,
      },
      platformFees: fees,
      walletAmount: 470,
      finalAmount: 828,
    });
    expect(taxLines(lines)).toEqual([
      { label: 'CGST (9%)', amount: 99 },
      { label: 'SGST (9%)', amount: 99 },
    ]);
    expect(lines.some((l) => l.label.startsWith('GST'))).toBe(false);
    expect(lines.some((l) => l.label.startsWith('IGST'))).toBe(false);
    expect(lines.find((l) => l.kind === 'final')?.amount).toBe(828);
  });

  test('zero GST emits no tax component lines', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Service price',
      subtotal: 1100,
      taxBreakdown: {
        subtotal: 1100,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        taxRate: 0,
        isInterState: false,
      },
      platformFees: fees,
      finalAmount: 1100,
    });
    expect(taxLines(lines)).toEqual([]);
  });

  test('package inter-state shows IGST only, not GST + IGST', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Package price',
      subtotal: 1100,
      taxBreakdown: {
        subtotal: 1100,
        cgst: 0,
        sgst: 0,
        igst: 198,
        totalTax: 198,
        taxRate: 18,
        isInterState: true,
      },
      platformFees: fees,
      finalAmount: 1298,
    });
    expect(taxLines(lines)).toEqual([{ label: 'IGST (18%)', amount: 198 }]);
    expect(lines.some((l) => l.label.startsWith('GST'))).toBe(false);
  });

  test('package intra-state shows CGST and SGST only, not GST + components', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Package price',
      subtotal: 1100,
      taxBreakdown: {
        subtotal: 1100,
        cgst: 99,
        sgst: 99,
        igst: 0,
        totalTax: 198,
        taxRate: 18,
        isInterState: false,
      },
      platformFees: fees,
      finalAmount: 1298,
    });
    expect(taxLines(lines)).toEqual([
      { label: 'CGST (9%)', amount: 99 },
      { label: 'SGST (9%)', amount: 99 },
    ]);
    expect(lines.some((l) => l.label.startsWith('GST'))).toBe(false);
  });

  test('mixed-service lines show per-service GST from backend items, not one combined rate', () => {
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Service price',
      subtotal: 2000,
      taxBreakdown: {
        subtotal: 2000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        totalTax: 180,
        taxRate: 9,
        isInterState: false,
        taxItemLines: [
          { label: 'Veterinary', gstRate: 0, cgst: 0, sgst: 0, igst: 0, gstAmount: 0 },
          { label: 'Diagnostic', gstRate: 18, cgst: 90, sgst: 90, igst: 0, gstAmount: 180 },
        ],
      },
      platformFees: fees,
      finalAmount: 2180,
    });
    expect(taxLines(lines)).toEqual([
      { label: 'GST · Veterinary (0%)', amount: 0 },
      { label: 'CGST · Diagnostic (9%)', amount: 90 },
      { label: 'SGST · Diagnostic (9%)', amount: 90 },
    ]);
    expect(lines.some((l) => l.label === 'CGST (4.5%)' || l.label === 'GST (9%)')).toBe(false);
    expect(lines.find((l) => l.kind === 'final')?.amount).toBe(2180);
  });

  test('display lines do not change the authoritative finalAmount', () => {
    const finalAmount = 1100 + 198 - 470;
    const lines = buildCheckoutPriceLines({
      subtotalLabel: 'Service price',
      subtotal: 1100,
      taxBreakdown: {
        subtotal: 1100,
        cgst: 0,
        sgst: 0,
        igst: 198,
        totalTax: 198,
        taxRate: 18,
        isInterState: true,
      },
      platformFees: fees,
      walletAmount: 470,
      finalAmount,
    });
    expect(finalAmount).toBe(828);
    expect(lines.find((l) => l.kind === 'final')?.amount).toBe(828);
    expect(lines.find((l) => l.kind === 'final')?.amount).not.toBe(1100 + 198 + 198 - 470);
  });
});
