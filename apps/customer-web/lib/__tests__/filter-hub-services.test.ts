import {
  filterProvidersServicesForVetHub,
  filterServicesForVetHub,
  filterVetHubProviderRows,
  isGroomingServiceForVetHub,
  resolveServiceCategoryDisplayLabel,
  applyVetHubDiscoveryToProviders,
  filterGroomingHubProviderRows,
  filterTrainingHubProviderRows,
  filterBehavioristHubProviderRows,
  applyWapptHubDiscoveryToProviders,
} from '../filter-hub-services';

describe('resolveServiceCategoryDisplayLabel', () => {
  it('shows Grooming instead of General for groom_ear', () => {
    expect(
      resolveServiceCategoryDisplayLabel({
        category: 'General',
        catalogServiceSlug: 'groom_ear',
      })
    ).toBe('Grooming');
  });

  it('hides bare General when not vet catalog', () => {
    expect(resolveServiceCategoryDisplayLabel({ category: 'General' })).toBeUndefined();
  });
});

describe('filterVetHubProviderRows', () => {
  it('drops groomer-center providers from vet hub rows', () => {
    const rows = [
      { id: 'vet-1', roleDisplayName: 'Veterinary Clinic' },
      { id: 'g-1', roleDisplayName: 'Groomer (Center)' },
    ];
    expect(filterVetHubProviderRows(rows).map((r) => r.id)).toEqual(['vet-1']);
  });

  it('drops trainer_solo and pet walker from vet home visit rows', () => {
    const rows = [
      { id: 'vet-1', roleDisplayName: 'Veterinary Clinic' },
      { id: 't-1', roleDisplayName: 'Trainer (Solo)', role: 'trainer_solo' },
      { id: 'w-1', roleDisplayName: 'Pet walker', role: 'walker' },
    ];
    expect(filterVetHubProviderRows(rows).map((r) => r.id)).toEqual(['vet-1']);
  });
});

describe('applyVetHubDiscoveryToProviders', () => {
  it('drops groomer with only grooming services from vet home visit list', () => {
    const rows = [
      {
        id: 'g-1',
        roleDisplayName: 'Groomer (Center)',
        services: [{ name: 'Ear Cleaning', category: 'General', catalogServiceSlug: 'groom_ear' }],
      },
      {
        id: 'vet-1',
        roleDisplayName: 'Veterinary Clinic',
        services: [{ name: 'Checkup', category: 'Veterinary Services' }],
      },
    ];
    expect(applyVetHubDiscoveryToProviders(rows).map((r) => r.id)).toEqual(['vet-1']);
  });

  it('drops trainers that leaked via General at_home services', () => {
    const rows = [
      {
        id: 't-1',
        roleDisplayName: 'Trainer (Solo)',
        role: 'trainer_solo',
        services: [{ name: 'Daily training', category: 'General', catalogServiceSlug: 'TRA-001' }],
      },
      {
        id: 'vet-1',
        roleDisplayName: 'Veterinary Clinic',
        services: [{ name: 'Home Visit', category: 'Veterinary Services' }],
      },
    ];
    expect(applyVetHubDiscoveryToProviders(rows).map((r) => r.id)).toEqual(['vet-1']);
  });

  it('keeps vet clinic pending service fetch when no embedded services', () => {
    const rows = [
      {
        id: 'vet-1',
        roleDisplayName: 'Veterinary Clinic',
        services: [],
        needsServiceFetch: true,
      },
    ];
    expect(applyVetHubDiscoveryToProviders(rows, { keepProvidersPendingServiceFetch: true })).toHaveLength(1);
  });
});

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

describe('filterGroomingHubProviderRows', () => {
  it('drops vet clinics from grooming WAPPT hub rows', () => {
    const rows = [
      { id: 'vet-1', roleDisplayName: 'Veterinary Clinic' },
      { id: 'g-1', roleDisplayName: 'Groomer (Center)' },
    ];
    expect(filterGroomingHubProviderRows(rows).map((r) => r.id)).toEqual(['g-1']);
  });
});

describe('filterTrainingHubProviderRows', () => {
  it('drops groomers from training WAPPT hub rows', () => {
    const rows = [
      { id: 'g-1', roleDisplayName: 'Groomer (Center)' },
      { id: 't-1', roleDisplayName: 'Trainer (Solo)' },
    ];
    expect(filterTrainingHubProviderRows(rows).map((r) => r.id)).toEqual(['t-1']);
  });

  it('drops behaviorists from training WAPPT hub rows', () => {
    const rows = [
      { id: 'b-1', roleDisplayName: 'Pet Behaviorist (Solo)' },
      { id: 't-1', roleDisplayName: 'Trainer (Solo)' },
    ];
    expect(filterTrainingHubProviderRows(rows).map((r) => r.id)).toEqual(['t-1']);
  });
});

describe('filterBehavioristHubProviderRows', () => {
  it('keeps behaviorists and drops trainers', () => {
    const rows = [
      { id: 'b-1', roleDisplayName: 'Pet Behaviorist (Solo)' },
      { id: 't-1', roleDisplayName: 'Trainer (Solo)' },
    ];
    expect(filterBehavioristHubProviderRows(rows).map((r) => r.id)).toEqual(['b-1']);
  });
});

describe('applyWapptHubDiscoveryToProviders', () => {
  it('filters behaviorist hub rows', () => {
    const rows = [
      { id: 'b-1', roleDisplayName: 'Behaviorist Center' },
      { id: 'vet-1', roleDisplayName: 'Veterinary Clinic' },
    ];
    expect(applyWapptHubDiscoveryToProviders(rows, 'behaviorist').map((r) => r.id)).toEqual(['b-1']);
  });
});
