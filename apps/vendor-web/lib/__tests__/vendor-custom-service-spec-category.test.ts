import {
  findPreferredCatalogCategoryForRole,
  preferredSpecCategorySlugForRole,
  resolveVendorCustomServiceSpecCategoryId,
} from '../vendor-custom-service-spec-category';

describe('resolveVendorCustomServiceSpecCategoryId', () => {
  it('uses platform category UUID when set', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        platformCategoryId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        categoryName: 'Pet Boarding',
      })
    ).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('resolves pet sitting display name to category slug', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'Pet Sitting',
        catalogCategories: [
          { id: 'uuid-1', category_id: 'pet-sitter', name: 'Pet Sitting' },
        ],
      })
    ).toBe('pet-sitter');
  });

  it('falls back to normalized name when catalogue row is missing', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'Pet Boarding',
        catalogCategories: [],
      })
    ).toBe('pet_boarding');
  });

  it('matches micro-category slug id directly', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'pet_boarding',
        catalogCategories: [],
      })
    ).toBe('pet_boarding');
  });

  it('maps legacy Training & Walking default to walking for dog walkers', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'Training & Walking',
        catalogCategories: [],
        vendorRoleName: 'dog_walker',
      })
    ).toBe('walking');
  });

  it('maps legacy Training & Walking default to training for trainers', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'Training & Walking',
        catalogCategories: [],
        vendorRoleName: 'pet_trainer',
      })
    ).toBe('training');
  });

  it('resolves Dog Walker catalogue display name via catalog row', () => {
    expect(
      resolveVendorCustomServiceSpecCategoryId({
        categoryName: 'Dog Walker',
        catalogCategories: [
          { id: 'effeec22-c4b6-44c3-bfee-1962f66110d5', category_id: 'walking', name: 'Dog Walker' },
        ],
      })
    ).toBe('walking');
  });
});

describe('preferredSpecCategorySlugForRole', () => {
  it('prefers walking for walker roles', () => {
    expect(preferredSpecCategorySlugForRole('dog_walker')).toBe('walking');
    expect(preferredSpecCategorySlugForRole('pet_walker')).toBe('walking');
    expect(preferredSpecCategorySlugForRole('walker_solo')).toBe('walking');
  });

  it('prefers training for trainer roles', () => {
    expect(preferredSpecCategorySlugForRole('pet_trainer')).toBe('training');
    expect(preferredSpecCategorySlugForRole('trainer_solo')).toBe('training');
  });
});

describe('findPreferredCatalogCategoryForRole', () => {
  const cats = [
    { id: 'walk-uuid', category_id: 'walking', name: 'Dog Walker' },
    { id: 'train-uuid', category_id: 'training', name: 'Training & Behaviorist' },
  ];

  it('picks walking row for dog walker', () => {
    expect(findPreferredCatalogCategoryForRole(cats, 'dog_walker')?.id).toBe('walk-uuid');
  });

  it('picks training row for trainer', () => {
    expect(findPreferredCatalogCategoryForRole(cats, 'trainer_solo')?.id).toBe('train-uuid');
  });
});
