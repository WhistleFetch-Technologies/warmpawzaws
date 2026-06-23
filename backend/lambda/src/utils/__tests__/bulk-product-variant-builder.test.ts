import {
  groupBulkRows,
  buildSkuInputsFromGroup,
  validateVariantGroup,
  parseBulkRowOptionValues,
  normalizeProductGroupKey,
  slugifyVariantKey,
  aggregateGroupStock,
} from '../bulk-product-variant-builder';

describe('bulk-product-variant-builder', () => {
  it('normalizeProductGroupKey is case-insensitive', () => {
    expect(normalizeProductGroupKey('Dog Treats', 'Food')).toBe(
      normalizeProductGroupKey('dog treats', 'food'),
    );
  });

  it('slugifyVariantKey maps pack preset', () => {
    expect(slugifyVariantKey('Pack Size')).toBe('pack');
  });

  it('parseBulkRowOptionValues from legacy size/colour', () => {
    expect(
      parseBulkRowOptionValues({ size_variant: 'M', colour: 'Red' }),
    ).toEqual({ color: 'Red', size: 'M' });
  });

  it('parseBulkRowOptionValues from custom attr columns', () => {
    expect(
      parseBulkRowOptionValues({
        variant_attr_1: 'Pack',
        variant_value_1: '1X100',
      }),
    ).toEqual({ pack: '1X100' });
  });

  it('groupBulkRows groups same title+category', () => {
    const groups = groupBulkRows([
      {
        name: 'Treats',
        category: 'Food',
        price: 100,
        stock_quantity: 5,
        size_variant: 'S',
        rowNum: 1,
      },
      {
        name: 'Treats',
        category: 'Food',
        price: 100,
        stock_quantity: 8,
        size_variant: 'L',
        rowNum: 2,
      },
      {
        name: 'Other',
        category: 'Food',
        price: 50,
        stock_quantity: 1,
        rowNum: 3,
      },
    ] as any);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.name === 'Treats')?.variants).toHaveLength(2);
  });

  it('buildSkuInputsFromGroup puts default first with sort_order 0', () => {
    const groups = groupBulkRows([
      {
        name: 'Treats',
        category: 'Food',
        price: 100,
        compare_at_price: 120,
        stock_quantity: 5,
        size_variant: 'S',
        is_default: 'no',
        images: 'https://img/s.jpg',
        rowNum: 1,
      },
      {
        name: 'Treats',
        category: 'Food',
        price: 100,
        compare_at_price: 120,
        stock_quantity: 8,
        size_variant: 'L',
        is_default: 'yes',
        images: 'https://img/l.jpg',
        rowNum: 2,
      },
    ] as any);
    const skus = buildSkuInputsFromGroup(groups[0], { price: 100, compare_at_price: 120 });
    expect(skus).toHaveLength(2);
    expect(skus[0].sort_order).toBe(0);
    expect(skus[0].option_values).toEqual({ size: 'L' });
    expect(skus[1].option_values).toEqual({ size: 'S' });
  });

  it('buildSkuInputsFromGroup uses variant price override', () => {
    const groups = groupBulkRows([
      {
        name: 'Treats',
        category: 'Food',
        price: 100,
        compare_at_price: 120,
        stock_quantity: 5,
        variant_attr_1: 'Pack',
        variant_value_1: '1X100',
        variant_sp: 450,
        images: 'https://img/a.jpg',
        rowNum: 1,
      },
    ] as any);
    const skus = buildSkuInputsFromGroup(groups[0], { price: 100, compare_at_price: 120 });
    expect(skus[0].price).toBe(450);
    expect(skus[0].option_values).toEqual({ pack: '1X100' });
  });

  it('validateVariantGroup rejects duplicate variants', () => {
    const groups = groupBulkRows([
      {
        name: 'Treats',
        category: 'Food',
        price: 100,
        stock_quantity: 5,
        size_variant: 'M',
        colour: 'Red',
        images: 'https://img/a.jpg',
        rowNum: 1,
      },
      {
        name: 'Treats',
        category: 'Food',
        price: 100,
        stock_quantity: 3,
        size_variant: 'M',
        colour: 'Red',
        images: 'https://img/b.jpg',
        rowNum: 2,
      },
    ] as any);
    const errors = validateVariantGroup(groups[0]);
    expect(errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('aggregateGroupStock sums variant quantities', () => {
    const groups = groupBulkRows([
      { name: 'X', category: 'C', price: 10, stock_quantity: 5, rowNum: 1 },
      { name: 'X', category: 'C', price: 10, stock_quantity: 7, size_variant: 'S', rowNum: 2 },
    ] as any);
    expect(aggregateGroupStock(groups[0])).toBe(12);
  });
});
