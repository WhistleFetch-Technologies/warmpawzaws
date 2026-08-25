'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocationContextOptional } from '@/context/LocationContext';
import { apiClient } from '@/lib/api-client';
import { LOCATION_UPDATED_EVENT, resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { readPersistedLocation } from '@/lib/location-storage';
import { hasAuthenticatedCustomerSession } from '@/lib/guest-auth-gate';
import {
  readWalkInDiscoveryLocation,
  sameWalkInCoords,
  walkInLocationCacheToken,
  writeWalkInDiscoveryLocation,
  WALK_IN_LOCATION_UPDATED_EVENT,
  type WalkInDiscoveryLocationMode,
} from '@/lib/walk-in-discovery-location';

export type WalkInSavedAddress = {
  id: string;
  label?: string;
  addressLine1?: string;
  city?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
};

export type WalkInDiscoveryLocationState = {
  latitude?: string;
  longitude?: string;
  label?: string;
  mode?: WalkInDiscoveryLocationMode;
  addressId?: string;
  ready: boolean;
  addresses: WalkInSavedAddress[];
  selectAddress: (address: WalkInSavedAddress) => boolean;
  selectCurrentLocation: () => Promise<boolean>;
};

function coordsFromAddress(address: WalkInSavedAddress): { lat: number; lng: number } | null {
  const lat = Number(address.latitude);
  const lng = Number(address.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function addressLabel(address: WalkInSavedAddress): string {
  const parts = [address.label, address.city, address.pincode].filter(
    (part) => String(part || '').trim().length > 0
  );
  return parts.join(' · ') || address.addressLine1 || 'Saved address';
}

export function useWalkInDiscoveryLocation(opts: { phone?: string; isGuest?: boolean } = {}) {
  const { phone, isGuest } = opts;
  const locationCtx = useLocationContextOptional();
  const [ready, setReady] = useState(false);
  const [latitude, setLatitude] = useState<string | undefined>();
  const [longitude, setLongitude] = useState<string | undefined>();
  const [label, setLabel] = useState<string | undefined>();
  const [mode, setMode] = useState<WalkInDiscoveryLocationMode | undefined>();
  const [addressId, setAddressId] = useState<string | undefined>();
  const [addresses, setAddresses] = useState<WalkInSavedAddress[]>([]);

  const applyStored = useCallback(() => {
    const stored = readWalkInDiscoveryLocation();
    if (stored) {
      setLatitude(String(stored.latitude));
      setLongitude(String(stored.longitude));
      setLabel(stored.label);
      setMode(stored.mode);
      setAddressId(stored.addressId);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const onUpdated = () => {
      applyStored();
    };
    const onGenericLocation = () => {
      const stored = readWalkInDiscoveryLocation();
      if (stored?.mode === 'address') return;
      const persisted = readPersistedLocation();
      if (persisted?.latitude == null || persisted?.longitude == null) return;
      if (
        stored &&
        sameWalkInCoords(
          { latitude: stored.latitude, longitude: stored.longitude },
          { latitude: persisted.latitude, longitude: persisted.longitude }
        )
      ) {
        return;
      }
      const source = String(persisted.source || '');
      const nextMode: WalkInDiscoveryLocationMode = source.startsWith('manual')
        ? 'manual'
        : 'current';
      writeWalkInDiscoveryLocation({
        mode: nextMode,
        latitude: persisted.latitude,
        longitude: persisted.longitude,
        label: persisted.city || (nextMode === 'manual' ? 'Manual location' : 'Current location'),
      });
    };
    window.addEventListener(WALK_IN_LOCATION_UPDATED_EVENT, onUpdated);
    window.addEventListener(LOCATION_UPDATED_EVENT, onGenericLocation);
    return () => {
      window.removeEventListener(WALK_IN_LOCATION_UPDATED_EVENT, onUpdated);
      window.removeEventListener(LOCATION_UPDATED_EVENT, onGenericLocation);
    };
  }, [applyStored]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (applyStored()) {
        if (!cancelled) setReady(true);
        return;
      }

      if (locationCtx?.latitude != null && locationCtx?.longitude != null) {
        if (!cancelled) {
          setLatitude(String(locationCtx.latitude));
          setLongitude(String(locationCtx.longitude));
          setMode('current');
          setReady(true);
        }
        return;
      }

      const fallback = await resolveCustomerDiscoveryCoords(phone, { persist: false });
      if (cancelled) return;
      if (fallback.latitude && fallback.longitude) {
        setLatitude(fallback.latitude);
        setLongitude(fallback.longitude);
        setMode(fallback.source === 'geolocation' ? 'current' : 'manual');
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyStored, locationCtx?.latitude, locationCtx?.longitude, phone]);

  useEffect(() => {
    if (isGuest || !hasAuthenticatedCustomerSession() || !phone) {
      setAddresses([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.get<{ addresses?: WalkInSavedAddress[] }>(
          `/customer/addresses?phone=${encodeURIComponent(phone)}`
        );
        if (!cancelled) setAddresses(Array.isArray(res.addresses) ? res.addresses : []);
      } catch {
        if (!cancelled) setAddresses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuest, phone]);

  const selectAddress = useCallback((address: WalkInSavedAddress): boolean => {
    const coords = coordsFromAddress(address);
    if (!coords) return false;
    const stored = writeWalkInDiscoveryLocation({
      mode: 'address',
      addressId: address.id,
      latitude: coords.lat,
      longitude: coords.lng,
      label: addressLabel(address),
    });
    setLatitude(String(stored.latitude));
    setLongitude(String(stored.longitude));
    setLabel(stored.label);
    setMode(stored.mode);
    setAddressId(stored.addressId);
    return true;
  }, []);

  const selectCurrentLocation = useCallback(async (): Promise<boolean> => {
    const ok = locationCtx ? await locationCtx.requestForegroundLocation({ force: true }) : false;
    const persisted = readPersistedLocation();
    const lat = persisted?.latitude ?? locationCtx?.latitude;
    const lng = persisted?.longitude ?? locationCtx?.longitude;
    if (!ok || lat == null || lng == null) return false;
    const stored = writeWalkInDiscoveryLocation({
      mode: 'current',
      latitude: lat,
      longitude: lng,
      label: 'Current location',
    });
    setLatitude(String(stored.latitude));
    setLongitude(String(stored.longitude));
    setLabel(stored.label);
    setMode(stored.mode);
    setAddressId(undefined);
    return true;
  }, [locationCtx]);

  return {
    latitude,
    longitude,
    label,
    mode,
    addressId,
    ready,
    addresses,
    locationToken:
      latitude && longitude ? walkInLocationCacheToken(Number(latitude), Number(longitude)) : '',
    selectAddress,
    selectCurrentLocation,
  } satisfies WalkInDiscoveryLocationState & { locationToken: string };
}
