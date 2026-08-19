'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  fillAddressFromCurrentLocation,
  geolocationErrorMessage,
} from '@/lib/address-from-geolocation';
import { isGuestLocationEnabled } from '@/lib/guest-location-flag';
import {
  LOCATION_MAX_ACCURACY_M,
  LOCATION_MOVE_REFRESH_M,
  LOCATION_REFRESH_DEBOUNCE_MS,
  LOCATION_STALE_MS,
  type LocationFreshness,
  type LocationPermissionState,
  type LocationSource,
} from '@/lib/location-constants';
import {
  haversineMeters,
  readPersistedLocation,
  writePersistedLocation,
  type PersistedLocationV1,
} from '@/lib/location-storage';
import { LOCATION_UPDATED_EVENT } from '@/lib/customer-discovery-coords';

function emitLocationUpdated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export type LocationState = {
  latitude: number | null;
  longitude: number | null;
  /** Neighbourhood / sublocality when reverse-geocoded */
  locality?: string;
  city?: string;
  pincode?: string;
  state?: string;
  accuracyM: number | null;
  /** location_updated_at (ms) — not last_active_at */
  updatedAt: number | null;
  source: LocationSource;
  permissionStatus: LocationPermissionState;
  locationStatus: LocationFreshness;
  isStale: boolean;
  approximate: boolean;
  error: string | null;
};

type ManualLocationInput = {
  latitude?: number | null;
  longitude?: number | null;
  city?: string;
  pincode?: string;
  state?: string;
  source?: Extract<LocationSource, 'manual_pincode' | 'manual_city'>;
};

type LocationContextValue = LocationState & {
  requestForegroundLocation: (opts?: { force?: boolean }) => Promise<boolean>;
  setManualLocation: (input: ManualLocationInput) => void;
  clearLocationError: () => void;
  refreshIfStaleOnResume: () => void;
};

const EMPTY: LocationState = {
  latitude: null,
  longitude: null,
  accuracyM: null,
  updatedAt: null,
  source: 'unknown',
  permissionStatus: 'unknown',
  locationStatus: 'unknown',
  isStale: true,
  approximate: true,
  error: null,
};

const LocationContext = createContext<LocationContextValue | null>(null);

function freshnessFor(timestamp: number | null, hasCoords: boolean): LocationFreshness {
  if (!hasCoords || timestamp == null) return 'unknown';
  return Date.now() - timestamp > LOCATION_STALE_MS ? 'stale' : 'fresh';
}

function fromPersisted(p: PersistedLocationV1 | null): LocationState {
  if (!p) return EMPTY;
  const hasCoords = p.latitude != null && p.longitude != null;
  const locationStatus = freshnessFor(p.timestamp, hasCoords);
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    locality: p.locality,
    city: p.city,
    pincode: p.pincode,
    state: p.state,
    accuracyM: p.accuracyM ?? null,
    updatedAt: p.timestamp || null,
    source: hasCoords && p.source === 'gps' ? 'cached' : p.source || 'cached',
    permissionStatus: p.permissionState || 'unknown',
    locationStatus,
    isStale: locationStatus !== 'fresh',
    approximate: true,
    error: null,
  };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationState>(EMPTY);
  const lastSampleRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestingRef = useRef(false);

  useEffect(() => {
    setState(fromPersisted(readPersistedLocation()));
  }, []);

  const persist = useCallback((next: LocationState) => {
    writePersistedLocation({
      v: 1,
      latitude: next.latitude,
      longitude: next.longitude,
      locality: next.locality,
      city: next.city,
      pincode: next.pincode,
      state: next.state,
      accuracyM: next.accuracyM,
      timestamp: next.updatedAt || Date.now(),
      source: next.source,
      permissionState: next.permissionStatus,
    });
  }, []);

  const applyCoords = useCallback(
    (coords: {
      latitude: number;
      longitude: number;
      accuracyM?: number | null;
      source: LocationSource;
      locality?: string;
      city?: string;
      pincode?: string;
      state?: string;
      permissionStatus?: LocationPermissionState;
    }) => {
      const now = Date.now();
      const prev = lastSampleRef.current;
      if (
        prev &&
        coords.source === 'gps' &&
        haversineMeters(prev.lat, prev.lng, coords.latitude, coords.longitude) <
          LOCATION_MOVE_REFRESH_M &&
        now - prev.at < LOCATION_STALE_MS
      ) {
        // Same neighbourhood — keep coords, but still apply city/pincode from reverse geocode.
        setState((s) => {
          const next = {
            ...s,
            updatedAt: now,
            locationStatus: 'fresh' as const,
            isStale: false,
            permissionStatus: coords.permissionStatus || s.permissionStatus,
            locality: coords.locality || s.locality,
            city: coords.city || s.city,
            pincode: coords.pincode || s.pincode,
            state: coords.state || s.state,
            error: null,
          };
          persist(next);
          return next;
        });
        lastSampleRef.current = { lat: coords.latitude, lng: coords.longitude, at: now };
        emitLocationUpdated();
        return;
      }

      lastSampleRef.current = { lat: coords.latitude, lng: coords.longitude, at: now };
      const next: LocationState = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        locality: coords.locality,
        city: coords.city,
        pincode: coords.pincode,
        state: coords.state,
        accuracyM: coords.accuracyM ?? null,
        updatedAt: now,
        source: coords.source,
        permissionStatus: coords.permissionStatus || 'granted',
        locationStatus: 'fresh',
        isStale: false,
        approximate: (coords.accuracyM ?? 0) > LOCATION_MAX_ACCURACY_M,
        error: null,
      };
      setState(next);
      persist(next);
      emitLocationUpdated();
    },
    [persist]
  );

  const requestForegroundLocation = useCallback(
    async (opts?: { force?: boolean }): Promise<boolean> => {
      // Permission dialogs can hide the tab; only skip backgrounded auto-refresh (force unset).
      if (
        !opts?.force &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return false;
      }
      if (requestingRef.current) return false;
      requestingRef.current = true;
      try {
        if (!opts?.force && lastSampleRef.current) {
          const age = Date.now() - lastSampleRef.current.at;
          if (age < LOCATION_REFRESH_DEBOUNCE_MS) {
            return true;
          }
        }

        // Same Capacitor + reverse-geocode path as address book "Detect location".
        const result = await fillAddressFromCurrentLocation();
        applyCoords({
          latitude: result.latitude,
          longitude: result.longitude,
          source: 'gps',
          permissionStatus: 'granted',
          locality: result.addressLine2,
          city: result.city,
          pincode: result.pincode,
          state: result.state,
        });
        try {
          sessionStorage.removeItem('warmpawz_geolocation_denied');
        } catch {
          // ignore
        }
        return true;
      } catch (err) {
        const msg = geolocationErrorMessage(err);
        const denied =
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('settings');
        setState((s) => ({
          ...s,
          permissionStatus: denied ? 'denied' : s.permissionStatus === 'granted' ? 'granted' : 'unavailable',
          error: msg,
          // Do not invent Mumbai / silent defaults when guest location is on
          locationStatus: freshnessFor(s.updatedAt, s.latitude != null && s.longitude != null),
          isStale: freshnessFor(s.updatedAt, s.latitude != null && s.longitude != null) !== 'fresh',
        }));
        if (denied) {
          try {
            sessionStorage.setItem('warmpawz_geolocation_denied', '1');
          } catch {
            // ignore
          }
        }
        return false;
      } finally {
        requestingRef.current = false;
      }
    },
    [applyCoords]
  );

  const setManualLocation = useCallback(
    (input: ManualLocationInput) => {
      const source = input.source || (input.pincode ? 'manual_pincode' : 'manual_city');
      const lat = input.latitude ?? null;
      const lng = input.longitude ?? null;
      const now = Date.now();
      const next: LocationState = {
        latitude: lat,
        longitude: lng,
        city: input.city,
        pincode: input.pincode,
        state: input.state,
        accuracyM: null,
        updatedAt: now,
        source,
        permissionStatus: state.permissionStatus === 'granted' ? 'granted' : state.permissionStatus,
        locationStatus: lat != null && lng != null ? 'fresh' : 'unknown',
        isStale: lat == null || lng == null,
        approximate: true,
        error: null,
      };
      if (lat != null && lng != null) {
        lastSampleRef.current = { lat, lng, at: now };
      }
      setState(next);
      persist(next);
      if (lat != null && lng != null) {
        emitLocationUpdated();
      }
    },
    [persist, state.permissionStatus]
  );

  const clearLocationError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const refreshIfStaleOnResume = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (!isGuestLocationEnabled()) return;
    if (state.permissionStatus === 'denied') return;
    const stale =
      state.updatedAt == null || Date.now() - state.updatedAt >= LOCATION_STALE_MS;
    if (!stale && state.locationStatus === 'fresh') return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void requestForegroundLocation({ force: true });
    }, LOCATION_REFRESH_DEBOUNCE_MS);
  }, [requestForegroundLocation, state.locationStatus, state.permissionStatus, state.updatedAt]);

  // Foreground-only: stop any pending refresh when backgrounded; one-shot on resume if stale.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        return;
      }
      refreshIfStaleOnResume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [refreshIfStaleOnResume]);

  const value = useMemo<LocationContextValue>(
    () => ({
      ...state,
      requestForegroundLocation,
      setManualLocation,
      clearLocationError,
      refreshIfStaleOnResume,
    }),
    [state, requestForegroundLocation, setManualLocation, clearLocationError, refreshIfStaleOnResume]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocationContext must be used within LocationProvider');
  }
  return ctx;
}

/** Safe for components that may render outside provider (tests / legacy). */
export function useLocationContextOptional(): LocationContextValue | null {
  return useContext(LocationContext);
}
