/**
 * Safe geolocation utilities - avoid repeated prompts and noisy logs when permission denied.
 * On Capacitor native (Android/iOS app), delegates to address-from-geolocation (Capacitor plugin).
 */

import { Capacitor } from '@capacitor/core';

const STORAGE_KEY_DENIED = 'warmpawz_geolocation_denied';

/** Default fallback (Mumbai) when geolocation unavailable or denied */
export const DEFAULT_COORDS = { lat: 19.076, lng: 72.8777 };

export type GeolocationResult = { lat: number; lng: number };

/**
 * Check if we should skip geolocation (user previously denied or permission is denied).
 * Browser only — native uses Capacitor permission flow.
 */
export async function shouldSkipGeolocation(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  if (Capacitor.isNativePlatform()) return false;
  if (sessionStorage.getItem(STORAGE_KEY_DENIED) === '1') return true;
  try {
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (result.state === 'denied') {
        sessionStorage.setItem(STORAGE_KEY_DENIED, '1');
        return true;
      }
    }
  } catch {
    // Permissions API not supported or geolocation not in schema - proceed with request
  }
  return false;
}

/**
 * Request current position with graceful fallback. Does not log permission-denied to console.
 */
export function getCurrentPositionSafe(
  onSuccess: (coords: GeolocationResult) => void,
  onFallback?: (coords: GeolocationResult) => void,
  fallbackCoords: GeolocationResult = DEFAULT_COORDS
): void {
  if (typeof window === 'undefined') {
    onFallback?.(fallbackCoords);
    return;
  }

  const applyFallback = () => {
    sessionStorage.setItem(STORAGE_KEY_DENIED, '1');
    onFallback?.(fallbackCoords);
    onSuccess(fallbackCoords);
  };

  void (async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { resolveCurrentGeolocationCoords } = await import('@/lib/address-from-geolocation');
        const coords = await resolveCurrentGeolocationCoords();
        sessionStorage.removeItem(STORAGE_KEY_DENIED);
        onSuccess({ lat: coords.latitude, lng: coords.longitude });
      } catch {
        applyFallback();
      }
      return;
    }

    if (!navigator.geolocation) {
      applyFallback();
      return;
    }

    const skip = await shouldSkipGeolocation();
    if (skip) {
      applyFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        sessionStorage.removeItem(STORAGE_KEY_DENIED);
        onSuccess({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === 1) {
          applyFallback();
          return;
        }
        if (process.env.NODE_ENV === 'development') {
          console.debug('Geolocation unavailable:', error.message);
        }
        applyFallback();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  })();
}
