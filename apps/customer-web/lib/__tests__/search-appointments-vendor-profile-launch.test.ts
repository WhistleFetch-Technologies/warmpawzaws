import {
  buildSearchAppointmentsVendorProfileUrl,
  resolveSearchHubAppointmentsServiceStyle,
} from '../search-booking-launch';

describe('search appointments vendor profile launch', () => {
  it('builds shared WAPPT profile URL for hub categories', () => {
    expect(
      buildSearchAppointmentsVendorProfileUrl({
        vendorId: 'v1',
        category: 'grooming',
        vendorName: 'Bindu Grooming Service',
      })
    ).toBe(
      '/search/vendor-profile?vendorId=v1&category=grooming&serviceStyle=at_center&vendorName=Bindu+Grooming+Service'
    );

    expect(
      buildSearchAppointmentsVendorProfileUrl({
        vendorId: 'v2',
        category: 'walker',
      })
    ).toBe('/search/vendor-profile?vendorId=v2&category=walker&serviceStyle=at_home');

    expect(
      buildSearchAppointmentsVendorProfileUrl({
        vendorId: 'v3',
        category: 'vet',
        serviceStyle: 'at_home',
      })
    ).toBe('/search/vendor-profile?vendorId=v3&category=vet&serviceStyle=at_home');
  });

  it('resolves default discovery styles from hub registry', () => {
    expect(resolveSearchHubAppointmentsServiceStyle('grooming')).toBe('at_center');
    expect(resolveSearchHubAppointmentsServiceStyle('sitting')).toBe('at_home');
    expect(resolveSearchHubAppointmentsServiceStyle('boarding')).toBe('at_center');
  });
});
