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
  baseMrp: '500',
  basePrice: '450',
  brand: '',
  keyFeatures: '',
  weightKg: '',
  lengthCm: '',
  breadthCm: '',
  heightCm: '',
  petType: '',
  petTypeOther: '',
  manufacturingDetails: '',
};

describe('vendor-product-form', () => {
  it('buildVendorProductPayload simple mode omits skus', () => {
    const payload = buildVendorProductPayload({
      form: baseForm,
      mode: 'simple',
      variants: [],
      simpleSku: { mrp: '500', price: '450', stock: '10', images: ['https://img/a.jpg'] },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.skus).toEqual([]);
    expect(payload.stock).toBe(10);
    expect(payload.price).toBe(450);
    expect(payload.images).toEqual(['https://img/a.jpg']);
  });

  it('buildVendorProductPayload multi mode uses per-variant MRP and SP', () => {
    const variants: VariantRow[] = [
      {
        id: 'v1',
        optionValues: { size: 'M', color: 'Red' },
        size: 'M',
        color: 'Red',
        mrp: '500',
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
      simpleSku: { mrp: '', price: '', stock: '', images: [] },
      variantAxes: presetVariantAxes('size_color'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.skus).toHaveLength(1);
    expect(payload.skus[0]).not.toHaveProperty('sku');
    expect(payload.skus[0].price).toBe(450);
    expect(payload.skus[0].compare_at_price).toBe(500);
    expect(payload.skus[0].option_values).toEqual({ size: 'M', color: 'Red' });
    expect(payload.metadata?.variant_axes).toHaveLength(2);
    expect(payload.stock).toBe(5);
    expect(payload.images).toEqual(['https://img/v.jpg']);
    expect(payload.price).toBe(450);
    expect(payload.original_price).toBe(500);
  });

  it('effectiveVariantPrice requires explicit variant MRP', () => {
    const row: VariantRow = {
      id: '1',
      optionValues: {},
      mrp: '',
      price: '',
      stock: '1',
      images: [],
      isDefault: false,
    };
    expect(effectiveVariantMrp(row)).toBe(0);
    expect(effectiveVariantPrice(row)).toBe(0);
    const filled: VariantRow = { ...row, mrp: '500', price: '450' };
    expect(effectiveVariantMrp(filled)).toBe(500);
    expect(effectiveVariantPrice(filled)).toBe(450);
  });

  it('validateProductForm rejects duplicate variants', () => {
    const variants: VariantRow[] = [
      { id: '1', optionValues: { size: 'M', color: 'Red' }, size: 'M', color: 'Red', mrp: '500', price: '450', stock: '1', images: ['a'], isDefault: false },
      { id: '2', optionValues: { size: 'M', color: 'Red' }, size: 'M', color: 'Red', mrp: '500', price: '450', stock: '2', images: ['b'], isDefault: false },
    ];
    const err = validateProductForm({
      form: baseForm,
      mode: 'multi',
      variants,
      simpleSku: { mrp: '', price: '', stock: '', images: [] },
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
    expect(rows[0].mrp).toBe('33');
    expect(rows[0].price).toBe('33');
  });

  it('buildVendorProductPayload multi mode supports pack axis', () => {
    const variants: VariantRow[] = [
      {
        id: 'v1',
        optionValues: { pack: '1X100' },
        mrp: '600',
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
      simpleSku: { mrp: '', price: '', stock: '', images: [] },
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
        petType: 'dog',
      },
      mode: 'simple',
      variants: [],
      simpleSku: {
        mrp: '500',
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

  it('validateProductForm requires pet_type_other when pet type is other', () => {
    const err = validateProductForm({
      form: { ...baseForm, petType: 'other', petTypeOther: '' },
      mode: 'simple',
      variants: [],
      simpleSku: { mrp: '500', price: '450', stock: '10', images: ['a'], barcode: '' },
      variantAxes: presetVariantAxes('size'),
    });
    expect(err).toMatch(/pet type/i);
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

  it('buildVendorProductPayload simple mode uses form.basePrice not stale simpleSku.price', () => {
    const payload = buildVendorProductPayload({
      form: { ...baseForm, baseMrp: '500', basePrice: '450' },
      mode: 'simple',
      variants: [],
      simpleSku: { mrp: '500', price: '659', stock: '10', images: ['https://img/a.jpg'] },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.price).toBe(450);
    expect(payload.original_price).toBe(500);
  });

  it('buildVendorProductPayload simple mode uses form.basePrice when simpleSku.price empty', () => {
    const payload = buildVendorProductPayload({
      form: { ...baseForm, baseMrp: '500', basePrice: '400' },
      mode: 'simple',
      variants: [],
      simpleSku: { mrp: '', price: '', stock: '10', images: ['https://img/a.jpg'] },
      variantAxes: presetVariantAxes('size'),
      sellerId: 'vendor-1',
      stripImageUrl: strip,
    });
    expect(payload.price).toBe(400);
    expect(payload.original_price).toBe(500);
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
        mrp: '600',
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
      simpleSku: { mrp: '', price: '', stock: '', images: [] },
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
          mrp: '100',
          price: '90',
          stock: '1',
          images: ['https://img/a.jpg'],
          isDefault: true,
        },
      ],
      simpleSku: { mrp: '', price: '', stock: '', images: [] },
      variantAxes: axes,
    });
    expect(err).toMatch(/Maximum 3 variant attributes/);
  });

  it('validateProductForm rejects more than fifty SKU rows', () => {
    const variants: VariantRow[] = Array.from({ length: 51 }, (_, i) => ({
      id: `v${i}`,
      optionValues: { size: `S${i}` },
      mrp: '100',
      price: '90',
      stock: '1',
      images: ['https://img/a.jpg'],
      isDefault: i === 0,
    }));
    const err = validateProductForm({
      form: baseForm,
      mode: 'multi',
      variants,
      simpleSku: { mrp: '', price: '', stock: '', images: [] },
      variantAxes: presetVariantAxes('size'),
    });
    expect(err).toMatch(/Maximum 50 variant rows/);
  });
});
