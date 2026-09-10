import {
  applyVendorProductExtrasToPayload,
  buildSpecificationsFromVendorInput,
  filterProductPayloadToColumns,
} from '../product-vendor-persist';

describe('buildSpecificationsFromVendorInput', () => {
  it('persists dimensions from nested specifications (vendor form payload)', () => {
    const specs = buildSpecificationsFromVendorInput({
      specifications: {
        length_cm: 10,
        breadth_cm: 20,
        height_cm: 5,
        key_features: 'Grain free',
        pet_type: 'dog',
      },
    });

    expect(specs.length_cm).toBe(10);
    expect(specs.breadth_cm).toBe(20);
    expect(specs.height_cm).toBe(5);
    expect(specs.key_features).toBe('Grain free');
    expect(specs.pet_type).toBe('dog');
  });

  it('persists dimensions from top-level bulk upload fields', () => {
    const specs = buildSpecificationsFromVendorInput({
      length_cm: 35,
      breadth_cm: 25,
      height_cm: 15,
      key_features: 'Adult formula',
    });

    expect(specs.length_cm).toBe(35);
    expect(specs.breadth_cm).toBe(25);
    expect(specs.height_cm).toBe(15);
    expect(specs.key_features).toBe('Adult formula');
  });

  it('clears dimensions when specifications object omits them on update', () => {
    const specs = buildSpecificationsFromVendorInput(
      {
        specifications: {
          pet_type: 'cat',
        },
      },
      { length_cm: 10, breadth_cm: 5, height_cm: 3, pet_type: 'dog' },
    );

    expect(specs.length_cm).toBeUndefined();
    expect(specs.breadth_cm).toBeUndefined();
    expect(specs.height_cm).toBeUndefined();
    expect(specs.pet_type).toBe('cat');
  });

  it('keeps custom non-reserved specs from nested specifications', () => {
    const specs = buildSpecificationsFromVendorInput({
      specifications: {
        Material: 'Cotton',
        length_cm: 12,
      },
    });

    expect(specs.Material).toBe('Cotton');
    expect(specs.length_cm).toBe(12);
  });
});

describe('filterProductPayloadToColumns', () => {
  it('drops unknown columns such as brand when schema lacks them', () => {
    const cols = new Set(['name', 'vendor_id', 'price']);
    const filtered = filterProductPayloadToColumns(
      { name: 'Treats', vendor_id: 'v1', price: 99, brand: 'Acme' },
      cols,
    );
    expect(filtered).toEqual({ name: 'Treats', vendor_id: 'v1', price: 99 });
    expect(filtered.brand).toBeUndefined();
  });
});

describe('applyVendorProductExtrasToPayload lead time', () => {
  const cols = new Set(['lead_time_min_days', 'lead_time_max_days']);

  it('persists a valid min/max pair', () => {
    const payload: Record<string, unknown> = {};
    applyVendorProductExtrasToPayload(
      payload,
      { lead_time_min_days: 35, lead_time_max_days: 42 },
      cols,
    );
    expect(payload.lead_time_min_days).toBe(35);
    expect(payload.lead_time_max_days).toBe(42);
  });

  it('clears lead time when both values are empty', () => {
    const payload: Record<string, unknown> = {};
    applyVendorProductExtrasToPayload(
      payload,
      { lead_time_min_days: '', lead_time_max_days: '' },
      cols,
    );
    expect(payload.lead_time_min_days).toBeNull();
    expect(payload.lead_time_max_days).toBeNull();
  });

  it('does not persist a one-sided pair', () => {
    const payload: Record<string, unknown> = { name: 'Bed' };
    applyVendorProductExtrasToPayload(payload, { lead_time_min_days: 35 }, cols);
    expect(payload.lead_time_min_days).toBeUndefined();
    expect(payload.lead_time_max_days).toBeUndefined();
  });
});

describe('applyVendorProductExtrasToPayload brand fallback', () => {
  it('stores brand in specifications when products.brand column is missing', () => {
    const payload: Record<string, unknown> = {};
    applyVendorProductExtrasToPayload(payload, { brand: 'Royal Canin' }, new Set(['specifications']));
    expect(payload.brand).toBeUndefined();
    expect((payload.specifications as Record<string, unknown>).brand).toBe('Royal Canin');
  });
});
