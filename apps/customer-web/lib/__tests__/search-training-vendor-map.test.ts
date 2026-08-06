import { searchCardToBoardingListVendor } from '../search-training-vendor-map';
import { resolveBoardingListVendorProfileServiceStyle } from '../resolve-wappt-vendor-profile-service-style';

describe('searchCardToBoardingListVendor', () => {
  it('preserves solo roleDisplayName for grooming', () => {
    const vendor = searchCardToBoardingListVendor(
      {
        id: 'g1',
        name: 'Bindu Grooming Service',
        category: 'grooming',
        roleDisplayName: 'Groomer (Solo)',
        preferredServiceStyle: 'at_home',
      },
      'grooming',
    );

    expect(vendor.raw?.roleDisplayName).toBe('Groomer (Solo)');
    expect(vendor.raw?.preferredServiceStyle).toBe('at_home');
    expect(resolveBoardingListVendorProfileServiceStyle(vendor, 'grooming')).toBe('at_home');
  });

  it('preserves solo roleDisplayName for vet', () => {
    const vendor = searchCardToBoardingListVendor(
      {
        id: 'v1',
        name: 'Bindu Vet Clinic',
        category: 'vet',
        roleDisplayName: 'Veterinarian (Solo)',
      },
      'vet',
    );

    expect(vendor.raw?.roleDisplayName).toBe('Veterinarian (Solo)');
    expect(resolveBoardingListVendorProfileServiceStyle(vendor, 'vet')).toBe('at_home');
  });

  it('falls back to category label when roleDisplayName is missing', () => {
    const vendor = searchCardToBoardingListVendor(
      {
        id: 't1',
        name: 'Training Centre',
        category: 'training',
      },
      'training',
    );

    expect(vendor.raw?.roleDisplayName).toBe('Training');
  });
});
