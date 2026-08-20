import { LOCATION_STORAGE_KEY } from '@/lib/location-storage';
import {
  GUEST_LOCATION_ADDRESS_ID,
  locationToGuestDeliveryAddress,
  readGuestDeliveryAddressFromLocation,
} from '@/lib/ecommerce/guest-delivery-address';

describe('guest delivery address bridge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for empty location', () => {
    expect(locationToGuestDeliveryAddress(null)).toBeNull();
    expect(readGuestDeliveryAddressFromLocation()).toBeNull();
  });

  it('maps city-only manual location', () => {
    const addr = locationToGuestDeliveryAddress({
      v: 1,
      latitude: 12.9716,
      longitude: 77.5946,
      city: 'Bengaluru',
      timestamp: Date.now(),
      source: 'manual_city',
    });
    expect(addr?.id).toBe(GUEST_LOCATION_ADDRESS_ID);
    expect(addr?.fullName).toBe('Current location');
    expect(addr?.addressLine1).toBe('Bengaluru');
    expect(addr?.city).toBe('Bengaluru');
  });

  it('maps pincode-only manual location', () => {
    const addr = locationToGuestDeliveryAddress({
      v: 1,
      latitude: null,
      longitude: null,
      pincode: '560007',
      timestamp: Date.now(),
      source: 'manual_pincode',
    });
    expect(addr?.pincode).toBe('560007');
    expect(addr?.addressLine1).toBe('560007');
  });

  it('prefers stored addressLine1 from GPS reverse geocode', () => {
    const addr = locationToGuestDeliveryAddress({
      v: 1,
      latitude: 12.97,
      longitude: 77.59,
      addressLine1: 'Kathriguppe Main Road',
      city: 'Bengaluru',
      pincode: '560085',
      state: 'Karnataka',
      timestamp: Date.now(),
      source: 'gps',
    });
    expect(addr?.addressLine1).toBe('Kathriguppe Main Road');
    expect(addr?.city).toBe('Bengaluru');
    expect(addr?.pincode).toBe('560085');
  });

  it('reads from localStorage via readGuestDeliveryAddressFromLocation', () => {
    localStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        latitude: 12.9716,
        longitude: 77.5946,
        city: 'Bengaluru',
        pincode: '560007',
        timestamp: Date.now(),
        source: 'manual_pincode',
      })
    );
    const addr = readGuestDeliveryAddressFromLocation();
    expect(addr?.id).toBe(GUEST_LOCATION_ADDRESS_ID);
    expect(addr?.city).toBe('Bengaluru');
    expect(addr?.pincode).toBe('560007');
    expect(addr?.addressLine1).toBe('Bengaluru 560007');
  });
});
