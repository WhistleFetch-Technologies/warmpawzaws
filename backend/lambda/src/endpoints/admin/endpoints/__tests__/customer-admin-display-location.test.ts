import {
  customerAdminDisplayLocation,
  formatStoredCoordinates,
} from '../customer-admin-display-location';

describe('customerAdminDisplayLocation', () => {
  it('prefers profile address over city and coords', () => {
    expect(
      customerAdminDisplayLocation({
        address: '12 MG Road',
        city: 'Bengaluru',
        latitude: 12.97,
        longitude: 77.59,
      }),
    ).toBe('12 MG Road');
  });

  it('uses city/state/pincode when address is empty', () => {
    expect(
      customerAdminDisplayLocation({
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      }),
    ).toBe('Bengaluru, Karnataka, 560001');
  });

  it('falls back to saved address when profile location is empty', () => {
    expect(
      customerAdminDisplayLocation(
        {},
        { address_line1: 'Flat 2', city: 'Mysuru', pincode: '570001' },
      ),
    ).toBe('Flat 2, Mysuru, 570001');
  });

  it('falls back to stored coordinates when nothing else is saved', () => {
    expect(
      customerAdminDisplayLocation({ latitude: 12.8817737, longitude: 77.5591535 }),
    ).toBe('12.88177, 77.55915');
  });

  it('returns empty when no profile, saved address, or coords exist', () => {
    expect(customerAdminDisplayLocation({})).toBe('');
    expect(formatStoredCoordinates(null, null)).toBe('');
  });
});
