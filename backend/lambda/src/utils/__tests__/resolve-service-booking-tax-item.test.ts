import {
  isVaccinationService,
  isVetVendorRoleName,
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

  it('uses veterinary category for vaccination (0% with vet roles)', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'veterinary',
      catalogServiceId: 'vet_vaccination',
      serviceName: 'Vaccination',
    });
    expect(ref).toBe('veterinary');
  });

  it('infers veterinary for vaccination when catalog category is null and vendor is vet_clinic', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      catalogServiceId: 'vet_vaccination',
      serviceName: 'Anti-Rabies Vaccination',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('veterinary');
  });

  it('uses metadata gst catalog override when set', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'veterinary',
      catalogServiceId: 'vet_vaccination',
      scMetadata: { gst_catalog_category_ref: 'pharmacy' },
    });
    expect(ref).toBe('pharmacy');
  });

  it('infers veterinary when catalog category is null and vendor is vet_clinic', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      catalogServiceId: 'svc_veterinary_clinic_at_home_custom',
      serviceName: 'Home Visit Consultation',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('veterinary');
  });

  it('does not infer veterinary for groomer when catalog category is null', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      catalogServiceId: 'groom_home',
      serviceName: 'Home Grooming',
      vendorRoleName: 'groomer_solo',
    });
    expect(ref).toBeNull();
  });

  it('ignores pet_services fallback', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      catalogServiceId: 'groom_home',
      serviceName: 'Home Grooming',
      categoryFallback: 'pet_services',
    });
    expect(ref).toBeNull();
  });
});

describe('isVetVendorRoleName', () => {
  it('recognises vet clinic roles', () => {
    expect(isVetVendorRoleName('vet_clinic')).toBe(true);
    expect(isVetVendorRoleName('VET_SOLO')).toBe(true);
  });

  it('rejects groomer roles', () => {
    expect(isVetVendorRoleName('groomer_center')).toBe(false);
  });
});
