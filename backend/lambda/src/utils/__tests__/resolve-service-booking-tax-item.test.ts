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
  it('maps behavioral catalogue to training GST card', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'behavioral',
      serviceName: 'Aggression Rehabilitation Program',
    });
    expect(ref).toBe('training');
  });

  it('maps lab-diagnostics catalogue to diagnostic GST card', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'lab-diagnostics',
      serviceName: 'Blood Test',
    });
    expect(ref).toBe('diagnostic');
  });

  it('maps veterinary_services package category text to veterinary GST card', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      categoryFallback: 'veterinary_services',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('veterinary');
  });

  it('maps Veterinary Services display name to veterinary GST card', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      categoryFallback: 'Veterinary Services',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('veterinary');
  });

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

  it('uses boarding categoryFallback for vet custom boarding (not veterinary)', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      catalogServiceId: null,
      serviceName: 'Smoke Custom Overnight Boarding',
      categoryFallback: 'boarding',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('boarding');
  });

  it('uses Pet Boarding categoryFallback for vet custom service', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      categoryFallback: 'Pet Boarding',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('Pet Boarding');
  });

  it('prefers vs category id over vet role short-circuit', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: 'pet_boarding',
      categoryFallback: 'Boarding',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('pet_boarding');
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

  it('ignores pet_services fallback then uses vet short-circuit when vendor is vet', async () => {
    const ref = await resolveGstCatalogCategoryRefForBooking({
      categoryIdFromCatalog: null,
      catalogServiceId: 'groom_home',
      serviceName: 'Home Grooming',
      categoryFallback: 'pet_services',
      vendorRoleName: 'vet_clinic',
    });
    expect(ref).toBe('veterinary');
  });

  it('ignores pet_services fallback for non-vet', async () => {
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
