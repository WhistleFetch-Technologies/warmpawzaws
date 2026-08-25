import {
  adaptWpayNearbyVendorToWalkInProvider,
  buildWpayNearbyVendorsUrl,
  type WpayNearbyVendorDto,
} from '../adapt-wpay-nearby-vendors';

function makeDto(overrides: Partial<WpayNearbyVendorDto> = {}): WpayNearbyVendorDto {
  return {
    vendorId: 'vendor-bindu-vet',
    name: 'Bindu Vet Clinic',
    photoUrl: null,
    category: 'vet',
    categoryLabel: 'Vet · Veterinarian (Solo)',
    rating: 4.5,
    reviewCount: 10,
    distanceKm: 6.5,
    distanceText: '6.5 km',
    warmpawzPayEligible: true,
    appointmentEligible: true,
    discountPercent: 10,
    profilePath: { vertical: 'vet', serviceStyle: 'at_center' },
    ...overrides,
  };
}

describe('adaptWpayNearbyVendorToWalkInProvider', () => {
  it('maps solo vet walk-in row to at_home despite API at_center profilePath', () => {
    const provider = adaptWpayNearbyVendorToWalkInProvider(makeDto());
    expect(provider).not.toBeNull();
    expect(provider?.serviceStyle).toBe('at_home');
    expect(provider?.category).toBe('vet');
  });

  it('keeps at_center when category label indicates centre', () => {
    const provider = adaptWpayNearbyVendorToWalkInProvider(
      makeDto({
        categoryLabel: 'Grooming Centre',
        category: 'grooming',
        profilePath: { vertical: 'grooming', serviceStyle: 'at_center' },
      }),
    );
    expect(provider?.serviceStyle).toBe('at_center');
  });

  it('honours API at_home profilePath', () => {
    const provider = adaptWpayNearbyVendorToWalkInProvider(
      makeDto({
        profilePath: { vertical: 'vet', serviceStyle: 'at_home' },
      }),
    );
    expect(provider?.serviceStyle).toBe('at_home');
  });

  it('maps walker and nutrition vendors without a frontend category allowlist', () => {
    const walker = adaptWpayNearbyVendorToWalkInProvider(
      makeDto({
        vendorId: 'vendor-walker',
        name: 'Walk With Me',
        category: 'walker',
        categoryLabel: 'Dog Walker',
      }),
    );
    const nutrition = adaptWpayNearbyVendorToWalkInProvider(
      makeDto({
        vendorId: 'vendor-nutrition',
        name: 'Pet Nutrition',
        category: 'nutrition',
        categoryLabel: 'Nutritionist',
      }),
    );
    expect(walker?.category).toBe('walker');
    expect(nutrition?.category).toBe('nutrition');
  });

  it('keeps independent capability flags', () => {
    const wpayOnly = adaptWpayNearbyVendorToWalkInProvider(
      makeDto({ warmpawzPayEligible: true, appointmentEligible: false }),
    );
    const appointmentOnly = adaptWpayNearbyVendorToWalkInProvider(
      makeDto({
        vendorId: 'vendor-appt',
        name: 'Appointment Clinic',
        warmpawzPayEligible: false,
        appointmentEligible: true,
      }),
    );
    expect(wpayOnly).toMatchObject({
      warmpawzPayEligible: true,
      appointmentEligible: false,
    });
    expect(appointmentOnly).toMatchObject({
      warmpawzPayEligible: false,
      appointmentEligible: true,
    });
  });

  it('drops vendors with neither catalogue capability', () => {
    expect(
      adaptWpayNearbyVendorToWalkInProvider(
        makeDto({ warmpawzPayEligible: false, appointmentEligible: false }),
      ),
    ).toBeNull();
  });
});

describe('buildWpayNearbyVendorsUrl', () => {
  it('sends coordinates and does not invent a client radius', () => {
    const url = buildWpayNearbyVendorsUrl({
      limit: 8,
      latitude: '12.97',
      longitude: '77.59',
    });
    expect(url).toContain('latitude=12.97');
    expect(url).toContain('longitude=77.59');
    expect(url).not.toContain('maxDistanceKm=');
  });
});
