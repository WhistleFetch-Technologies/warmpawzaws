import {
  normalizeOptionValues,
  resolveSkuFromSelection,
  resolveSkuPriceForSelection,
  parseClientSkuPrice,
  optionValuesToSelectedVariations,
  variationSelectionKey,
  getInitialProductSku,
  getFirstInStockProductSku,
  hasIncompleteVariantSelection,
  isOptionValueAvailable,
  getAvailableOptionValues,
  hasInvalidVariantSelection,
  resolveDisplaySku,
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

  it('getInitialProductSku uses listing SKU (lowest in-stock SP)', () => {
    const rows: ClientProductSku[] = [
      { id: 'd', price: 500, stock: 0, sort_order: 0 },
      { id: 'c', price: 400, stock: 5, sort_order: 1 },
    ];
    expect(getInitialProductSku(rows)?.id).toBe('c');
  });

  it('getInitialProductSku picks lowest in-stock price not sort_order zero', () => {
    const rows: ClientProductSku[] = [
      { id: 'd', price: 500, stock: 3, sort_order: 0 },
      { id: 'c', price: 400, stock: 5, sort_order: 1 },
    ];
    expect(getInitialProductSku(rows)?.id).toBe('c');
  });

  it('getFirstInStockProductSku returns null when all OOS', () => {
    expect(
      getFirstInStockProductSku([
        { id: 'a', price: 1, stock: 0, sort_order: 0 },
      ]),
    ).toBeNull();
  });

  it('hasIncompleteVariantSelection is true for partial selection', () => {
    expect(hasIncompleteVariantSelection(skus, { size: 's' })).toBe(false);
    expect(hasIncompleteVariantSelection(skus, {})).toBe(true);
  });

  describe('SKU matrix availability', () => {
    const matrixSkus: ClientProductSku[] = [
      {
        id: 'a',
        option_values: { color: 'red', flavour: 'blackberry' },
        price: 100,
        stock: 5,
      },
      {
        id: 'b',
        option_values: { color: 'red', flavour: 'choclate' },
        price: 110,
        stock: 3,
      },
    ];
    const axes = [
      { type: 'color' as const, name: 'Color', option_key: 'color' },
      { type: 'other' as const, name: 'Flavour', option_key: 'flavour' },
    ];

    it('isOptionValueAvailable disables invalid cross-combinations', () => {
      expect(
        isOptionValueAvailable(matrixSkus, { color: 'red' }, 'flavour', 'blackberry', axes),
      ).toBe(true);
      expect(
        isOptionValueAvailable(matrixSkus, { color: 'red' }, 'flavour', 'choclate', axes),
      ).toBe(true);
      expect(
        isOptionValueAvailable(matrixSkus, { colour: 'blue' }, 'flavour', 'blackberry', axes),
      ).toBe(false);
    });

    it('hasInvalidVariantSelection when full selection has no exact SKU', () => {
      expect(
        hasInvalidVariantSelection(matrixSkus, { color: 'red', flavour: 'blackberry' }, axes),
      ).toBe(false);
      expect(
        hasInvalidVariantSelection(matrixSkus, { color: 'blue', flavour: 'blackberry' }, axes),
      ).toBe(true);
    });

    it('resolveDisplaySku uses exact match only when all axes selected', () => {
      expect(resolveDisplaySku(matrixSkus, { color: 'red', flavour: 'blackberry' }, axes)?.id).toBe(
        'a',
      );
      expect(resolveDisplaySku(matrixSkus, { color: 'blue', flavour: 'blackberry' }, axes)).toBeNull();
    });

    it('getAvailableOptionValues filters by partial selection', () => {
      expect(getAvailableOptionValues(matrixSkus, { color: 'red' }, 'flavour', axes)).toEqual([
        'blackberry',
        'choclate',
      ]);
      expect(getAvailableOptionValues(matrixSkus, { colour: 'blue' }, 'flavour', axes)).toEqual([]);
    });

    it('allows selecting in-stock size when weight axis duplicates size values', () => {
      const petFoodSkus: ClientProductSku[] = [
        {
          id: 's1',
          option_values: { size: '800g', weight: '800g' },
          price: 819,
          stock: 5,
        },
        {
          id: 's2',
          option_values: { size: '2.5kg', weight: '2.5kg' },
          price: 2205,
          stock: 10,
        },
        {
          id: 's3',
          option_values: { size: '7kg', weight: '7kg' },
          price: 6090,
          stock: 6,
        },
      ];
      const axes = [
        { type: 'size' as const, name: 'Size', option_key: 'size' },
        { type: 'weight' as const, name: 'Weight', option_key: 'weight' },
      ];
      const selected = { size: '800g', weight: '800g' };

      expect(isOptionValueAvailable(petFoodSkus, selected, 'size', '2.5kg', axes)).toBe(true);
      expect(isOptionValueAvailable(petFoodSkus, selected, 'size', '7kg', axes)).toBe(true);
      expect(resolveSkuFromSelection(petFoodSkus, { size: '2.5kg' })?.id).toBe('s2');

      const oosSkus: ClientProductSku[] = [
        { id: 'x', option_values: { size: 'XL' }, price: 100, stock: 0 },
      ];
      expect(isOptionValueAvailable(oosSkus, {}, 'size', 'XL', [{ type: 'size', option_key: 'size' }])).toBe(
        false,
      );
    });

    it('supports three-axis matrix', () => {
      const threeAxisSkus: ClientProductSku[] = [
        {
          id: '1',
          option_values: { flavour: 'Chicken', pack: '500g', size: 'Adult' },
          price: 500,
          stock: 2,
        },
        {
          id: '2',
          option_values: { flavour: 'Chicken', pack: '1kg', size: 'Adult' },
          price: 900,
          stock: 1,
        },
      ];
      const threeAxes = [
        { type: 'other' as const, name: 'Flavour', option_key: 'flavour' },
        { type: 'other' as const, name: 'Pack', option_key: 'pack' },
        { type: 'size' as const, name: 'Size', option_key: 'size' },
      ];
      expect(
        isOptionValueAvailable(
          threeAxisSkus,
          { flavour: 'Chicken', pack: '500g' },
          'size',
          'Adult',
          threeAxes,
        ),
      ).toBe(true);
      expect(
        isOptionValueAvailable(
          threeAxisSkus,
          { flavour: 'Chicken', pack: '500g' },
          'size',
          'Puppy',
          threeAxes,
        ),
      ).toBe(false);
    });
  });
});
