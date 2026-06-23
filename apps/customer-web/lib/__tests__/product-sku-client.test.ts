import {
  normalizeOptionValues,
  resolveSkuFromSelection,
  resolveSkuPriceForSelection,
  parseClientSkuPrice,
  optionValuesToSelectedVariations,
  variationSelectionKey,
  type ClientProductSku,
} from '../product-sku-client';

const skus: ClientProductSku[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    option_values: { size: 's' },
    price: 33,
    compare_at_price: 40,
    stock: 10,
    sort_order: 0,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    option_values: { size: 'xl' },
    price: 55,
    compare_at_price: 60,
    stock: 22,
    sort_order: 1,
  },
];

describe('product-sku-client', () => {
  it('normalizeOptionValues maps colour to color', () => {
    expect(normalizeOptionValues({ Colour: 'Red' })).toEqual({ color: 'Red' });
  });

  it('resolveSkuFromSelection matches colour sku with color selection', () => {
    const colourSkus: ClientProductSku[] = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        option_values: { colour: 'Red' },
        price: 99,
        stock: 1,
      },
    ];
    const found = resolveSkuFromSelection(colourSkus, { color: 'Red' });
    expect(found?.price).toBe(99);
  });

  it('resolveSkuPriceForSelection returns price for selected variant', () => {
    expect(resolveSkuPriceForSelection(skus, { size: 's' }, 0)).toBe(33);
    expect(resolveSkuPriceForSelection(skus, { size: 'xl' }, 0)).toBe(55);
  });

  it('parseClientSkuPrice preserves zero and uses fallback for invalid', () => {
    expect(parseClientSkuPrice(0, 99)).toBe(0);
    expect(parseClientSkuPrice(undefined, 99)).toBe(99);
    expect(parseClientSkuPrice('45', 99)).toBe(45);
  });

  it('optionValuesToSelectedVariations uses option_key for pack axis', () => {
    const selected = optionValuesToSelectedVariations(
      { pack: '1X100' },
      [{ type: 'other', name: 'Pack', option_key: 'pack' }],
    );
    expect(selected).toEqual({ pack: '1X100' });
    expect(variationSelectionKey({ type: 'other', option_key: 'pack' })).toBe('pack');
  });

  it('resolveSkuFromSelection matches pack variants', () => {
    const packSkus: ClientProductSku[] = [
      {
        id: '44444444-4444-4444-8444-444444444444',
        option_values: { pack: '1X100' },
        price: 550,
        stock: 5,
        sort_order: 0,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        option_values: { pack: '2X100' },
        price: 1000,
        stock: 3,
        sort_order: 1,
      },
    ];
    expect(resolveSkuFromSelection(packSkus, { pack: '2X100' })?.price).toBe(1000);
    expect(resolveSkuPriceForSelection(packSkus, { pack: '1X100' }, 0)).toBe(550);
  });
});
