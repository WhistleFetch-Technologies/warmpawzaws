import {
  isVaccinationService,
  resolveGstCatalogCategoryRefForBooking,
} from '../resolve-service-booking-tax-item';

describe('isVaccinationService', () => {
  it('detects catalog vet_vaccination slug', () => {
    expect(isVaccinationService({ catalogServiceId: 'vet_vaccination' })).toBe(true);
  });

  it('detects vaccination by service name', () => {
    expect(isVaccinationService({ serviceName: 'Anti-Rabies Vaccination' })).toBe(true);
  });

  it('does not treat deworming as vaccination', () => {
    expect(
      isVaccinationService({
        catalogServiceId: 'vet_deworming',
        serviceName: 'Deworming',
      }),
    ).toBe(false);
  });

  it('does not treat home visit as vaccination', () => {
    expect(
      isVaccinationService({
        catalogServiceId: 'vet_home_visit',
        serviceName: 'Home Visit Consultation',
      }),
    ).toBe(false);
  });
});

describe('resolveGstCatalogCategoryRefForBooking', () => {
  it('uses veterinary category for deworming', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'veterinary',
      catalogServiceId: 'vet_deworming',
      serviceName: 'Deworming',
    });
    expect(ref).toBe('veterinary');
  });

  it('uses veterinary category for home visit consultation', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'veterinary',
      catalogServiceId: 'vet_home_visit',
      serviceName: 'Home Visit Consultation',
    });
    expect(ref).toBe('veterinary');
  });

  it('keeps vaccination off veterinary catalogue row (18% default path)', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'veterinary',
      catalogServiceId: 'vet_vaccination',
      serviceName: 'Vaccination',
    });
    expect(ref).toBeNull();
  });

  it('uses metadata gst catalog override for vaccination when set', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'veterinary',
      catalogServiceId: 'vet_vaccination',
      scMetadata: { gst_catalog_category_ref: 'pharmacy' },
    });
    expect(ref).toBe('pharmacy');
  });

  it('uses sub_category_id for vaccination when present', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'veterinary',
      catalogServiceId: 'vet_vaccination',
      subCategoryIdFromCatalog: 'preventive_vaccination',
    });
    expect(ref).toBe('preventive_vaccination');
  });
});
