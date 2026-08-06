import { buildSearchAppointmentsVendorProfileUrl } from '../search-booking-launch';
import { searchCardToBoardingListVendor } from '../search-training-vendor-map';
import { resolveBoardingListVendorProfileServiceStyle } from '../resolve-wappt-vendor-profile-service-style';

describe('search profile serviceStyle resolution', () => {
  it('builds at_home URL for solo vet from search card', () => {
    const vendor = searchCardToBoardingListVendor(
      {
        id: 'v1',
        name: 'Bindu Vet Clinic',
        category: 'vet',
        roleDisplayName: 'Veterinarian (Solo)',
      },
      'vet',
    );
    const serviceStyle = resolveBoardingListVendorProfileServiceStyle(vendor, 'vet');

    expect(serviceStyle).toBe('at_home');
    expect(
      buildSearchAppointmentsVendorProfileUrl({
        vendorId: 'v1',
        category: 'vet',
        vendorName: 'Bindu Vet Clinic',
        serviceStyle,
      }),
    ).toBe(
      '/search/vendor-profile?vendorId=v1&category=vet&serviceStyle=at_home&vendorName=Bindu+Vet+Clinic',
    );
  });

  it('builds at_home URL for solo groomer from search card', () => {
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
    const serviceStyle = resolveBoardingListVendorProfileServiceStyle(vendor, 'grooming');

    expect(serviceStyle).toBe('at_home');
    expect(
      buildSearchAppointmentsVendorProfileUrl({
        vendorId: 'g1',
        category: 'grooming',
        serviceStyle,
      }),
    ).toContain('serviceStyle=at_home');
  });

  it('keeps at_center for center clinic', () => {
    const vendor = searchCardToBoardingListVendor(
      {
        id: 'c1',
        name: 'City Vet Clinic',
        category: 'vet',
        roleDisplayName: 'Veterinary Clinic',
        preferredServiceStyle: 'at_center',
      },
      'vet',
    );
    const serviceStyle = resolveBoardingListVendorProfileServiceStyle(vendor, 'vet');

    expect(serviceStyle).toBe('at_center');
  });

  it('keeps walker and sitting at_home defaults', () => {
    const walker = searchCardToBoardingListVendor(
      { id: 'w1', name: 'Walker', category: 'walker' },
      'walker',
    );
    const sitting = searchCardToBoardingListVendor(
      { id: 's1', name: 'Sitter', category: 'sitting' },
      'sitting',
    );

    expect(resolveBoardingListVendorProfileServiceStyle(walker, 'walker')).toBe('at_home');
    expect(resolveBoardingListVendorProfileServiceStyle(sitting, 'sitting')).toBe('at_home');
  });

  it('keeps boarding at_center default', () => {
    const boarding = searchCardToBoardingListVendor(
      { id: 'b1', name: 'Pet Stay', category: 'boarding' },
      'boarding',
    );

    expect(resolveBoardingListVendorProfileServiceStyle(boarding, 'boarding')).toBe('at_center');
  });
});
