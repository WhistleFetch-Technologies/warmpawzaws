import {
  normalizeOptionValues,
  resolveSkuFromSelection,
  buildVariationAxes,
  mapSkusToCustomerVariations,
  aggregateParentStock,
  minSkuPrice,
  minInStockSkuPrice,
  getListingProductSku,
  applyStorefrontSkuPricingFields,
  optionValuesMatch,
  metadataVariantsToSkus,
  buildGalleryImageUnion,
  mergeLegacyVariantImagesIntoSkus,
  getDefaultProductSku,
  hasVariableSkuPricing,
  sortSkusByDefaultOrder,
  type ProductSkuRow,
} from '../product-sku-resolve';

describe('product-sku-resolve', () => {
  const skus: ProductSkuRow[] = [
    {
      id: '1',
      sku: 'SKU-S-M',
      option_values: { size: 'S', color: 'Red' },
      price: 100,
      stock: 5,
      images: ['https://example.com/red.jpg'],
      is_active: true,
    },
    {
      id: '2',
      sku: 'SKU-M-M',
      option_values: { size: 'M', color: 'Red' },
      price: 110,
      stock: 3,
      images: ['https://example.com/red-m.jpg'],
      is_active: true,
    },
    {
      id: '3',
      sku: 'SKU-S-B',
      option_values: { size: 'S', color: 'Blue' },
      price: 105,
      stock: 0,
      images: ['https://example.com/blue.jpg'],
      is_active: true,
    },
  ];

  it('normalizeOptionValues sorts keys and trims', () => {
    expect(normalizeOptionValues({ Color: ' Red ', size: 'M' })).toEqual({
      color: 'Red',
      size: 'M',
    });
  });

  it('resolveSkuFromSelection finds exact match', () => {
    const found = resolveSkuFromSelection(skus, { size: 'M', color: 'Red' });
    expect(found?.id).toBe('2');
  });

  it('resolveSkuFromSelection partial match for color', () => {
    const found = resolveSkuFromSelection(skus, { color: 'Blue' }, { partial: true });
    expect(found?.id).toBe('3');
  });

  it('buildVariationAxes derives size and color', () => {
    const axes = buildVariationAxes(skus);
    expect(axes.length).toBe(2);
    expect(axes.find((a) => a.type === 'size')?.values).toEqual(['M', 'S']);
  });

  it('aggregateParentStock sums active SKU stock', () => {
    expect(aggregateParentStock(skus)).toBe(8);
  });

  it('minSkuPrice returns lowest price', () => {
    expect(minSkuPrice(skus)).toBe(100);
  });

  it('minInStockSkuPrice ignores zero-stock SKUs', () => {
    expect(minInStockSkuPrice(skus)).toBe(100);
    const allOos = skus.map((s) => ({ ...s, stock: 0 }));
    expect(minInStockSkuPrice(allOos)).toBeNull();
  });

  it('getListingProductSku picks lowest in-stock SP with sort_order tie-break', () => {
    const variantSkus: ProductSkuRow[] = [
      { id: 'd', price: 500, stock: 10, sort_order: 0, is_active: true },
      { id: 'c', price: 400, stock: 5, sort_order: 1, is_active: true },
      { id: 'o', price: 300, stock: 0, sort_order: 2, is_active: true },
    ];
    expect(getListingProductSku(variantSkus)?.id).toBe('c');
  });

  it('getListingProductSku falls back to lowest price when all OOS', () => {
    const allOos: ProductSkuRow[] = [
      { id: 'd', price: 500, stock: 0, sort_order: 0, is_active: true },
      { id: 'c', price: 400, stock: 0, sort_order: 1, is_active: true },
    ];
    expect(getListingProductSku(allOos)?.id).toBe('c');
  });

  it('applyStorefrontSkuPricingFields sets listing price and price_from', () => {
    const variantSkus: ProductSkuRow[] = [
      {
        id: 'd',
        price: 500,
        compare_at_price: 600,
        stock: 10,
        sort_order: 0,
        is_active: true,
        option_values: { size: 'L' },
      },
      {
        id: 'c',
        price: 400,
        compare_at_price: 550,
        stock: 5,
        sort_order: 1,
        is_active: true,
        option_values: { size: 'S' },
      },
    ];
    const out = applyStorefrontSkuPricingFields({ id: 'p1', price: 500 }, variantSkus);
    expect(out.price).toBe(400);
    expect(out.min_price).toBe(400);
    expect(out.original_price).toBe(550);
    expect(out.price_from).toBe(true);
    expect(out.has_variants).toBe(true);
    expect(out.default_sku_id).toBe('c');
    expect(out.listing_sku_id).toBe('c');
  });

  it('getDefaultProductSku aliases getListingProductSku', () => {
    const variantSkus: ProductSkuRow[] = [
      { id: 'd', price: 500, stock: 10, sort_order: 0, is_active: true },
      { id: 'c', price: 400, stock: 5, sort_order: 1, is_active: true },
    ];
    expect(getDefaultProductSku(variantSkus)?.id).toBe('c');
  });

  it('hasVariableSkuPricing detects multiple prices', () => {
    expect(hasVariableSkuPricing(skus)).toBe(true);
    expect(
      hasVariableSkuPricing([
        { ...skus[0], price: 100 },
        { ...skus[1], price: 100 },
      ]),
    ).toBe(false);
  });

  it('sortSkusByDefaultOrder orders by sort_order', () => {
    const shuffled = [
      { ...skus[2], sort_order: 2 },
      { ...skus[0], sort_order: 0 },
      { ...skus[1], sort_order: 1 },
    ];
    expect(sortSkusByDefaultOrder(shuffled).map((s) => s.id)).toEqual(['1', '2', '3']);
  });

  it('optionValuesMatch requires all axes when requireAllAxes true', () => {
    expect(optionValuesMatch({ size: 'S', color: 'Red' }, { size: 'S' }, true)).toBe(false);
    expect(optionValuesMatch({ size: 'S', color: 'Red' }, { size: 'S', color: 'Red' }, true)).toBe(true);
  });

  it('metadataVariantsToSkus maps legacy shape', () => {
    const rows = metadataVariantsToSkus(
      [{ size: 'L', color: 'Green', price: 50, stock: 2 }],
      40,
    );
    expect(rows[0].option_values).toEqual({ size: 'L', color: 'Green' });
    expect(rows[0].price).toBe(50);
  });

  it('buildGalleryImageUnion dedupes parent and sku images', () => {
    const gallery = buildGalleryImageUnion(
      ['https://example.com/parent.jpg', 'https://example.com/red.jpg'],
      skus,
    );
    expect(gallery).toContain('https://example.com/parent.jpg');
    expect(gallery).toContain('https://example.com/blue.jpg');
  });

  it('mapSkusToCustomerVariations produces options with per-option price', () => {
    const variations = mapSkusToCustomerVariations(skus);
    expect(variations.length).toBeGreaterThan(0);
    expect(variations[0].options.length).toBeGreaterThan(0);
    const sizeAxis = variations.find((v) => v.type === 'size');
    const mOption = sizeAxis?.options.find((o) => o.value === 'M');
    expect(mOption?.price).toBe(110);
    expect(sizeAxis?.option_key).toBe('size');
  });

  it('buildVariationAxes and mapSkus expose option_key for custom pack axis', () => {
    const packSkus: ProductSkuRow[] = [
      {
        id: '1',
        option_values: { pack: '1X100' },
        price: 450,
        stock: 5,
        is_active: true,
        sort_order: 0,
      },
      {
        id: '2',
        option_values: { pack: '2X100' },
        price: 800,
        stock: 3,
        is_active: true,
        sort_order: 1,
      },
    ];
    const axes = buildVariationAxes(packSkus);
    expect(axes[0].key).toBe('pack');
    const variations = mapSkusToCustomerVariations(packSkus);
    expect(variations[0].option_key).toBe('pack');
    expect(variations[0].name).toBe('Pack');
  });

  it('mergeLegacyVariantImagesIntoSkus fills empty sku images from metadata.variants', () => {
    const emptySkus: ProductSkuRow[] = [
      {
        id: 'a',
        option_values: { color: 'red' },
        price: 100,
        stock: 5,
        images: [],
      },
      {
        id: 'b',
        option_values: { color: 'black' },
        price: 110,
        stock: 7,
        images: [],
      },
    ];
    const legacy = [
      { color: 'red', images: ['https://example.com/red-variant.jpg'] },
      { color: 'black', images: ['https://example.com/black-variant.jpg'] },
    ];
    const merged = mergeLegacyVariantImagesIntoSkus(emptySkus, legacy);
    expect(merged[0].images).toEqual(['https://example.com/red-variant.jpg']);
    expect(merged[1].images).toEqual(['https://example.com/black-variant.jpg']);
  });
});
