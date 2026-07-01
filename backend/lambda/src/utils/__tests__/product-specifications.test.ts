import {
  formatPetTypeForCustomer,
  formatPetTypeForVendor,
  PET_TYPE_CUSTOMER_LABEL_ALL_PETS,
  resolveVendorPetTypeInput,
} from '@warmpawz/shared-types';

describe('resolveVendorPetTypeInput', () => {
  it('maps empty to allpet', () => {
    expect(resolveVendorPetTypeInput('')).toEqual({
      pet_type: 'allpet',
      pet_type_other: null,
    });
  });

  it('maps dog and cat case-insensitively', () => {
    expect(resolveVendorPetTypeInput('Dog')).toEqual({ pet_type: 'dog', pet_type_other: null });
    expect(resolveVendorPetTypeInput('CATS')).toEqual({ pet_type: 'cat', pet_type_other: null });
  });

  it('maps Other and All pets to allpet', () => {
    expect(resolveVendorPetTypeInput('Other')).toEqual({ pet_type: 'allpet', pet_type_other: null });
    expect(resolveVendorPetTypeInput('All pets')).toEqual({
      pet_type: 'allpet',
      pet_type_other: null,
    });
    expect(resolveVendorPetTypeInput('allpet')).toEqual({
      pet_type: 'allpet',
      pet_type_other: null,
    });
  });

  it('maps custom typed pets to other + label', () => {
    expect(resolveVendorPetTypeInput('Birds')).toEqual({
      pet_type: 'other',
      pet_type_other: 'Birds',
    });
  });

  it('legacy pet_type Other + pet_type_other uses label', () => {
    expect(resolveVendorPetTypeInput('Other', 'Birds')).toEqual({
      pet_type: 'other',
      pet_type_other: 'Birds',
    });
  });

  it('legacy empty pet_type + pet_type_other uses label', () => {
    expect(resolveVendorPetTypeInput('', 'Rabbit')).toEqual({
      pet_type: 'other',
      pet_type_other: 'Rabbit',
    });
  });
});

describe('formatPetTypeForVendor', () => {
  it('round-trips stored values', () => {
    expect(formatPetTypeForVendor('dog')).toBe('Dog');
    expect(formatPetTypeForVendor('cat')).toBe('Cat');
    expect(formatPetTypeForVendor('allpet')).toBe(PET_TYPE_CUSTOMER_LABEL_ALL_PETS);
    expect(formatPetTypeForVendor('other', 'Birds')).toBe('Birds');
    expect(formatPetTypeForVendor('other')).toBe(PET_TYPE_CUSTOMER_LABEL_ALL_PETS);
  });
});

describe('formatPetTypeForCustomer', () => {
  it('shows All pets for empty, allpet, and legacy other without label', () => {
    expect(formatPetTypeForCustomer(null)).toBe(PET_TYPE_CUSTOMER_LABEL_ALL_PETS);
    expect(formatPetTypeForCustomer('allpet')).toBe(PET_TYPE_CUSTOMER_LABEL_ALL_PETS);
    expect(formatPetTypeForCustomer('other')).toBe(PET_TYPE_CUSTOMER_LABEL_ALL_PETS);
  });

  it('shows specific label for other + pet_type_other', () => {
    expect(formatPetTypeForCustomer('other', 'Birds')).toBe('Birds');
  });
});
