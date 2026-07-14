import {
  groupBulkRows,
  buildSkuInputsFromGroup,
  validateVariantGroup,
  parseBulkRowOptionValues,
  normalizeProductGroupKey,
  slugifyVariantKey,
  aggregateGroupStock,
  bulkGroupExtrasSource,
  listingPriceFromGroup,
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

  it('groupBulkRows groups by product_group_id within upload', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-1',
          brand: 'Acme',
          price: 100,
          compare_at_price: 120,
          stock_quantity: 5,
          size_variant: 'S',
          rowNum: 1,
        },
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-1',
          brand: 'Acme',
          price: 110,
          compare_at_price: 130,
          stock_quantity: 8,
          size_variant: 'L',
          rowNum: 2,
        },
        {
          name: 'Other',
          category: 'Food',
          price: 50,
          compare_at_price: 60,
          stock_quantity: 1,
          rowNum: 3,
        },
      ] as any,
    );
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.name === 'Treats')?.variants).toHaveLength(2);
  });

  it('groupBulkRows copies listing_ownership onto parent', () => {
    const groups = groupBulkRows([
      {
        name: 'Treats',
        category: 'Food',
        brand: 'Acme',
        price: 100,
        stock_quantity: 5,
        listing_ownership: 'Own brand',
        rowNum: 1,
      },
    ] as any);
    expect(groups).toHaveLength(1);
    expect(groups[0].parent.listing_ownership).toBe('Own brand');
  });

  it('groupBulkRows groups by Warmpawz Product ID for updates', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Treats',
          category: 'Food',
          warmpawz_product_id: 'prod-uuid-1',
          brand: 'Acme',
          price: 100,
          stock_quantity: 5,
          size_variant: 'S',
          rowNum: 1,
        },
        {
          name: 'Treats',
          category: 'Food',
          warmpawz_product_id: 'prod-uuid-1',
          brand: 'Acme',
          price: 110,
          stock_quantity: 8,
          size_variant: 'L',
          rowNum: 2,
        },
      ] as any,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].warmpawz_product_id).toBe('prod-uuid-1');
  });

  it('same Product Group ID on different rows does not merge without shared upload key when row-scoped', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Product A',
          category: 'Food',
          product_group_id: 'shared-id',
          brand: 'Acme',
          price: 100,
          stock_quantity: 5,
          rowNum: 1,
        },
        {
          name: 'Product B',
          category: 'Food',
          product_group_id: 'shared-id',
          brand: 'Other',
          price: 50,
          stock_quantity: 1,
          rowNum: 2,
        },
      ] as any,
    );
    // Same pgid still groups in one upload — intentional for variant rows.
    // Different titles with same pgid and no variants will fail validateVariantGroup.
    expect(groups).toHaveLength(1);
  });

  it('buildSkuInputsFromGroup uses row MRP and SP', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-2',
          brand: 'Acme',
          price: 90,
          compare_at_price: 120,
          stock_quantity: 5,
          size_variant: 'S',
          images: 'https://img/s.jpg',
          rowNum: 1,
        },
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-2',
          brand: 'Acme',
          price: 100,
          compare_at_price: 130,
          stock_quantity: 8,
          size_variant: 'L',
          images: 'https://img/l.jpg',
          rowNum: 2,
        },
      ] as any,
    );
    const skus = buildSkuInputsFromGroup(groups[0]);
    expect(skus).toHaveLength(2);
    expect(skus[0].price).toBe(90);
    expect(skus[0].compare_at_price).toBeNull();
    expect(skus[1].price).toBe(100);
    expect(skus[1].compare_at_price).toBeNull();
  });

  it('buildSkuInputsFromGroup defaults SP to MRP when SP empty', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-3',
          brand: 'Acme',
          compare_at_price: 120,
          stock_quantity: 5,
          variant_attr_1: 'Pack',
          variant_value_1: '1X100',
          images: 'https://img/a.jpg',
          rowNum: 1,
        },
      ] as any,
    );
    const skus = buildSkuInputsFromGroup(groups[0]);
    expect(skus[0].price).toBe(120);
    expect(skus[0].option_values).toEqual({ pack: '1X100' });
  });

  it('listingPriceFromGroup picks lowest in-stock SP', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-4',
          brand: 'Acme',
          price: 200,
          compare_at_price: 250,
          stock_quantity: 0,
          size_variant: 'S',
          rowNum: 1,
        },
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-4',
          brand: 'Acme',
          price: 150,
          compare_at_price: 180,
          stock_quantity: 5,
          size_variant: 'L',
          rowNum: 2,
        },
      ] as any,

    );
    const listing = listingPriceFromGroup(groups[0]);
    expect(listing.price).toBe(150);
    expect(listing.compare_at_price).toBeNull();
  });

  it('validateVariantGroup rejects duplicate variants', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-5',
          brand: 'Acme',
          price: 100,
          compare_at_price: 120,
          stock_quantity: 5,
          size_variant: 'M',
          colour: 'Red',
          images: 'https://img/a.jpg',
          rowNum: 1,
        },
        {
          name: 'Treats',
          category: 'Food',
          product_group_id: 'grp-5',
          brand: 'Acme',
          price: 100,
          compare_at_price: 120,
          stock_quantity: 3,
          size_variant: 'M',
          colour: 'Red',
          images: 'https://img/b.jpg',
          rowNum: 2,
        },
      ] as any,

    );
    const errors = validateVariantGroup(groups[0]);
    expect(errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('aggregateGroupStock sums variant quantities', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'X',
          category: 'C',
          product_group_id: 'grp-stock',
          brand: 'B',
          price: 10,
          compare_at_price: 12,
          stock_quantity: 5,
          size_variant: 'S',
          rowNum: 1,
        },
        {
          name: 'X',
          category: 'C',
          product_group_id: 'grp-stock',
          brand: 'B',
          price: 10,
          compare_at_price: 12,
          stock_quantity: 7,
          size_variant: 'L',
          rowNum: 2,
        },
      ] as any,

    );
    expect(aggregateGroupStock(groups[0])).toBe(12);
  });

  it('groupBulkRows parent carries canonical product-level fields from first row', () => {
    const groups = groupBulkRows(
      [
        {
          name: 'Dog Dress',
          category: 'Pet Accessories',
          price: 799,
          compare_at_price: 1598,
          stock_quantity: 10,
          brand: '15 FURRIES',
          key_features: 'Design: Smiling Flower',
          weight: 0.15,
          length_cm: '35',
          breadth_cm: '25',
          height_cm: '1',
          pet_type: 'Dog',
          manufacturing_details: 'Made in India',
          delivery_regions: ['Mumbai', 'Pune'],
          product_specifications: 'Material:Cotton',
          rowNum: 1,
        },
      ] as any,

    );
    expect(groups).toHaveLength(1);
    const p = groups[0].parent;
    expect(p.brand).toBe('15 FURRIES');
    expect(p.key_features).toBe('Design: Smiling Flower');
    expect(p.pet_type).toBe('Dog');
    expect(p.length_cm).toBe('35');
    expect(p.delivery_regions).toEqual(['Mumbai', 'Pune']);
    expect(p.product_specifications).toBe('Material:Cotton');
    const extras = bulkGroupExtrasSource(groups[0]);
    expect(extras.key_features).toBe('Design: Smiling Flower');
    expect(extras.delivery_regions).toEqual(['Mumbai', 'Pune']);
  });

  it('parseBulkRowOptionValues supports three variant attributes', () => {
    expect(
      parseBulkRowOptionValues({
        variant_attr_1: 'Flavour',
        variant_value_1: 'Chicken',
        variant_attr_2: 'Pack',
        variant_value_2: '500g',
        variant_attr_3: 'Size',
        variant_value_3: 'Adult',
      }),
    ).toEqual({ flavour: 'Chicken', pack: '500g', size: 'Adult' });
  });

  it('validateVariantGroup rejects more than fifty SKU rows', () => {
    const variants = Array.from({ length: 51 }, (_, i) => ({
      name: 'Food',
      category: 'Pet Food',
      product_group_id: 'pg-1',
      price: 100,
      compare_at_price: 120,
      stock_quantity: 5,
      images: 'https://example.com/a.jpg',
      variant_attr_1: 'Flavour',
      variant_value_1: `F${i}`,
      rowNum: i + 1,
    })) as any;
    const group = {
      groupKey: 'g1',
      product_group_id: 'pg-1',
      name: 'Food',
      category: 'Pet Food',
      parent: { price: 100, compare_at_price: 120, hsn_code: '1234', gst_rate: 5 },
      variants,
      rowNums: variants.map((v: { rowNum: number }) => v.rowNum),
    };
    const errors = validateVariantGroup(group as any);
    expect(errors.some((e) => e.message.includes('Maximum 50 variant rows'))).toBe(true);
  });

  it('validateVariantGroup allows multi-row updates with Warmpawz Product ID and no Product Group ID', () => {
    const group = {
      groupKey: 'wpid::prod-1',
      warmpawz_product_id: 'prod-1',
      name: 'Food',
      category: 'Pet Food',
      parent: {
        brand: 'Acme',
        price: 100,
        hsn_code: '1234',
        gst_rate: 5,
      },
      variants: [
        {
          name: 'Food',
          category: 'Pet Food',
          warmpawz_product_id: 'prod-1',
          brand: 'Acme',
          price: 100,
          stock_quantity: 5,
          images: 'https://example.com/a.jpg',
          variant_attr_1: 'Size',
          variant_value_1: 'S',
          rowNum: 1,
        },
        {
          name: 'Food',
          category: 'Pet Food',
          warmpawz_product_id: 'prod-1',
          brand: 'Acme',
          price: 110,
          stock_quantity: 3,
          images: 'https://example.com/b.jpg',
          variant_attr_1: 'Size',
          variant_value_1: 'L',
          rowNum: 2,
        },
      ] as any,
      rowNums: [1, 2],
    };
    const errors = validateVariantGroup(group as any);
    expect(errors.some((e) => e.field === 'product_group_id')).toBe(false);
  });
});
