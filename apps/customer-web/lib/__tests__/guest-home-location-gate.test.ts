/**
 * @jest-environment jsdom
 */

import {
  shouldMountGuestHomeContent,
  shouldShowGuestHomeLocationGate,
} from '../guest-home-location-gate';

describe('guest-home-location-gate', () => {
  const guestNoCoords = {
    isGuest: true,
    isAuthenticated: false,
    locationHydrated: true,
    latitude: null as unknown,
    longitude: null as unknown,
  };

  it('blocks Guest Home with empty location', () => {
    expect(shouldMountGuestHomeContent(guestNoCoords)).toBe(false);
    expect(shouldShowGuestHomeLocationGate(guestNoCoords)).toBe(true);
  });

  it('keeps Home blocked while location is hydrating', () => {
    const hydrating = { ...guestNoCoords, locationHydrated: false };
    expect(shouldMountGuestHomeContent(hydrating)).toBe(false);
    expect(shouldShowGuestHomeLocationGate(hydrating)).toBe(false);
  });

  it('allows Guest Home with valid finite lat/lng', () => {
    const valid = { ...guestNoCoords, latitude: 12.97, longitude: 77.59 };
    expect(shouldMountGuestHomeContent(valid)).toBe(true);
    expect(shouldShowGuestHomeLocationGate(valid)).toBe(false);
  });

  it('blocks invalid lat/lng, NaN, Infinity, and city-only coords', () => {
    expect(shouldMountGuestHomeContent({ ...guestNoCoords, latitude: 12.97, longitude: Number.NaN })).toBe(false);
    expect(shouldMountGuestHomeContent({ ...guestNoCoords, latitude: Number.POSITIVE_INFINITY, longitude: 77.59 })).toBe(false);
    expect(shouldMountGuestHomeContent({ ...guestNoCoords, latitude: Number.NEGATIVE_INFINITY, longitude: 77.59 })).toBe(false);
    expect(shouldMountGuestHomeContent({ ...guestNoCoords, latitude: '', longitude: '' })).toBe(false);
  });

  it('does not trap authenticated Home', () => {
    expect(
      shouldMountGuestHomeContent({
        isGuest: false,
        isAuthenticated: true,
        locationHydrated: false,
        latitude: null,
        longitude: null,
      })
    ).toBe(true);
    expect(
      shouldShowGuestHomeLocationGate({
        isGuest: false,
        isAuthenticated: true,
        locationHydrated: true,
        latitude: null,
        longitude: null,
      })
    ).toBe(false);
  });

  it('does not apply the Guest Home gate to authenticated sessions even if isGuest is stale', () => {
    expect(
      shouldMountGuestHomeContent({
        isGuest: true,
        isAuthenticated: true,
        locationHydrated: true,
        latitude: null,
        longitude: null,
      })
    ).toBe(true);
  });
});
