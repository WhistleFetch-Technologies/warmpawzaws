import { buildSpecificationsFromVendorInput } from '../product-vendor-persist';

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
