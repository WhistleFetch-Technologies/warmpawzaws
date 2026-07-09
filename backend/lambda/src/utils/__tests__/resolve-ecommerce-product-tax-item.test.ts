import { buildEcommerceProductTaxItems } from '../resolve-ecommerce-product-tax-item';

describe('buildEcommerceProductTaxItems', () => {
  it('always marks product lines as GST-inclusive (locked business decision)', () => {
    const items = buildEcommerceProductTaxItems([
      { productId: 'p1', unitPrice: 1180, quantity: 1, hsnCode: '3004' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].amountIsTaxInclusive).toBe(true);
  });

  it('uses the ORIGINAL unit price as-is, never a discounted amount', () => {
    const items = buildEcommerceProductTaxItems([
      { productId: 'p1', unitPrice: 500, quantity: 3, hsnCode: '3004' },
    ]);
    expect(items[0].amount).toBe(500);
    expect(items[0].quantity).toBe(3);
  });

  it('trims and forwards the HSN code', () => {
    const items = buildEcommerceProductTaxItems([
      { productId: 'p1', unitPrice: 100, quantity: 1, hsnCode: '  3004  ' },
    ]);
    expect(items[0].hsnCode).toBe('3004');
  });

  it('omits hsnCode when null/empty', () => {
    const items = buildEcommerceProductTaxItems([
      { productId: 'p1', unitPrice: 100, quantity: 1, hsnCode: null },
      { productId: 'p2', unitPrice: 100, quantity: 1, hsnCode: '' },
    ]);
    expect(items[0].hsnCode).toBeUndefined();
    expect(items[1].hsnCode).toBeUndefined();
  });

  it('maps productId to id and type to product for every line', () => {
    const items = buildEcommerceProductTaxItems([
      { productId: 'p1', unitPrice: 100, quantity: 1 },
      { productId: 'p2', unitPrice: 200, quantity: 2 },
    ]);
    expect(items.map((i) => i.id)).toEqual(['p1', 'p2']);
    expect(items.every((i) => i.type === 'product')).toBe(true);
  });
});
