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

  it('uses the full long description instead of the 200-char short preview', () => {
    const full =
      'Includes Physical examination of anal glands. Manual expression of anal glands. Cleaning of gland area. Basic assessment of surrounding tissue, lubrication, and follow-up advice for home care after the clinic visit so the pet stays comfortable.';
    const short = `${full.slice(0, 200)}…`;
    const mapped = mapVendorServicesForVetHub(
      [
        {
          id: 'vs-1',
          serviceId: 'svc-1',
          name: 'Anal Gland Expression Manual',
          category: 'Veterinary Services',
          shortDescription: short,
          description: full,
          longDescription: full,
        },
      ],
      { vendorProfile: true },
    );
    expect(mapped[0].description).toBe(full);
    expect(mapped[0].description?.endsWith('…')).toBe(false);

    const shortOnlyLongerBecauseEllipsis = mapVendorServicesForVetHub(
      [
        {
          id: 'vs-2',
          serviceId: 'svc-2',
          name: 'Anal Gland Expression Manual',
          category: 'Veterinary Services',
          shortDescription: `${full}…`,
          description: full,
        },
      ],
      { vendorProfile: true },
    );
    expect(shortOnlyLongerBecauseEllipsis[0].description).toBe(full);
  });
});
