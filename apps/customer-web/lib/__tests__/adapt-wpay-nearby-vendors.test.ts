import {
  adaptWpayNearbyVendorToWalkInProvider,
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
});
