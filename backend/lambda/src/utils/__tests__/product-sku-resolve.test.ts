import {
  normalizeOptionValues,
  resolveSkuFromSelection,
  buildVariationAxes,
  mapSkusToCustomerVariations,
  aggregateParentStock,
  minSkuPrice,
  optionValuesMatch,
  metadataVariantsToSkus,
  buildGalleryImageUnion,
  mergeLegacyVariantImagesIntoSkus,
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

  it('mapSkusToCustomerVariations produces options', () => {
    const variations = mapSkusToCustomerVariations(skus);
    expect(variations.length).toBeGreaterThan(0);
    expect(variations[0].options.length).toBeGreaterThan(0);
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
