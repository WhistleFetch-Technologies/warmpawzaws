import {
  filterProvidersServicesForVetHub,
  filterServicesForVetHub,
  isGroomingServiceForVetHub,
} from '../filter-hub-services';

describe('isGroomingServiceForVetHub', () => {
  it('flags groom_ear with General category (grooming catalog mis-tagged)', () => {
    expect(
      isGroomingServiceForVetHub({
        name: 'Ear Cleaning',
        category: 'General',
        catalogServiceSlug: 'groom_ear',
      })
    ).toBe(true);
  });

  it('keeps vet_ear_cleaning_medical with General category', () => {
    expect(
      isGroomingServiceForVetHub({
        name: 'Ear Cleaning (Medical)',
        category: 'General',
        catalogServiceSlug: 'vet_ear_cleaning_medical',
      })
    ).toBe(false);
  });

  it('flags grooming category_id from catalog', () => {
    expect(
      isGroomingServiceForVetHub({
        name: 'Ear Cleaning',
        category: 'General',
        catalogCategoryId: 'grooming',
      })
    ).toBe(true);
  });

  it('keeps veterinary services category', () => {
    expect(
      isGroomingServiceForVetHub({
        name: 'Vaccination',
        category: 'Veterinary Services',
      })
    ).toBe(false);
  });
});

describe('filterServicesForVetHub', () => {
  const rows = [
    { id: '1', name: 'Ear Cleaning', category: 'General', catalogServiceSlug: 'groom_ear' },
    { id: '2', name: 'Ear Cleaning (Medical)', category: 'General', catalogServiceSlug: 'vet_ear_cleaning_medical' },
    { id: '3', name: 'Vaccination', category: 'Veterinary Services' },
  ];

  it('removes grooming catalog services only', () => {
    const out = filterServicesForVetHub(rows);
    expect(out.map((r) => r.id)).toEqual(['2', '3']);
  });
});

describe('filterProvidersServicesForVetHub', () => {
  it('drops providers with only grooming services', () => {
    const providers = [
      {
        id: 'vet-a',
        services: [{ name: 'Checkup', category: 'Veterinary Services' }],
      },
      {
        id: 'vet-b',
        services: [{ name: 'Ear Cleaning', category: 'General', catalogServiceSlug: 'groom_ear' }],
      },
    ];
    const out = filterProvidersServicesForVetHub(providers);
    expect(out.map((p) => p.id)).toEqual(['vet-a']);
  });
});
