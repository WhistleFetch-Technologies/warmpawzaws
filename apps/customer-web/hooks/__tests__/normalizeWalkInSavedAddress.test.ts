import { normalizeWalkInSavedAddress } from '../useWalkInDiscoveryLocation';

describe('normalizeWalkInSavedAddress', () => {
  it('reads lat/lng from coordinates when top-level fields are missing', () => {
    const address = normalizeWalkInSavedAddress({
      id: 'addr-1',
      label: 'Home',
      city: 'Bengaluru',
      pincode: '560001',
      coordinates: { lat: 12.97, lng: 77.59 },
    });

    expect(address).toMatchObject({
      id: 'addr-1',
      label: 'Home',
      city: 'Bengaluru',
      pincode: '560001',
      latitude: 12.97,
      longitude: 77.59,
    });
  });

  it('returns null without an address id', () => {
    expect(normalizeWalkInSavedAddress({ city: 'Bengaluru' })).toBeNull();
  });
});
