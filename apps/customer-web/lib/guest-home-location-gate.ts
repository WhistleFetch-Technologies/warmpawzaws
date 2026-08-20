import { hasValidGuestHomeLocation } from './location-storage';

export type GuestHomeLocationGateInput = {
  isGuest: boolean;
  isAuthenticated: boolean;
  locationHydrated: boolean;
  latitude: unknown;
  longitude: unknown;
};

/** Authenticated Home is never blocked by the Guest Home location gate. */
export function shouldMountGuestHomeContent(input: GuestHomeLocationGateInput): boolean {
  if (!input.isGuest || input.isAuthenticated) return true;
  if (!input.locationHydrated) return false;
  return hasValidGuestHomeLocation({
    latitude: input.latitude,
    longitude: input.longitude,
  });
}

/** Two-option gate — only after location state has hydrated for a Guest. */
export function shouldShowGuestHomeLocationGate(input: GuestHomeLocationGateInput): boolean {
  if (!input.isGuest || input.isAuthenticated) return false;
  if (!input.locationHydrated) return false;
  return !hasValidGuestHomeLocation({
    latitude: input.latitude,
    longitude: input.longitude,
  });
}

export { hasValidGuestHomeLocation };
