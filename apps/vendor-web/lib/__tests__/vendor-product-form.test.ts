import {
  buildVendorProductPayload,
  validateProductForm,
  effectiveVariantPrice,
  effectiveVariantMrp,
  variantsFromProduct,
  presetVariantAxes,
  customVariantAxis,
  deliveryRegionsFromProduct,
  sellingPriceForForm,
  detectProductMode,
  gstRateForForm,
  initialProductFormState,
  petTypeSelectValueFromInput,
  PET_TYPE_SELECT_OTHER,
  categoryIdForForm,
  type VariantRow,
  type ProductFormState,
} from '../vendor-product-form';

const strip = (u: string) => u;

const baseForm: ProductFormState = {
  name: 'Test Product',
  description: 'Desc',
  category_id: 'cat-1',
  hsn_code: '1234',
  gst_rate: '18',
  emoji: '📦',
  status: 'pending',
  basePrice: '450',
  brand: '',
  listingOwnership: 'third_party',
  keyFeatures: '',
  weightKg: '',
  lengthCm: '',
  breadthCm: '',
  heightCm: '',
  petTypeInput: '',
  manufacturingDetails: '',
};

describe('vendor-product-form', () => {
  it('buildVendorProductPayload simple mode omits skus', () => {
    const payload = buildVendorProductPayload({
      form: baseForm,
      mode: 'simple',
      variants: [],
      simpleSku: { price: '450', stock: '10', images: ['https://img/a.jpg'], barcode: '' },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.skus).toEqual([]);
    expect(payload.stock).toBe(10);
    expect(payload.price).toBe(450);
    expect(payload.images).toEqual(['https://img/a.jpg']);
  });

  it('buildVendorProductPayload multi mode uses per-variant price (single-price model)', () => {
    const variants: VariantRow[] = [
      {
        id: 'v1',
        optionValues: { size: 'M', color: 'Red' },
        size: 'M',
        color: 'Red',
        price: '450',
        stock: '5',
        images: ['https://img/v.jpg'],
        isDefault: false,
      },
    ];
    const payload = buildVendorProductPayload({
      form: baseForm,
      mode: 'multi',
      variants,
      simpleSku: { price: '', stock: '', images: [], barcode: '' },
      variantAxes: presetVariantAxes('size_color'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.skus).toHaveLength(1);
    expect(payload.skus[0]).not.toHaveProperty('sku');
    expect(payload.skus[0].price).toBe(450);
    expect(payload.skus[0]).not.toHaveProperty('compare_at_price');
    expect(payload.skus[0].option_values).toEqual({ size: 'M', color: 'Red' });
    expect(payload.metadata?.variant_axes).toHaveLength(2);
    expect(payload.stock).toBe(5);
    expect(payload.images).toEqual(['https://img/v.jpg']);
    expect(payload.price).toBe(450);
    expect(payload).not.toHaveProperty('original_price');
  });

  it('effectiveVariantPrice returns price from price field only', () => {
    const row: VariantRow = {
      id: '1',
      optionValues: {},
      price: '',
      stock: '1',
      images: [],
      isDefault: false,
    };
    expect(effectiveVariantMrp(row)).toBe(0);
    expect(effectiveVariantPrice(row)).toBe(0);
    const filled: VariantRow = { ...row, price: '450' };
    expect(effectiveVariantMrp(filled)).toBe(450);
    expect(effectiveVariantPrice(filled)).toBe(450);
  });

  it('validateProductForm rejects missing listing ownership', () => {
    const err = validateProductForm({
      form: { ...baseForm, listingOwnership: '' },
      mode: 'simple',
      variants: [],
      simpleSku: { price: '450', stock: '10', images: ['a'], barcode: '' },
      variantAxes: presetVariantAxes('size'),
    });
    expect(err).toMatch(/Listing ownership is required/);
  });

  it('validateProductForm rejects duplicate variants', () => {
    const variants: VariantRow[] = [
      { id: '1', optionValues: { size: 'M', color: 'Red' }, size: 'M', color: 'Red', price: '450', stock: '1', images: ['a'], isDefault: false },
      { id: '2', optionValues: { size: 'M', color: 'Red' }, size: 'M', color: 'Red', price: '450', stock: '2', images: ['b'], isDefault: false },
    ];
    const err = validateProductForm({
      form: baseForm,
      mode: 'multi',
      variants,
      simpleSku: { price: '', stock: '', images: [], barcode: '' },
      variantAxes: presetVariantAxes('size_color'),
    });
    expect(err).toMatch(/Duplicate variant/);
  });

  it('variantsFromProduct loads skus sorted by sort_order', () => {
    const rows = variantsFromProduct({
      price: 33,
      original_price: 33,
      skus: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          sort_order: 1,
          option_values: { size: 'xl' },
          price: 33,
          compare_at_price: 33,
          stock: 22,
          images: ['https://img/b.jpg'],
          sku: 'WP-abc-xl',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          sort_order: 0,
          option_values: { size: 's' },
          price: 33,
          compare_at_price: 33,
          stock: 10,
          images: ['https://img/a.jpg'],
          sku: 'WP-abc-s',
        },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].skuRowId).toBe('22222222-2222-4222-8222-222222222222');
    expect(rows[0].price).toBe('33');
  });

  it('buildVendorProductPayload multi mode supports pack axis', () => {
    const variants: VariantRow[] = [
      {
        id: 'v1',
        optionValues: { pack: '1X100' },
        price: '550',
        stock: '3',
        images: ['https://img/p.jpg'],
        isDefault: true,
      },
    ];
    const payload = buildVendorProductPayload({
      form: baseForm,
      mode: 'multi',
      variants,
      simpleSku: { price: '', stock: '', images: [], barcode: '' },
      variantAxes: presetVariantAxes('pack'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.skus[0].option_values).toEqual({ pack: '1X100' });
    expect(payload.skus[0].price).toBe(550);
    expect(payload.metadata?.variant_axes?.[0]?.key).toBe('pack');
  });

  it('buildVendorProductPayload includes brand, weight, specs, delivery_regions', () => {
    const payload = buildVendorProductPayload({
      form: {
        ...baseForm,
        brand: 'PawCo',
        keyFeatures: 'Soft chew',
        weightKg: '1.2',
        lengthCm: '10',
        breadthCm: '5',
        heightCm: '3',
        petTypeInput: 'Dog',
      },
      mode: 'simple',
      variants: [],
      simpleSku: {
        price: '450',
        stock: '10',
        images: ['https://img/a.jpg'],
        barcode: '890123',
      },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
      customSpecs: [{ id: '1', key: 'Material', value: 'Cotton' }],
      deliveryRegions: ['Mumbai', 'Pune'],
    });
    expect(payload.brand).toBe('PawCo');
    expect(payload.weight).toBe(1.2);
    expect(payload.barcode).toBe('890123');
    expect(payload.specifications?.key_features).toBe('Soft chew');
    expect(payload.specifications?.length_cm).toBe(10);
    expect(payload.specifications?.pet_type).toBe('dog');
    expect(payload.specifications?.Material).toBe('Cotton');
    expect(payload.delivery_regions).toEqual(['Mumbai', 'Pune']);
  });

  it('initialProductFormState prefills GST from numeric API values', () => {
    const form = initialProductFormState({
      name: 'Treats',
      category_id: 'cat-1',
      hsn_code: '1234',
      gst_rate: '18.00',
      price: 450,
    });
    expect(form.gst_rate).toBe('18');
  });

  it('gstRateForForm handles gstRate alias and zero slab', () => {
    expect(gstRateForForm({ gst_rate: '18.00' })).toBe('18');
    expect(gstRateForForm({ gstRate: 5 })).toBe('5');
    expect(gstRateForForm({ gst_rate: 0 })).toBe('0');
    expect(gstRateForForm({})).toBe('');
  });

  it('petTypeSelectValueFromInput maps standard and custom pet types', () => {
    expect(petTypeSelectValueFromInput('')).toBe('');
    expect(petTypeSelectValueFromInput('Dog')).toBe('Dog');
    expect(petTypeSelectValueFromInput('All pets')).toBe('All pets');
    expect(petTypeSelectValueFromInput('Birds')).toBe(PET_TYPE_SELECT_OTHER);
  });

  it('categoryIdForForm resolves legacy category name when id missing', () => {
    const categories = [{ id: 'uuid-food', name: 'Pet Food' }];
    expect(
      categoryIdForForm({ category: 'Pet Food' }, categories),
    ).toBe('uuid-food');
    expect(
      categoryIdForForm({ category_id: 'uuid-food' }, categories),
    ).toBe('uuid-food');
  });

  it('validateProductForm allows All pets without extra text', () => {
    const err = validateProductForm({
      form: { ...baseForm, petTypeInput: 'All pets' },
      mode: 'simple',
      variants: [],
      simpleSku: { price: '450', stock: '10', images: ['a'], barcode: '' },
      variantAxes: presetVariantAxes('size'),
    });
    expect(err).toBeNull();
  });

  it('buildVendorProductPayload stores Birds as other + pet_type_other', () => {
    const payload = buildVendorProductPayload({
      form: { ...baseForm, petTypeInput: 'Birds' },
      mode: 'simple',
      variants: [],
      simpleSku: { price: '450', stock: '10', images: ['https://img/a.jpg'], barcode: '' },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.specifications?.pet_type).toBe('other');
    expect(payload.specifications?.pet_type_other).toBe('Birds');
  });

  it('buildVendorProductPayload stores empty pet type as allpet', () => {
    const payload = buildVendorProductPayload({
      form: baseForm,
      mode: 'simple',
      variants: [],
      simpleSku: { price: '450', stock: '10', images: ['https://img/a.jpg'], barcode: '' },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.specifications?.pet_type).toBe('allpet');
    expect(payload.specifications?.pet_type_other).toBeUndefined();
  });

  it('deliveryRegionsFromProduct reads flattened delivery_regions', () => {
    expect(
      deliveryRegionsFromProduct({
        delivery_regions: ['Delhi'],
      }),
    ).toEqual(['Delhi']);
    expect(
      deliveryRegionsFromProduct({
        metadata: { delivery_regions: ['Mumbai'] },
      }),
    ).toEqual(['Mumbai']);
  });

  it('sellingPriceForForm returns price when SP equals MRP', () => {
    expect(sellingPriceForForm({ price: 799, original_price: 799 })).toBe('799');
    expect(sellingPriceForForm({ price: 450, compare_at_price: 500 })).toBe('450');
  });

  it('buildVendorProductPayload simple mode uses form.basePrice as single price', () => {
    const payload = buildVendorProductPayload({
      form: { ...baseForm, basePrice: '450' },
      mode: 'simple',
      variants: [],
      simpleSku: { price: '659', stock: '10', images: ['https://img/a.jpg'], barcode: '' },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.price).toBe(450);
    expect(payload).not.toHaveProperty('original_price');
  });

  it('detectProductMode treats single phantom SKU as simple', () => {
    expect(
      detectProductMode({
        skus: [{ id: 'sku-1', option_values: {}, price: 100, stock: 5 }],
      }),
    ).toBe('simple');
    expect(
      detectProductMode({
        skus: [
          { id: 'a', option_values: { size: 'M' }, price: 100, stock: 1 },
          { id: 'b', option_values: { size: 'L' }, price: 100, stock: 2 },
        ],
      }),
    ).toBe('multi');
  });

  it('buildVendorProductPayload multi mode supports three variant axes', () => {
    const axes = [
      customVariantAxis('Flavour')!,
      customVariantAxis('Pack')!,
      customVariantAxis('Size')!,
    ];
    const variants: VariantRow[] = [
      {
        id: 'v1',
        optionValues: { flavour: 'Chicken', pack: '500g', size: 'Adult' },
        price: '550',
        stock: '3',
        images: ['https://img/p.jpg'],
        isDefault: true,
      },
    ];
    const payload = buildVendorProductPayload({
      form: baseForm,
      mode: 'multi',
      variants,
      simpleSku: { price: '', stock: '', images: [], barcode: '' },
      variantAxes: axes,
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.skus[0].option_values).toEqual({
      flavour: 'Chicken',
      pack: '500g',
      size: 'Adult',
    });
    expect(payload.metadata?.variant_axes).toHaveLength(3);
  });

  it('validateProductForm rejects more than three variant axes', () => {
    const axes = [
      customVariantAxis('A')!,
      customVariantAxis('B')!,
      customVariantAxis('C')!,
      customVariantAxis('D')!,
    ];
    const err = validateProductForm({
      form: baseForm,
      mode: 'multi',
      variants: [
        {
          id: 'v1',
          optionValues: { a: '1', b: '2', c: '3', d: '4' },
          price: '90',
          stock: '1',
          images: ['https://img/a.jpg'],
          isDefault: true,
        },
      ],
      simpleSku: { price: '', stock: '', images: [], barcode: '' },
      variantAxes: axes,
    });
    expect(err).toMatch(/Maximum 3 variant attributes/);
  });

  it('validateProductForm rejects more than fifty SKU rows', () => {
    const variants: VariantRow[] = Array.from({ length: 51 }, (_, i) => ({
      id: `v${i}`,
      optionValues: { size: `S${i}` },
      price: '90',
      stock: '1',
      images: ['https://img/a.jpg'],
      isDefault: i === 0,
    }));
    const err = validateProductForm({
      form: baseForm,
      mode: 'multi',
      variants,
      simpleSku: { price: '', stock: '', images: [], barcode: '' },
      variantAxes: presetVariantAxes('size'),
    });
    expect(err).toMatch(/Maximum 50/);
  });
});
