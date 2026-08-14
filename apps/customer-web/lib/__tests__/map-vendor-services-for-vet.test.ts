import { mapVendorServicesForVetHub } from '../map-vendor-services-for-vet';
import { buildVendorProfileServicesUrl } from '../vendor-services-page';

describe('buildVendorProfileServicesUrl', () => {
  it('omits category and limit for full vendor catalog', () => {
    expect(
      buildVendorProfileServicesUrl({
        vendorId: 'abc-123',
        serviceStyle: 'at_center',
      })
    ).toBe('/customer/vendor/abc-123/services?serviceStyle=at_center');
  });
});

describe('mapVendorServicesForVetHub vendorProfile', () => {
  const rows = [
    { id: '1', serviceId: 'g1', name: 'Ear Cleaning', category: 'General', catalogServiceSlug: 'groom_ear' },
    { id: '2', serviceId: 'v1', name: 'Checkup', category: 'Veterinary Services' },
  ];

  it('filters grooming on hub list mode', () => {
    expect(mapVendorServicesForVetHub(rows).map((r) => r.id)).toEqual(['2']);
  });

  it('keeps all rows on vendor profile mode', () => {
    expect(mapVendorServicesForVetHub(rows, { vendorProfile: true }).map((r) => r.id)).toEqual(['1', '2']);
  });
});
