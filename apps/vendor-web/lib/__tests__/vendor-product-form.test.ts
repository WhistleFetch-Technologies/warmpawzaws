import {
  buildVendorProductPayload,
  validateProductForm,
  orderVariantsForSubmit,
  effectiveVariantPrice,
  effectiveVariantMrp,
  variantsFromProduct,
  presetVariantAxes,
  deliveryRegionsFromProduct,
  sellingPriceForForm,
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

  it('orderVariantsForSubmit puts default variant first', () => {
    const variants: VariantRow[] = [
      { id: 'a', optionValues: { size: 'L' }, mrp: '', price: '', stock: '1', images: ['x'], isDefault: false, size: 'L' },
      { id: 'b', optionValues: { size: 'S' }, mrp: '', price: '', stock: '2', images: ['y'], isDefault: true, size: 'S' },
    ];
    const ordered = orderVariantsForSubmit(variants);
    expect(ordered[0].id).toBe('b');
  });

  it('buildVendorProductPayload multi mode does not include sku field', () => {
    const variants: VariantRow[] = [
      {
        id: 'v1',
        optionValues: { size: 'M', color: 'Red' },
        size: 'M',
        color: 'Red',
        mrp: '',
        price: '',
        stock: '5',
        images: ['https://img/v.jpg'],
        isDefault: true,
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
    expect(payload.skus[0].price).toBeNull();
    expect(payload.skus[0].compare_at_price).toBeNull();
    expect(payload.skus[0].option_values).toEqual({ size: 'M', color: 'Red' });
    expect(payload.metadata?.variant_axes).toHaveLength(2);
    expect(payload.stock).toBe(5);
    expect(payload.images).toEqual(['https://img/v.jpg']);
  });

  it('effectiveVariantPrice inherits base when empty', () => {
    const row: VariantRow = {
      id: '1',
      optionValues: {},
      mrp: '',
      price: '',
      stock: '1',
      images: [],
      isDefault: true,
    };
    expect(effectiveVariantMrp(row, '500')).toBe(500);
    expect(effectiveVariantPrice(row, '450', '500')).toBe(450);
  });

  it('validateProductForm rejects duplicate variants', () => {
    const variants: VariantRow[] = [
      { id: '1', optionValues: { size: 'M', color: 'Red' }, size: 'M', color: 'Red', mrp: '', price: '', stock: '1', images: ['a'], isDefault: true },
      { id: '2', optionValues: { size: 'M', color: 'Red' }, size: 'M', color: 'Red', mrp: '', price: '', stock: '2', images: ['b'], isDefault: false },
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

  it('variantsFromProduct loads skus and marks sort_order 0 as default', () => {
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
    expect(rows[0].isDefault).toBe(true);
    expect(rows[1].isDefault).toBe(false);
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
});
